import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { addISTToDocument, addISTToList } from '../utils/dateUtils.js';
import { pointsService } from '../services/points.service.js';
import { auditLogService } from '../services/auditLog.service.js';
import { ROLES } from '../constants/roles.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import { vehicleRepository } from '../repositories/vehicle.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import Transaction from '../models/Transaction.model.js';
import User, { USER_TYPES } from '../models/User.model.js';

/**
 * Consolidate ledger entries by transactionId/redemptionId.
 * Groups multiple events (e.g. original credit + adjustment) into one,
 * summing points and keeping metadata from the latest entry.
 */
function consolidateLedger(rawLedger) {
  if (!Array.isArray(rawLedger) || rawLedger.length === 0) return [];
  
  const consolidatedMap = new Map();
  // Sort descending by date to ensure the first one we see is the latest
  const sortedRaw = [...rawLedger].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

  sortedRaw.forEach(entry => {
    // Generate a unique key for grouping. If no ID, use entry ID as unique.
    const key = entry.transactionId ? `tx_${entry.transactionId}` : (entry.redemptionId ? `rd_${entry.redemptionId}` : `oth_${entry._id}`);
    
    if (consolidatedMap.has(key)) {
      const existing = consolidatedMap.get(key);
      // Sum the points. Adjustments for corrections will correctly update the total points for this transaction.
      existing.points += entry.points;
    } else {
      // First (latest) occurrence of this group
      consolidatedMap.set(key, { ...entry });
    }
  });

  return Array.from(consolidatedMap.values());
}

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

  // Consolidate and populate transaction details
  const consolidatedList = consolidateLedger(result.ledger?.list ?? []);
  const transactionIds = consolidatedList.map(e => e.transactionId).filter(Boolean);
  const transactions = transactionIds.length > 0
    ? await Transaction.find({ _id: { $in: transactionIds } }).lean()
    : [];
  const txMap = {};
  transactions.forEach(t => txMap[String(t._id)] = addISTToDocument(t));

  const finalLedger = consolidatedList.map(entry => {
    const entryIST = addISTToDocument(entry);
    if (entry.transactionId && txMap[String(entry.transactionId)]) {
      entryIST.transaction = txMap[String(entry.transactionId)];
    } else {
      entryIST.transaction = null;
    }
    return entryIST;
  });

  const data = {
    walletSummary: result.walletSummary,
    ledger: finalLedger,
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

/**
 * GET /api/user/wallet/:vehicleId
 * Public (no access token required).
 * Accepts vehicleId as param, resolves the userId from the vehicle,
 * returns wallet summary + ledger with full transaction details.
 * Query: page?, limit?
 */
export const getUserWallet = asyncHandler(async (req, res) => {
  const { vehicleId } = req.params;

  // 1. Find vehicle by ID
  const vehicle = await vehicleRepository.findById(vehicleId);
  if (!vehicle) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Vehicle not found');
  }

  const userId = vehicle.userId;

  // 2. Get wallet summary + ledger
  const { page = 1, limit = 10 } = req.query;
  const result = await pointsService.getWallet(String(userId), {
    page: parseInt(page),
    limit: parseInt(limit),
  });

  // 3. Consolidate ledger entries and fetch details
  const rawLedger = result.ledger?.list ?? [];
  const consolidatedList = consolidateLedger(rawLedger);

  // 4. Collect transactionIds and fetch details
  const transactionIds = consolidatedList
    .map((entry) => entry.transactionId)
    .filter(Boolean);

  const transactions = transactionIds.length > 0
    ? await Transaction.find({ _id: { $in: transactionIds } }).lean()
    : [];

  const txMap = {};
  transactions.forEach((tx) => {
    txMap[String(tx._id)] = addISTToDocument(tx);
  });

  // 5. Enrich consolidated ledger and apply IST
  const finalLedger = consolidatedList.map((entry) => {
    const entryWithIST = addISTToDocument(entry);
    if (entry.transactionId && txMap[String(entry.transactionId)]) {
      entryWithIST.transaction = txMap[String(entry.transactionId)];
    } else {
      entryWithIST.transaction = null;
    }
    return entryWithIST;
  });

  const data = {
    walletSummary: result.walletSummary,
    ledger: finalLedger,
    ...(result.fleetSummary != null && { fleetSummary: result.fleetSummary }),
  };

  return res.sendPaginatedMeta(data, result.ledger, 'User wallet retrieved', HTTP_STATUS.OK);
});

/**
 * GET /api/owner/wallet
 * Authenticated (access token required). Owner only.
 * Returns aggregated wallet summary across ALL drivers in the owner's fleet,
 * plus a single combined ledger with full transaction details.
 * Query: page?, limit?
 */
export const getOwnerWallet = asyncHandler(async (req, res) => {
  const ownerId = req.user._id;

  // 1. Verify the user is an owner
  const owner = await userRepository.findById(ownerId);
  if (!owner) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Owner not found');
  }

  const { page = 1, limit = 10 } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  // 2. Get all drivers under this owner
  const { list: drivers } = await userRepository.list({ ownerId }, { page: 1, limit: 500 });

  // Include the owner themselves as well
  const allUsers = [owner, ...drivers];
  const allUserIds = allUsers.map((u) => String(u._id));

  // 3. Aggregate total wallet summary from all users
  const totalWalletSummary = {
    totalEarned: 0,
    availablePoints: 0,
    redeemedPoints: 0,
    expiredPoints: 0,
  };

  for (const user of allUsers) {
    const ws = user.walletSummary || {};
    totalWalletSummary.totalEarned += ws.totalEarned || 0;
    totalWalletSummary.availablePoints += ws.availablePoints || 0;
    totalWalletSummary.redeemedPoints += ws.redeemedPoints || 0;
    totalWalletSummary.expiredPoints += ws.expiredPoints || 0;
  }

  // 4. Get combined ledger entries across all users (paginated, sorted newest first)
  const { pointsLedgerRepository } = await import('../repositories/pointsLedger.repository.js');
  const ledgerResult = await pointsLedgerRepository.list(
    { userId: { $in: allUserIds }, ownerType: 'UserLoyalty' },
    { page: pageNum, limit: limitNum, sort: { createdAt: -1 } }
  );

  const ledgerList = ledgerResult.list ?? [];

  // 5. Consolidate and fetch transaction details
  const consolidatedList = consolidateLedger(ledgerList);

  const transactionIds = consolidatedList
    .map((entry) => entry.transactionId)
    .filter(Boolean);

  const transactions = transactionIds.length > 0
    ? await Transaction.find({ _id: { $in: transactionIds } }).lean()
    : [];

  const txMap = {};
  transactions.forEach((tx) => {
    txMap[String(tx._id)] = addISTToDocument(tx);
  });

  // 6. Enrich consolidated ledger entries with full transaction objects
  const enrichedLedger = consolidatedList.map((entry) => {
    const entryWithIST = addISTToDocument(entry);
    if (entry.transactionId && txMap[String(entry.transactionId)]) {
      entryWithIST.transaction = txMap[String(entry.transactionId)];
    } else {
      entryWithIST.transaction = null;
    }
    return entryWithIST;
  });

  const data = {
    totalWalletSummary,
    ledger: enrichedLedger,
  };

  return res.sendPaginatedMeta(data, ledgerResult, 'Owner wallet retrieved', HTTP_STATUS.OK);
});
