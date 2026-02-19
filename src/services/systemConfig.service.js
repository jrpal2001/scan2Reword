import { systemConfigRepository } from '../repositories/systemConfig.repository.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

export const systemConfigService = {
  /**
   * Get system configuration
   */
  async getConfig() {
    const config = await systemConfigRepository.getConfig();
    return config;
  },

  /**
   * Update system configuration (admin only)
   */
  async updateConfig(data) {
    // Validate notificationDays if provided
    if (data.pointsExpiry?.notificationDays) {
      const days = data.pointsExpiry.notificationDays;
      if (!Array.isArray(days) || days.some((d) => typeof d !== 'number' || d < 0)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'notificationDays must be an array of non-negative numbers');
      }
    }

    const updated = await systemConfigRepository.updateConfig(data);
    return updated;
  },
};
