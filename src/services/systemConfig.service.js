import { systemConfigRepository } from '../repositories/systemConfig.repository.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

export const systemConfigService = {
  /**
   * Get system configuration
   */
  async getConfig() {
    let config = await systemConfigRepository.getConfig();
    const points = typeof config?.points?.toObject === 'function' ? config.points.toObject() : config?.points;

    // One-time cleanup for legacy documents that still carry deprecated keys.
    if (points && ('registration' in points || 'other' in points)) {
      const cleanedPoints = { ...points };
      if ('other' in cleanedPoints) delete cleanedPoints.other;
      if ('registration' in cleanedPoints) delete cleanedPoints.registration;
      config = await systemConfigRepository.updateConfig({ points: cleanedPoints });
    }

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

    // Remove unsupported/deprecated points keys
    if (data.points) {
      const source = typeof data.points?.toObject === 'function' ? data.points.toObject() : data.points;
      const cleanedPoints = { ...(source || {}) };
      if ('other' in cleanedPoints) delete cleanedPoints.other;
      if ('registration' in cleanedPoints) delete cleanedPoints.registration;
      data.points = cleanedPoints;
    }

    const updated = await systemConfigRepository.updateConfig(data);
    return updated;
  },
};
