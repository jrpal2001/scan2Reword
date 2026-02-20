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

    // Normalize points configuration - convert number format to object format
    if (data.points) {
      const normalizedPoints = { ...data.points };
      
      // Convert fuel from number to object format if needed
      if (typeof normalizedPoints.fuel === 'number') {
        normalizedPoints.fuel = { pointsPerLiter: normalizedPoints.fuel };
      }
      
      // Convert lubricant from number to object format if needed
      if (typeof normalizedPoints.lubricant === 'number') {
        normalizedPoints.lubricant = { pointsPer100Rupees: normalizedPoints.lubricant };
      }
      
      // Convert store from number to object format if needed
      if (typeof normalizedPoints.store === 'number') {
        normalizedPoints.store = { pointsPer100Rupees: normalizedPoints.store };
      }
      
      // Convert service from number to object format if needed
      if (typeof normalizedPoints.service === 'number') {
        normalizedPoints.service = { pointsPer100Rupees: normalizedPoints.service };
      }
      
      // Remove 'other' field if present (not in schema)
      if ('other' in normalizedPoints) {
        delete normalizedPoints.other;
      }
      
      data.points = normalizedPoints;
    }

    const updated = await systemConfigRepository.updateConfig(data);
    return updated;
  },
};
