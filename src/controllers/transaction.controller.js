import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { transactionService } from '../services/transaction.service.js';
import { ROLES } from '../constants/roles.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import { addISTToDocument, buildCreatedAtFilter } from '../utils/dateUtils.js';
import { generateUserStatementPdf } from '../utils/pdfStatement.js';

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
    } else if (createdAt.createdAt) {
      filter.createdAt = createdAt.createdAt;
    }
  }

  const result = await transactionService.listTransactions(
    filter,
    {
      page: Number(page) || 1,
      limit: Number(limit) || 10,
    },
    req.allowedPumpIds
  );
  return res.sendPaginated(result, 'Transactions retrieved', HTTP_STATUS.OK);
});

/**
 * GET /api/transactions/statement/download
 * Download user transactions statement as PDF.
 * Query: userId (required), startDate?, endDate?, startTime?, endTime?
 */
export const downloadUserStatement = asyncHandler(async (req, res) => {
  const validated = req.validated || req.query;
  const statementData = await transactionService.getUserTransactionsStatement(validated, req.allowedPumpIds);
  const pdfBuffer = await generateUserStatementPdf(statementData);
  const fileName = `statement-${validated.userId}-${Date.now()}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Length', pdfBuffer.length);

  return res.status(HTTP_STATUS.OK).send(pdfBuffer);
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
    } else if (createdAt.createdAt) {
      filter.createdAt = createdAt.createdAt;
    }
  }

  const result = await transactionService.listTransactions(
    filter,
    {
      page: Number(page) || 1,
      limit: Number(limit) || 10,
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
  const transactionWithIST = addISTToDocument(transaction);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(transactionWithIST, 'Transaction retrieved')
  );
});

/**
 * PATCH /api/transactions/:transactionId
 * Update transaction (correct liters or amount). Points are recalculated; user wallet is adjusted.
 * If user already spent points, balance can go negative; next purchase will add points and reduce the deficit.
 * Admin/Manager/Staff only (pump-scoped).
 */
export const updateTransaction = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;
  const data = req.validated || req.body;
  const updated = await transactionService.updateTransaction(
    transactionId,
    data,
    req.allowedPumpIds,
    req.user._id
  );
  const withIST = addISTToDocument(updated);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(withIST, 'Transaction updated successfully')
  );
});
