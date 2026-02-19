import { rewardRepository } from '../repositories/reward.repository.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

export const rewardService = {
  async createReward(data) {
    // Validate dates
    if (new Date(data.validFrom) >= new Date(data.validUntil)) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Valid until must be after valid from');
    }

    // Validate availability
    if (data.availability === 'limited' && (!data.totalQuantity || data.totalQuantity <= 0)) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Total quantity is required for limited availability');
    }

    const reward = await rewardRepository.create({
      ...data,
      redeemedQuantity: 0,
      status: data.status || 'active',
    });

    return reward;
  },

  async updateReward(rewardId, data) {
    const existing = await rewardRepository.findById(rewardId);
    if (!existing) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Reward not found');
    }

    // Validate dates if provided
    if (data.validFrom || data.validUntil) {
      const validFrom = data.validFrom ? new Date(data.validFrom) : new Date(existing.validFrom);
      const validUntil = data.validUntil ? new Date(data.validUntil) : new Date(existing.validUntil);
      if (validFrom >= validUntil) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Valid until must be after valid from');
      }
    }

    const reward = await rewardRepository.update(rewardId, data);
    return reward;
  },

  async deleteReward(rewardId) {
    const existing = await rewardRepository.findById(rewardId);
    if (!existing) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Reward not found');
    }

    await rewardRepository.delete(rewardId);
    return { success: true };
  },

  async getRewardById(rewardId) {
    const reward = await rewardRepository.findById(rewardId);
    if (!reward) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Reward not found');
    }
    return reward;
  },

  async listRewards(filter = {}, options = {}) {
    return rewardRepository.list(filter, options);
  },

  /**
   * Get available rewards (for public endpoint)
   */
  async getAvailableRewards(pumpId = null) {
    return rewardRepository.findAvailableRewards(pumpId);
  },
};
