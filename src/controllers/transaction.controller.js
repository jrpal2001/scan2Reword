import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { transactionService } from '../services/transaction.service.js';
import { notificationService } from '../services/notification.service.js';
import { pumpRepository } from '../repositories/pump.repository.js';
import { ROLES } from '../constants/roles.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * Build createdAt filter from startDate, endDate, month, year, startTime, endTime.
 * - startTime/endTime: filter by time-of-day (UTC) so only transactions within that time window each day are returned.
 * - Returns { createdAt: { $gte, $lte } } or { $and: [ { createdAt }, { $expr: time-of-day } ] } when startTime/endTime are used.
 */
function buildCreatedAtFilter(validated) {
  const { startDate, endDate, month, year, startTime, endTime } = validated || {};
  let rangeStart = null;
  let rangeEnd = null;

  if (startDate || endDate) {
    if (startDate) rangeStart = new Date(startDate);
    if (endDate) rangeEnd = new Date(endDate);
  } else if (year !== undefined && year !== null) {
    if (month !== undefined && month !== null) {
      rangeStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
      rangeEnd = new Date(year, month, 0, 23, 59, 59, 999);
    } else {
      rangeStart = new Date(year, 0, 1, 0, 0, 0, 0);
      rangeEnd = new Date(year, 11, 31, 23, 59, 59, 999);
    }
  }

  // Date range: for time-of-day filter we keep full-day range; we don't set hours on range here when startTime/endTime are present
  const hasTimeOfDay = startTime || endTime;
  if (!hasTimeOfDay) {
    if (rangeStart && startTime) {
      const [h, m, s = 0] = startTime.split(':').map(Number);
      rangeStart.setHours(h, m, s, 0);
    }
    if (rangeEnd && endTime) {
      const [h, m, s = 0] = endTime.split(':').map(Number);
      rangeEnd.setHours(h, m, s, 999);
    } else if (rangeEnd && !endTime) {
      rangeEnd.setHours(23, 59, 59, 999);
    }
  } else if (rangeEnd && !endTime) {
    rangeEnd.setHours(23, 59, 59, 999);
  }

  if (!rangeStart && !rangeEnd && !hasTimeOfDay) return undefined;

  const dateRange = {};
  if (rangeStart) dateRange.$gte = rangeStart;
  if (rangeEnd) dateRange.$lte = rangeEnd;
  const createdAtClause = Object.keys(dateRange).length ? { createdAt: dateRange } : null;

  // Time-of-day filter (UTC): only include transactions where time is between startTime and endTime
  if (hasTimeOfDay && (createdAtClause || rangeStart || rangeEnd)) {
    const startParts = (startTime || '00:00').split(':').map(Number);
    const endParts = (endTime || '23:59').split(':').map(Number);
    const startMinutes = (startParts[0] || 0) * 60 + (startParts[1] || 0);
    const endMinutes = (endParts[0] || 23) * 60 + (endParts[1] || 59);
    const timeOfDayExpr = {
      $and: [
        { $gte: [{ $add: [{ $multiply: [{ $hour: '$createdAt' }, 60] }, { $minute: '$createdAt' }] }, startMinutes] },
        { $lte: [{ $add: [{ $multiply: [{ $hour: '$createdAt' }, 60] }, { $minute: '$createdAt' }] }, endMinutes] },
      ],
    };
    const clauses = [];
    if (createdAtClause) clauses.push(createdAtClause);
    clauses.push({ $expr: timeOfDayExpr });
    return { $and: clauses };
  }

  return createdAtClause || undefined;
}

/**
 * POST /api/transactions
 * Body: identifier, amount, liters?, category, billNumber, paymentMode, ... pumpId optional for Staff.
 * Staff is assigned to a single pump: pumpId is taken from their assignment, not from body.
 * Admin/Manager must send pumpId.
 */
export const createTransaction = asyncHandler(async (req, res) => {
  const data = {
    ...req.validated,
    attachments: Array.isArray(req.s3Uploads?.attachments) ? req.s3Uploads.attachments : (req.validated?.attachments || []),
  };

  if (req.userType === ROLES.STAFF) {
    if (!req.allowedPumpIds || req.allowedPumpIds.length !== 1) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Staff must be assigned to exactly one pump to create transactions');
    }
    data.pumpId = req.allowedPumpIds[0];
  } else {
    if (!data.pumpId) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'pumpId is required for Admin/Manager');
    }
  }

  const transaction = await transactionService.createTransaction(
    data,
    req.user._id,
    req.allowedPumpIds
  );

  const pump = await pumpRepository.findById(transaction.pumpId);
  const pumpName = pump?.name || 'Petrol pump';
  const n = transaction.pointsEarned || 0;
  const pointsText = n === 1 ? '1 point' : `${n} points`;
  const customerMessage = `Thank you for Purchasing fuel at ${pumpName}. You earned ${pointsText}.`;

  try {
    await notificationService.sendToUsers(
      [transaction.userId],
      'Transaction successful',
      customerMessage
    );
  } catch (err) {
    console.warn('[Transaction] Push notification to customer failed:', err?.message);
  }

  const responseData = transaction?.toObject ? transaction.toObject() : transaction;
  return res.status(HTTP_STATUS.CREATED).json(
    ApiResponse.success(responseData, 'Transaction completed successfully')
  );
});

/**
 * GET /api/transactions
 * Admin: all transactions. Manager: only assigned pumps. Staff: only assigned pump.
 * Query: page?, limit?, pumpId?, userId?, category?, status?, startDate?, endDate?, month?, year?, startTime?, endTime?
 */
export const listTransactions = asyncHandler(async (req, res) => {
  const validated = req.validated || req.query;
  const { page, limit, pumpId, userId, category, status } = validated;
  let filter = {};
  if (pumpId) filter.pumpId = pumpId;
  if (userId) filter.userId = userId;
  if (category) filter.category = category;
  if (status) filter.status = status;
  const createdAt = buildCreatedAtFilter(validated);
  if (createdAt) {
    if (createdAt.$and) {
      filter = { $and: [filter, ...createdAt.$and] };
    } else {
      filter.createdAt = createdAt;
    }
  }

  const result = await transactionService.listTransactions(
    filter,
    {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    },
    req.allowedPumpIds
  );
  return res.sendPaginated(result, 'Transactions retrieved', HTTP_STATUS.OK);
});

/**
 * GET /api/transactions/pump/:pumpId
 * List all transactions for a specific pump. Admin: any pump. Manager/Staff: only their assigned pump(s).
 * Same query filters: page, limit, startDate, endDate, month, year, startTime, endTime, userId?, category?, status?
 */
export const listTransactionsByPump = asyncHandler(async (req, res) => {
  const { pumpId } = req.params;
  const validated = req.validated || req.query;
  const { page, limit, userId, category, status } = validated;

  if (req.allowedPumpIds !== null && !req.allowedPumpIds.map(String).includes(String(pumpId))) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied to this pump');
  }

  let filter = { pumpId };
  if (userId) filter.userId = userId;
  if (category) filter.category = category;
  if (status) filter.status = status;
  const createdAt = buildCreatedAtFilter(validated);
  if (createdAt) {
    if (createdAt.$and) {
      filter = { $and: [filter, ...createdAt.$and] };
    } else {
      filter.createdAt = createdAt;
    }
  }

  const result = await transactionService.listTransactions(
    filter,
    {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    },
    req.allowedPumpIds
  );
  return res.sendPaginated(result, 'Transactions retrieved', HTTP_STATUS.OK);
});

/**
 * GET /api/transactions/:transactionId
 * Manager/Staff (pump-scoped) or Admin.
 */
export const getTransactionById = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;
  const transaction = await transactionService.getTransactionById(
    transactionId,
    req.allowedPumpIds
  );
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(transaction, 'Transaction retrieved')
  );
});
