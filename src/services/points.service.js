import { pointsLedgerRepository } from '../repositories/pointsLedger.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { systemConfigService } from './systemConfig.service.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * Points calculation service
 * TODO: Move rates to SystemConfig model
 */
const POINTS_CONFIG = {
  Fuel: {
    pointsPerLiter: 1, // 1 point per liter (configurable)
  },
  Lubricant: {
    pointsPer100Rupees: 5, // 5 points per ₹100 (configurable)
  },
  Store: {
    pointsPer100Rupees: 5, // 5 points per ₹100
  },
  Service: {
    pointsPer100Rupees: 5, // 5 points per ₹100
  },
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
   * Calculate points for a transaction
   * @param {string} category - Fuel, Lubricant, Store, Service
   * @param {number} amount - Transaction amount
   * @param {number} liters - Liters (required for Fuel)
   * @param {number} multiplier - Campaign multiplier (default 1)
   * @returns {number} Points earned
   */
  calculatePoints(category, amount, liters = null, multiplier = 1) {
    const config = POINTS_CONFIG[category];
    if (!config) {
      return 0;
    }

    let basePoints = 0;

    if (category === 'Fuel') {
      if (!liters || liters <= 0) {
        return 0;
      }
      basePoints = liters * config.pointsPerLiter;
    } else {
      // Lubricant, Store, Service: points per ₹100
      basePoints = Math.floor((amount / 100) * config.pointsPer100Rupees);
    }

    // Apply campaign multiplier
    return Math.floor(basePoints * multiplier);
  },

  /**
   * Credit points to user (from transaction, referral, etc.)
   * Creates ledger entry and updates wallet summary
   * @param {Object} params
   * @param {string} params.userId - User ID
   * @param {number} params.points - Points to credit
   * @param {string} params.type - 'credit' | 'adjustment' | 'refund'
   * @param {string} params.reason - Reason for credit
   * @param {string} params.transactionId - Transaction ID (optional)
   * @param {string} params.createdBy - Admin/Manager ID (optional)
   * @returns {Object} Ledger entry
   */
  async creditPoints({ userId, points, type = 'credit', reason = null, transactionId = null, createdBy = null }) {
    if (points <= 0) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Points must be positive');
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
    }

    const currentBalance = user.walletSummary?.availablePoints || 0;
    const balanceAfter = currentBalance + points;

    // Get expiry duration from SystemConfig
    let expiryMonths = POINTS_EXPIRY_MONTHS;
    try {
      const config = await systemConfigService.getConfig();
      expiryMonths = config.pointsExpiry?.durationMonths || 12;
    } catch (error) {
      // Use default if config fetch fails
    }

    // Calculate expiry date (from SystemConfig, default 12 months)
    const expiryDate = type === 'credit' ? new Date(Date.now() + expiryMonths * 30 * 24 * 60 * 60 * 1000) : null;

    // Create ledger entry
    const ledgerEntry = await pointsLedgerRepository.create({
      userId,
      transactionId,
      type,
      points,
      balanceAfter,
      expiryDate,
      reason: reason || `Points ${type}`,
      createdBy,
    });

    // Update wallet summary
    const updateData = {
      walletSummary: {
        totalEarned: (user.walletSummary?.totalEarned || 0) + (type === 'credit' ? points : 0),
        availablePoints: balanceAfter,
        redeemedPoints: user.walletSummary?.redeemedPoints || 0,
        expiredPoints: user.walletSummary?.expiredPoints || 0,
      },
    };

    // If this is an expiry, increment expiredPoints
    if (type === 'expiry') {
      updateData.walletSummary.expiredPoints = (user.walletSummary?.expiredPoints || 0) + points;
    }

    await userRepository.update(userId, updateData);

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
  async debitPoints({ userId, points, type = 'debit', reason = null, redemptionId = null, createdBy = null }) {
    if (points <= 0) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Points must be positive');
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
    }

    const currentBalance = user.walletSummary?.availablePoints || 0;
    if (currentBalance < points) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Insufficient points balance');
    }

    const balanceAfter = currentBalance - points;

    // Create ledger entry (points stored as negative for debit)
    const ledgerEntry = await pointsLedgerRepository.create({
      userId,
      redemptionId,
      type,
      points: -points, // Negative for debit
      balanceAfter,
      expiryDate: null,
      reason: reason || `Points ${type}`,
      createdBy,
    });

    // Update wallet summary
    await userRepository.update(userId, {
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
   * Get wallet summary and ledger for user
   * @param {string} userId
   * @param {Object} options - Pagination options
   * @returns {Object} Wallet summary and ledger
   */
  async getWallet(userId, options = {}) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
    }

    const ledger = await pointsLedgerRepository.findByUserId(userId, options);

    return {
      walletSummary: user.walletSummary || {
        totalEarned: 0,
        availablePoints: 0,
        redeemedPoints: 0,
        expiredPoints: 0,
      },
      ledger,
    };
  },
};
