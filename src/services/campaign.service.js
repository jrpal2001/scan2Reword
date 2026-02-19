import { campaignRepository } from '../repositories/campaign.repository.js';
import { pumpRepository } from '../repositories/pump.repository.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import { CAMPAIGN_STATUS } from '../constants/status.js';
import { ROLES } from '../constants/roles.js';

export const campaignService = {
  async createCampaign(data, userId, userRole, allowedPumpIds = null) {
    // Validate pumpIds for manager
    if (userRole === ROLES.MANAGER) {
      if (!data.pumpIds || data.pumpIds.length === 0) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Manager must assign campaign to at least one pump');
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
    if (new Date(data.startDate) >= new Date(data.endDate)) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'End date must be after start date');
    }

    // Validate type-specific fields
    if (data.type === 'multiplier' && (!data.multiplier || data.multiplier <= 0)) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Multiplier is required and must be positive');
    }
    if (data.type === 'bonusPoints' && (!data.bonusPoints || data.bonusPoints <= 0)) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Bonus points is required and must be positive');
    }
    if (data.type === 'bonusPercentage' && (!data.bonusPercentage || data.bonusPercentage <= 0)) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Bonus percentage is required and must be positive');
    }

    const campaign = await campaignRepository.create({
      ...data,
      createdBy: userId,
      createdByRole: userRole,
      status: data.status || CAMPAIGN_STATUS.DRAFT,
    });

    return campaign;
  },

  async updateCampaign(campaignId, data, userId, userRole, allowedPumpIds = null) {
    const existing = await campaignRepository.findById(campaignId);
    if (!existing) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Campaign not found');
    }

    // Check ownership/access
    if (userRole === ROLES.MANAGER && String(existing.createdBy) !== String(userId)) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied to this campaign');
    }

    // Validate pumpIds for manager
    if (userRole === ROLES.MANAGER && data.pumpIds !== undefined) {
      if (!data.pumpIds || data.pumpIds.length === 0) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Manager must assign campaign to at least one pump');
      }
      const allowed = (allowedPumpIds || []).map((id) => String(id));
      const requested = data.pumpIds.map((id) => String(id));
      const invalid = requested.filter((id) => !allowed.includes(id));
      if (invalid.length > 0) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied to one or more pumps');
      }
    }

    // Validate dates if provided
    if (data.startDate || data.endDate) {
      const startDate = data.startDate ? new Date(data.startDate) : new Date(existing.startDate);
      const endDate = data.endDate ? new Date(data.endDate) : new Date(existing.endDate);
      if (startDate >= endDate) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'End date must be after start date');
      }
    }

    const campaign = await campaignRepository.update(campaignId, data);
    return campaign;
  },

  async deleteCampaign(campaignId, userId, userRole) {
    const existing = await campaignRepository.findById(campaignId);
    if (!existing) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Campaign not found');
    }

    // Check ownership/access
    if (userRole === ROLES.MANAGER && String(existing.createdBy) !== String(userId)) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied to this campaign');
    }

    await campaignRepository.delete(campaignId);
    return { success: true };
  },

  async getCampaignById(campaignId, userId, userRole, allowedPumpIds = null) {
    const campaign = await campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Campaign not found');
    }

    // Check pump access for manager
    if (userRole === ROLES.MANAGER && allowedPumpIds !== null) {
      const allowed = allowedPumpIds.map((id) => String(id));
      const campaignPumps = campaign.pumpIds.map((id) => String(id));
      const hasAccess = campaign.pumpIds.length === 0 || campaignPumps.some((id) => allowed.includes(id));
      if (!hasAccess && String(campaign.createdBy) !== String(userId)) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied to this campaign');
      }
    }

    return campaign;
  },

  async listCampaigns(filter = {}, options = {}, userId, userRole, allowedPumpIds = null) {
    // Apply pump scope for manager
    if (userRole === ROLES.MANAGER && allowedPumpIds !== null) {
      filter.$or = [
        { pumpIds: { $size: 0 } }, // Global campaigns
        { pumpIds: { $in: allowedPumpIds } }, // Campaigns for manager's pumps
        { createdBy: userId }, // Campaigns created by this manager
      ];
    }

    return campaignRepository.list(filter, options);
  },

  /**
   * Find active campaigns for a transaction
   * Used in transaction points calculation
   */
  async findActiveCampaignsForTransaction(pumpId, category, amount) {
    return campaignRepository.findActiveCampaigns({
      pumpId,
      category,
      amount,
    });
  },
};
