import { redemptionRepository } from '../repositories/redemption.repository.js';
import { rewardRepository } from '../repositories/reward.repository.js';
import { pointsService } from './points.service.js';
import { scanService } from './scan.service.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import { REDEMPTION_STATUS } from '../constants/status.js';

/**
 * Generate unique redemption code (e.g. RED + 8 digits)
 */
function generateRedemptionCode() {
  const prefix = 'RED';
  const randomDigits = Math.floor(10000000 + Math.random() * 90000000).toString();
  return `${prefix}${randomDigits}`;
}

export const redemptionService = {
  /**
   * Create redemption (user-initiated)
   * @param {Object} params
   * @param {string} params.userId - User ID
   * @param {string} params.rewardId - Reward ID
   * @returns {Object} Redemption record
   */
  async createRedemption({ userId, rewardId }) {
    // Get reward
    const reward = await rewardRepository.findById(rewardId);
    if (!reward) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Reward not found');
    }

    // Check reward availability
    const now = new Date();
    if (reward.status !== 'active') {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Reward is not active');
    }
    if (new Date(reward.validFrom) > now || new Date(reward.validUntil) < now) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Reward is not valid at this time');
    }
    if (reward.availability === 'limited' && reward.redeemedQuantity >= reward.totalQuantity) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Reward is out of stock');
    }

    // Check user balance
    const user = await pointsService.getWallet(userId, { page: 1, limit: 1 });
    const availablePoints = user.walletSummary.availablePoints;
    if (availablePoints < reward.pointsRequired) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Insufficient points balance');
    }

    // Generate unique redemption code
    let redemptionCode;
    let exists = true;
    while (exists) {
      redemptionCode = generateRedemptionCode();
      const existing = await redemptionRepository.findByRedemptionCode(redemptionCode);
      exists = !!existing;
    }

    // Calculate expiry date (30 days from now)
    const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Create redemption record
    const redemption = await redemptionRepository.create({
      userId,
      rewardId,
      pointsUsed: reward.pointsRequired,
      redemptionCode,
      status: REDEMPTION_STATUS.PENDING,
      expiryDate,
    });

    // Deduct points from user
    await pointsService.debitPoints({
      userId,
      points: reward.pointsRequired,
      type: 'debit',
      reason: `Redeemed reward: ${reward.name}`,
      redemptionId: redemption._id,
    });

    // Update reward redeemed quantity
    await rewardRepository.update(rewardId, {
      redeemedQuantity: (reward.redeemedQuantity || 0) + 1,
    });

    return redemption;
  },

  /**
   * At-pump redemption (manager/staff initiated)
   * @param {Object} params
   * @param {string} params.identifier - loyaltyId, owner ID, or mobile
   * @param {number} params.pointsToDeduct - Points to deduct
   * @param {string} params.operatorId - Manager/Staff ID
   * @param {string} params.pumpId - Pump ID
   * @returns {Object} Redemption record
   */
  async createAtPumpRedemption({ identifier, pointsToDeduct, operatorId, pumpId }) {
    // Validate identifier and get user
    const { user } = await scanService.validateIdentifier(identifier);

    // Check user balance
    const wallet = await pointsService.getWallet(user._id, { page: 1, limit: 1 });
    const availablePoints = wallet.walletSummary.availablePoints;
    if (availablePoints < pointsToDeduct) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Insufficient points balance');
    }

    // Generate unique redemption code
    let redemptionCode;
    let exists = true;
    while (exists) {
      redemptionCode = generateRedemptionCode();
      const existing = await redemptionRepository.findByRedemptionCode(redemptionCode);
      exists = !!existing;
    }

    // Calculate expiry date (30 days from now)
    const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Create redemption record (no rewardId for at-pump redemption)
    const redemption = await redemptionRepository.create({
      userId: user._id,
      rewardId: null, // At-pump redemption doesn't require a reward
      pointsUsed: pointsToDeduct,
      redemptionCode,
      status: REDEMPTION_STATUS.APPROVED, // Auto-approved for at-pump
      approvedBy: operatorId,
      usedAtPump: pumpId,
      expiryDate,
    });

    // Deduct points from user
    await pointsService.debitPoints({
      userId: user._id,
      points: pointsToDeduct,
      type: 'debit',
      reason: `At-pump redemption at pump ${pumpId}`,
      redemptionId: redemption._id,
      createdBy: operatorId,
    });

    // Get updated wallet balance to show to staff/manager
    const updatedWallet = await pointsService.getWallet(user._id, { page: 1, limit: 1 });

    return {
      redemption,
      wallet: updatedWallet.walletSummary,
      user: {
        _id: user._id,
        fullName: user.fullName,
        mobile: user.mobile,
      },
    };
  },

  /**
   * Approve redemption (manager)
   */
  async approveRedemption(redemptionId, managerId) {
    const redemption = await redemptionRepository.findById(redemptionId);
    if (!redemption) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Redemption not found');
    }

    if (redemption.status !== REDEMPTION_STATUS.PENDING) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Redemption is not pending');
    }

    const updated = await redemptionRepository.update(redemptionId, {
      status: REDEMPTION_STATUS.APPROVED,
      approvedBy: managerId,
    });

    return updated;
  },

  /**
   * Reject redemption (manager)
   */
  async rejectRedemption(redemptionId, managerId, reason = null) {
    const redemption = await redemptionRepository.findById(redemptionId);
    if (!redemption) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Redemption not found');
    }

    if (redemption.status !== REDEMPTION_STATUS.PENDING) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Redemption is not pending');
    }

    // Refund points to user
    await pointsService.creditPoints({
      userId: redemption.userId,
      points: redemption.pointsUsed,
      type: 'refund',
      reason: `Redemption rejected: ${reason || 'No reason provided'}`,
      redemptionId: redemption._id,
      createdBy: managerId,
    });

    // Update redemption status
    const updated = await redemptionRepository.update(redemptionId, {
      status: REDEMPTION_STATUS.REJECTED,
      rejectedReason: reason,
    });

    // Update reward redeemed quantity (decrement)
    if (redemption.rewardId) {
      const reward = await rewardRepository.findById(redemption.rewardId);
      if (reward) {
        await rewardRepository.update(redemption.rewardId, {
          redeemedQuantity: Math.max(0, (reward.redeemedQuantity || 0) - 1),
        });
      }
    }

    return updated;
  },

  /**
   * Verify redemption code
   */
  async verifyRedemptionCode(code) {
    const redemption = await redemptionRepository.findByRedemptionCode(code);
    if (!redemption) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Invalid redemption code');
    }

    const now = new Date();
    if (new Date(redemption.expiryDate) < now) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Redemption code has expired');
    }

    if (redemption.status !== REDEMPTION_STATUS.APPROVED && redemption.status !== REDEMPTION_STATUS.ACTIVE) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, `Redemption code is ${redemption.status}`);
    }

    return redemption;
  },

  /**
   * Mark redemption as used
   */
  async markAsUsed(redemptionId, pumpId) {
    const redemption = await redemptionRepository.findById(redemptionId);
    if (!redemption) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Redemption not found');
    }

    if (redemption.status === REDEMPTION_STATUS.USED) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Redemption code already used');
    }

    const updated = await redemptionRepository.update(redemptionId, {
      status: REDEMPTION_STATUS.USED,
      usedAtPump: pumpId,
      usedAt: new Date(),
    });

    return updated;
  },

  /**
   * Get redemption by ID
   */
  async getRedemptionById(redemptionId) {
    const redemption = await redemptionRepository.findById(redemptionId);
    if (!redemption) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Redemption not found');
    }
    return redemption;
  },

  /**
   * List redemptions
   */
  async listRedemptions(filter = {}, options = {}) {
    return redemptionRepository.list(filter, options);
  },
};
