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

    // Create redemption record as PENDING - admin must approve before points are deducted
    const redemption = await redemptionRepository.create({
      userId: user._id,
      rewardId: null,
      pointsUsed: pointsToDeduct,
      redemptionCode,
      status: REDEMPTION_STATUS.PENDING,
      approvedBy: null,
      usedAtPump: pumpId,
      expiryDate,
    });

    // Do NOT deduct points here - points deducted when admin approves

    return {
      redemption,
      wallet: wallet.walletSummary,
      user: {
        _id: user._id,
        fullName: user.fullName,
        mobile: user.mobile,
      },
    };
  },

  /**
   * Approve redemption (admin). Deducts points from user when approving.
   */
  async approveRedemption(redemptionId, approverId) {
    const redemption = await redemptionRepository.findById(redemptionId);
    if (!redemption) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Redemption not found');
    }

    if (redemption.status !== REDEMPTION_STATUS.PENDING) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Redemption is not pending');
    }

    // Deduct points on approval (manager/staff create PENDING; admin approves and points are deducted here)
    await pointsService.debitPoints({
      userId: redemption.userId,
      ownerType: 'UserLoyalty',
      points: redemption.pointsUsed,
      type: 'debit',
      reason: `Redemption approved (was pending)`,
      redemptionId: redemption._id,
      createdBy: approverId,
    });

    const updated = await redemptionRepository.update(redemptionId, {
      status: REDEMPTION_STATUS.APPROVED,
      approvedBy: approverId,
    });

    return updated;
  },

  /**
   * Admin direct redeem: create redemption and deduct points immediately (no approval needed).
   */
  async createDirectRedemption({ userId, pointsToDeduct, adminId }) {
    const user = await pointsService.getWallet(userId, { page: 1, limit: 1 });
    const availablePoints = user.walletSummary?.availablePoints || 0;
    if (availablePoints < pointsToDeduct) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Insufficient points balance');
    }

    let redemptionCode;
    let exists = true;
    while (exists) {
      redemptionCode = generateRedemptionCode();
      const existing = await redemptionRepository.findByRedemptionCode(redemptionCode);
      exists = !!existing;
    }

    const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const redemption = await redemptionRepository.create({
      userId,
      rewardId: null,
      pointsUsed: pointsToDeduct,
      redemptionCode,
      status: REDEMPTION_STATUS.APPROVED,
      approvedBy: adminId,
      usedAtPump: null,
      expiryDate,
    });

    await pointsService.debitPoints({
      userId,
      ownerType: 'UserLoyalty',
      points: pointsToDeduct,
      type: 'debit',
      reason: 'Direct redemption by admin',
      redemptionId: redemption._id,
      createdBy: adminId,
    });

    return redemption;
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
