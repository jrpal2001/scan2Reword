import { bannerRepository } from '../repositories/banner.repository.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import { ROLES } from '../constants/roles.js';

export const bannerService = {
  async createBanner(data, userId, userRole, allowedPumpIds = null) {
    // Validate pumpIds for manager
    if (userRole === ROLES.MANAGER) {
      if (!data.pumpIds || data.pumpIds.length === 0) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Manager must assign banner to at least one pump');
      }
      // Ensure all pumpIds are in manager's allowed pumps
      const allowed = (allowedPumpIds || []).map((id) => String(id));
      const requested = data.pumpIds.map((id) => String(id));
      const invalid = requested.filter((id) => !allowed.includes(id));
      if (invalid.length > 0) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied to one or more pumps');
      }
    }

    // Validate dates
    if (new Date(data.startTime) >= new Date(data.endTime)) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'End time must be after start time');
    }

    const banner = await bannerRepository.create({
      ...data,
      createdBy: userId,
      createdByRole: userRole,
      status: data.status || 'active',
    });

    return banner;
  },

  async updateBanner(bannerId, data, userId, userRole, allowedPumpIds = null) {
    const existing = await bannerRepository.findById(bannerId);
    if (!existing) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Banner not found');
    }

    // Check ownership/access
    if (userRole === ROLES.MANAGER && String(existing.createdBy) !== String(userId)) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied to this banner');
    }

    // Validate pumpIds for manager
    if (userRole === ROLES.MANAGER && data.pumpIds !== undefined) {
      if (!data.pumpIds || data.pumpIds.length === 0) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Manager must assign banner to at least one pump');
      }
      const allowed = (allowedPumpIds || []).map((id) => String(id));
      const requested = data.pumpIds.map((id) => String(id));
      const invalid = requested.filter((id) => !allowed.includes(id));
      if (invalid.length > 0) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied to one or more pumps');
      }
    }

    // Validate dates if provided
    if (data.startTime || data.endTime) {
      const startTime = data.startTime ? new Date(data.startTime) : new Date(existing.startTime);
      const endTime = data.endTime ? new Date(data.endTime) : new Date(existing.endTime);
      if (startTime >= endTime) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'End time must be after start time');
      }
    }

    const banner = await bannerRepository.update(bannerId, data);
    return banner;
  },

  async deleteBanner(bannerId, userId, userRole) {
    const existing = await bannerRepository.findById(bannerId);
    if (!existing) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Banner not found');
    }

    // Check ownership/access
    if (userRole === ROLES.MANAGER && String(existing.createdBy) !== String(userId)) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied to this banner');
    }

    await bannerRepository.delete(bannerId);
    return { success: true };
  },

  async getBannerById(bannerId, userId, userRole, allowedPumpIds = null) {
    const banner = await bannerRepository.findById(bannerId);
    if (!banner) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Banner not found');
    }

    // Check pump access for manager
    if (userRole === ROLES.MANAGER && allowedPumpIds !== null) {
      const allowed = allowedPumpIds.map((id) => String(id));
      const bannerPumps = banner.pumpIds.map((id) => String(id));
      const hasAccess = banner.pumpIds.length === 0 || bannerPumps.some((id) => allowed.includes(id));
      if (!hasAccess && String(banner.createdBy) !== String(userId)) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied to this banner');
      }
    }

    return banner;
  },

  async listBanners(filter = {}, options = {}, userId, userRole, allowedPumpIds = null) {
    // Apply pump scope for manager
    if (userRole === ROLES.MANAGER && allowedPumpIds !== null) {
      filter.$or = [
        { pumpIds: { $size: 0 } }, // Global banners
        { pumpIds: { $in: allowedPumpIds } }, // Banners for manager's pumps
        { createdBy: userId }, // Banners created by this manager
      ];
    }

    return bannerRepository.list(filter, options);
  },

  /**
   * Get active banners (public endpoint)
   * Filters by startTime ≤ now and endTime > now
   */
  async getActiveBanners(pumpId = null) {
    return bannerRepository.findActiveBanners(pumpId);
  },
};
