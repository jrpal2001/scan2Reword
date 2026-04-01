import { pointsLedgerRepository } from '../repositories/pointsLedger.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { managerRepository } from '../repositories/manager.repository.js';
import { staffRepository } from '../repositories/staff.repository.js';
import { systemConfigService } from './systemConfig.service.js';
import { USER_TYPES } from '../models/User.model.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/** Resolve owner document and update function by ownerType */
async function getOwnerAndUpdater(ownerId, ownerType) {
  let entity = null;
  let updateFn = null;
  if (ownerType === 'Manager') {
    entity = await managerRepository.findById(ownerId);
    updateFn = (id, data) => managerRepository.update(id, data);
  } else if (ownerType === 'Staff') {
    entity = await staffRepository.findById(ownerId);
    updateFn = (id, data) => staffRepository.update(id, data);
  } else {
    entity = await userRepository.findById(ownerId);
    updateFn = (id, data) => userRepository.update(id, data);
  }
  return { entity, updateFn };
}

/** Default rates when SystemConfig is unavailable */
const DEFAULT_POINTS = {
  fuel: { pointsPerLiter: 1 },
  lubricant: { pointsPer100Rupees: 5 },
  store: { pointsPer100Rupees: 5 },
  service: { pointsPer100Rupees: 5 },
};

// Points expiry duration - will be fetched from SystemConfig
let POINTS_EXPIRY_MONTHS = 12;

// Initialize expiry months from SystemConfig
(async () => {
  try {
    const config = await systemConfigService.getConfig();
    POINTS_EXPIRY_MONTHS = config.pointsExpiry?.durationMonths || 12;
  } catch (error) {
    console.warn('Could not load points expiry from SystemConfig, using default:', error.message);
  }
})();

export const pointsService = {
  /**
   * Calculate points for a transaction using SystemConfig (points.fuel.pointsPerLiter, etc.)
   * @param {string} category - Fuel, Lubricant, Store, Service
   * @param {number} amount - Transaction amount
   * @param {number} liters - Liters (required for Fuel)
   * @param {number} multiplier - Campaign multiplier (default 1)
   * @returns {Promise<number>} Points earned
   */
  async calculatePoints(category, amount, liters = null, multiplier = 1) {
    let pointsConfig = DEFAULT_POINTS;
    try {
      const config = await systemConfigService.getConfig();
      if (config?.points) {
        pointsConfig = {
          fuel: config.points.fuel && typeof config.points.fuel === 'object'
            ? { pointsPerLiter: config.points.fuel.pointsPerLiter ?? 1 }
            : { pointsPerLiter: 1 },
          lubricant: config.points.lubricant && typeof config.points.lubricant === 'object'
            ? { pointsPer100Rupees: config.points.lubricant.pointsPer100Rupees ?? 5 }
            : { pointsPer100Rupees: 5 },
          store: config.points.store && typeof config.points.store === 'object'
            ? { pointsPer100Rupees: config.points.store.pointsPer100Rupees ?? 5 }
            : { pointsPer100Rupees: 5 },
          service: config.points.service && typeof config.points.service === 'object'
            ? { pointsPer100Rupees: config.points.service.pointsPer100Rupees ?? 5 }
            : { pointsPer100Rupees: 5 },
        };
      }
    } catch (e) {
      // use DEFAULT_POINTS
    }

    const key = category.toLowerCase();
    let basePoints = 0;

    if (category === 'Fuel') {
      if (!liters || liters <= 0) return 0;
      const perLiter = pointsConfig.fuel?.pointsPerLiter ?? 1;
      basePoints = liters * perLiter;
      // Fuel: fractional points allowed (e.g. 0.5 per liter → 1.5 L = 0.75 points). Round to 2 decimals.
      return Math.round(basePoints * multiplier * 100) / 100;
    }
    if (key === 'lubricant' || key === 'store' || key === 'service') {
      const per100 = pointsConfig[key]?.pointsPer100Rupees ?? 5;
      basePoints = Math.floor((amount / 100) * per100);
    }

    return Math.floor(basePoints * multiplier);
  },

  /**
   * Credit points to owner (User, Manager, or Staff)
   * @param {Object} params
   * @param {string} params.userId - Owner ID
   * @param {string} params.ownerType - 'UserLoyalty' | 'Manager' | 'Staff' (default 'UserLoyalty')
   * @param {number} params.points - Points to credit
   * @param {string} params.type - 'credit' | 'adjustment' | 'refund'
   * @param {string} params.reason - Reason for credit
   * @param {string} params.transactionId - Transaction ID (optional)
   * @param {string} params.createdBy - Admin/Manager ID (optional)
   * @returns {Object} Ledger entry
   */
  async creditPoints({ userId, ownerType = 'UserLoyalty', points, type = 'credit', reason = null, transactionId = null, createdBy = null }) {
    if (points <= 0) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Points must be positive');
    }

    const { entity: user, updateFn } = await getOwnerAndUpdater(userId, ownerType);
    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Owner not found');
    }

    const currentBalance = user.walletSummary?.availablePoints || 0;
    const balanceAfter = currentBalance + points;

    // No points expiry: expiryDate always null
    const expiryDate = null;

    const ledgerEntry = await pointsLedgerRepository.create({
      userId,
      ownerType,
      transactionId,
      type,
      points,
      balanceAfter,
      expiryDate,
      reason: reason || `Points ${type}`,
      createdBy,
    });

    const updateData = {
      walletSummary: {
        totalEarned: (user.walletSummary?.totalEarned || 0) + (['credit', 'adjustment'].includes(type) ? points : 0),
        availablePoints: balanceAfter,
        redeemedPoints: user.walletSummary?.redeemedPoints || 0,
        expiredPoints: user.walletSummary?.expiredPoints || 0,
      },
    };
    if (type === 'expiry') {
      updateData.walletSummary.expiredPoints = (user.walletSummary?.expiredPoints || 0) + points;
      // Expiry shouldn't really use creditPoints, but if it does, handle totalEarned carefully.
      // Usually expiry is a debit. If it's a credit (e.g. restoring expired points), we might want to increase totalEarned.
    }

    await updateFn(userId, updateData);

    return ledgerEntry;
  },

  /**
   * Debit points from user (for redemption, expiry, etc.)
   * Creates ledger entry and updates wallet summary
   * @param {Object} params
   * @param {string} params.userId - User ID
   * @param {number} params.points - Points to debit
   * @param {string} params.type - 'debit' | 'expiry' | 'adjustment'
   * @param {string} params.reason - Reason for debit
   * @param {string} params.redemptionId - Redemption ID (optional)
   * @param {string} params.createdBy - Admin/Manager ID (optional)
   * @returns {Object} Ledger entry
   */
  async debitPoints({ userId, ownerType = 'UserLoyalty', points, type = 'debit', reason = null, redemptionId = null, createdBy = null }) {
    if (points <= 0) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Points must be positive');
    }

    const { entity: user, updateFn } = await getOwnerAndUpdater(userId, ownerType);
    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Owner not found');
    }

    const currentBalance = user.walletSummary?.availablePoints || 0;
    if (currentBalance < points) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Insufficient points balance');
    }

    const balanceAfter = currentBalance - points;

    const ledgerEntry = await pointsLedgerRepository.create({
      userId,
      ownerType,
      redemptionId,
      type,
      points: -points,
      balanceAfter,
      expiryDate: null,
      reason: reason || `Points ${type}`,
      createdBy,
    });

    await updateFn(userId, {
      walletSummary: {
        totalEarned: user.walletSummary?.totalEarned || 0,
        availablePoints: balanceAfter,
        redeemedPoints: (user.walletSummary?.redeemedPoints || 0) + (type === 'debit' ? points : 0),
        expiredPoints: (user.walletSummary?.expiredPoints || 0) + (type === 'expiry' ? points : 0),
      },
    });

    return ledgerEntry;
  },

  /**
   * Apply a points correction for a transaction edit (e.g. liters changed 10→5, so deduct 5 points).
   * Allows balance to go negative; only updates availablePoints (not totalEarned/redeemedPoints).
   * Used when admin/manager/staff corrects a transaction and the user may have already spent points.
   */
  async applyTransactionPointsCorrection({ userId, ownerType = 'UserLoyalty', pointsToDeduct, transactionId, reason = null, createdBy = null }) {
    if (pointsToDeduct <= 0) return null;
    const { entity: user, updateFn } = await getOwnerAndUpdater(userId, ownerType);
    if (!user) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Owner not found');
    const currentBalance = user.walletSummary?.availablePoints || 0;
    const balanceAfter = currentBalance - pointsToDeduct; // can be negative
    const ledgerEntry = await pointsLedgerRepository.create({
      userId,
      ownerType,
      transactionId,
      type: 'adjustment',
      points: -pointsToDeduct,
      balanceAfter,
      expiryDate: null,
      reason: reason || 'Transaction corrected (points reduced)',
      createdBy,
    });
    await updateFn(userId, {
      walletSummary: {
        totalEarned: Math.max(0, (user.walletSummary?.totalEarned || 0) - pointsToDeduct),
        availablePoints: balanceAfter,
        redeemedPoints: user.walletSummary?.redeemedPoints || 0,
        expiredPoints: user.walletSummary?.expiredPoints || 0,
      },
    });
    return ledgerEntry;
  },

  /**
   * Adjust user points when a transaction is edited (liters/points changed).
   * Delta > 0: credit extra points (type adjustment). Delta < 0: deduct points (adjustment, balance may go negative).
   */
  async adjustPointsForTransactionEdit({ userId, delta, transactionId, reason = null, createdBy = null }) {
    if (delta === 0) return null;
    if (delta > 0) {
      return await this.creditPoints({
        userId,
        points: delta,
        type: 'adjustment',
        reason: reason || 'Transaction corrected (points increased)',
        transactionId,
        createdBy,
      });
    }
    return await this.applyTransactionPointsCorrection({
      userId,
      pointsToDeduct: Math.abs(delta),
      transactionId,
      reason: reason || 'Transaction corrected (points reduced)',
      createdBy,
    });
  },

  /**
   * Get wallet summary and ledger for owner (User, Manager, or Staff)
   * @param {string} ownerId - Owner ID
   * @param {Object} options - { page, limit, ownerType: 'UserLoyalty' | 'Manager' | 'Staff' }
   * @returns {Object} Wallet summary and ledger
   */
  async getWallet(ownerId, options = {}) {
    const ownerType = options.ownerType || 'UserLoyalty';
    const { entity: user } = await getOwnerAndUpdater(ownerId, ownerType);
    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Owner not found');
    }

    const ledger = await pointsLedgerRepository.findByUserId(ownerId, { ...options, ownerType });

    const rawSummary = user.walletSummary || {
      totalEarned: 0,
      availablePoints: 0,
      redeemedPoints: 0,
      expiredPoints: 0,
    };

    // Reconcile totalEarned if it's lagging (due to old bugs or manual adjustments)
    // totalEarned should be the sum of what's available now, plus what's been spent/expired.
    const calculatedMinTotal = (rawSummary.availablePoints || 0) + (rawSummary.redeemedPoints || 0) + (rawSummary.expiredPoints || 0);
    if ((rawSummary.totalEarned || 0) < calculatedMinTotal) {
      rawSummary.totalEarned = calculatedMinTotal;
    }

    const result = {
      walletSummary: rawSummary,
      ledger,
    };

    // Fleet owner: include fleet summary (all drivers under this owner with their wallet)
    if (ownerType === 'UserLoyalty' && user.userType === USER_TYPES.OWNER) {
      const { list: drivers } = await userRepository.list({ ownerId }, { page: 1, limit: 500 });
      result.fleetSummary = await Promise.all(
        drivers.map(async (d) => {
          const w = await this.getWallet(d._id, { page: 1, limit: 1 });
          return {
            userId: d._id,
            fullName: d.fullName,
            mobile: d.mobile,
            walletSummary: w.walletSummary,
          };
        })
      );
    }

    return result;
  },
};
