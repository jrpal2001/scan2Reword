import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { pointsService } from '../services/points.service.js';
import { ROLES } from '../constants/roles.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * GET /api/users/:userId/wallet
 * Query: page?, limit?
 * Returns wallet summary and ledger entries.
 */
export const getWallet = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const role = (req.userType || req.user?.role || '').toLowerCase();
  
  // User can only access own wallet; admin/manager/staff can access any
  if (role === ROLES.USER && String(userId) !== String(req.user._id)) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied to this wallet');
  }

  const { page = 1, limit = 20 } = req.query;
  const result = await pointsService.getWallet(userId, {
    page: parseInt(page),
    limit: parseInt(limit),
  });

  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(result, 'Wallet retrieved')
  );
});

/**
 * POST /api/admin/wallet/adjust or POST /api/manager/wallet/adjust
 * Body: { userId, points, type: 'credit'|'debit', reason }
 * Admin/Manager only. Manager pump-scoped.
 */
export const adjustWallet = asyncHandler(async (req, res) => {
  const { userId, points, type, reason } = req.validated;
  const role = (req.userType || req.user?.role || '').toLowerCase();

  // Validate user exists and manager can access (if needed)
  // TODO: Add pump scope check for manager if needed

  let ledgerEntry;
  if (type === 'credit' || type === 'adjustment' || type === 'refund') {
    ledgerEntry = await pointsService.creditPoints({
      userId,
      points,
      type: type === 'credit' ? 'credit' : type,
      reason: reason || `Manual ${type} by ${role}`,
      createdBy: req.user._id,
    });
  } else if (type === 'debit' || type === 'expiry') {
    ledgerEntry = await pointsService.debitPoints({
      userId,
      points,
      type: type === 'debit' ? 'debit' : 'expiry',
      reason: reason || `Manual ${type} by ${role}`,
      createdBy: req.user._id,
    });
  } else {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid adjustment type');
  }

  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(ledgerEntry, 'Wallet adjusted successfully')
  );
});
