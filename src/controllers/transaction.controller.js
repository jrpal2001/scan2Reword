import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { transactionService } from '../services/transaction.service.js';
import { ROLES } from '../constants/roles.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

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
  return res.status(HTTP_STATUS.CREATED).json(
    ApiResponse.success(transaction, 'Transaction created successfully')
  );
});

/**
 * GET /api/transactions
 * Query: page?, limit?, pumpId?, userId?, category?, status?, startDate?, endDate?
 * Manager/Staff (pump-scoped) or Admin (all).
 */
export const listTransactions = asyncHandler(async (req, res) => {
  const { page, limit, pumpId, userId, category, status, startDate, endDate } = req.query;
  const filter = {};
  if (pumpId) filter.pumpId = pumpId;
  if (userId) filter.userId = userId;
  if (category) filter.category = category;
  if (status) filter.status = status;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const result = await transactionService.listTransactions(
    filter,
    {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
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
