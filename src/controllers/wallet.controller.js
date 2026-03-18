import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { addISTToDocument, addISTToList } from '../utils/dateUtils.js';
import { pointsService } from '../services/points.service.js';
import { auditLogService } from '../services/auditLog.service.js';
import { ROLES } from '../constants/roles.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * GET /api/users/:userId/wallet
 * Query: page?, limit?
 * Returns wallet summary and ledger entries.
 * Driver/individual: only own wallet. Owner: own wallet + fleetSummary (all drivers under this owner with their points).
 */
export const getWallet = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const role = (req.userType || req.user?.role || '').toLowerCase();
  
  // User (customer) can only access own wallet; admin/manager/staff can access any
  if (role === ROLES.USER && String(userId) !== String(req.user._id)) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied to this wallet');
  }

  const { page = 1, limit = 10 } = req.query;
  const result = await pointsService.getWallet(userId, {
    page: parseInt(page),
    limit: parseInt(limit),
  });

  const data = {
    walletSummary: result.walletSummary,
    ledger: result.ledger?.list ?? [],
    ...(result.fleetSummary != null && { fleetSummary: result.fleetSummary }),
  };
  return res.sendPaginatedMeta(data, result.ledger, 'Wallet retrieved', HTTP_STATUS.OK);
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

  // Get wallet before adjustment for audit log
  const walletBefore = await pointsService.getWallet(userId, { page: 1, limit: 1 });

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

  // Get wallet after adjustment for audit log
  const walletAfter = await pointsService.getWallet(userId, { page: 1, limit: 1 });

  // Log audit
  await auditLogService.log({
    userId: req.user._id,
    action: 'wallet.adjust',
    entityType: 'Wallet',
    entityId: userId,
    before: { availablePoints: walletBefore.walletSummary.availablePoints },
    after: { availablePoints: walletAfter.walletSummary.availablePoints },
    metadata: { points, type, reason },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(addISTToDocument(ledgerEntry), 'Wallet adjusted successfully')
  );
});

/**
 * POST /api/admin/referrals/redeem
 * Body: { ownerId, ownerType: 'Manager'|'Staff', points, reason? }
 * Admin only. Debits points from the manager/staff wallet (referral earnings).
 */
export const redeemEmployeePoints = asyncHandler(async (req, res) => {
  const { ownerId, ownerType, points, reason } = req.validated;

  const walletBefore = await pointsService.getWallet(ownerId, { ownerType, page: 1, limit: 1 });
  const ledgerEntry = await pointsService.debitPoints({
    userId: ownerId,
    ownerType,
    points,
    type: 'debit',
    reason: reason || `Referral points redeemed by admin`,
    createdBy: req.user._id,
  });
  const walletAfter = await pointsService.getWallet(ownerId, { ownerType, page: 1, limit: 1 });

  await auditLogService.log({
    userId: req.user._id,
    action: 'referrals.redeem',
    entityType: ownerType,
    entityId: ownerId,
    before: { availablePoints: walletBefore.walletSummary.availablePoints },
    after: { availablePoints: walletAfter.walletSummary.availablePoints },
    metadata: { ownerType, points, reason: reason || null },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(addISTToDocument(ledgerEntry), 'Employee points redeemed successfully')
  );
});
