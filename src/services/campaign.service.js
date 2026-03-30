import { campaignRepository } from '../repositories/campaign.repository.js';
import { pumpRepository } from '../repositories/pump.repository.js';
import { transactionRepository } from '../repositories/transaction.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { notificationService } from './notification.service.js';
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
      // Default pumpIds to [] so "all pumps" is explicit; omit only for Admin when not sending pumpIds
      pumpIds: data.pumpIds != null ? data.pumpIds : [],
      createdBy: userId,
      createdByRole: userRole,
      status: data.status || CAMPAIGN_STATUS.DRAFT,
    });

    // Notify users: all pumps → all customers; specific pumps → users who registered/transacted at those pumps
    try {
      await this._sendCampaignCreatedNotification(campaign);
    } catch (err) {
      console.warn('[Campaign] Notification after create failed:', err?.message);
    }

    return campaign;
  },

  /**
   * Send notification when a campaign is created.
   * - All pumps (pumpIds empty): notify all active customers.
   * - Specific pumps: notify users who have made a transaction at any of those pumps.
   */
  async _sendCampaignCreatedNotification(campaign) {
    const pumpIds = campaign.pumpIds && campaign.pumpIds.length > 0 ? campaign.pumpIds : null;
    let userIds = [];

    if (!pumpIds || pumpIds.length === 0) {
      userIds = await userRepository.getActiveCustomerIds();
    } else {
      userIds = await transactionRepository.getDistinctUserIdsByPumpIds(pumpIds);
    }

    if (!userIds || userIds.length === 0) {
      return;
    }

    const formatDateTime = (value) => {
      if (!value) return 'N/A';
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? 'N/A' : d.toISOString();
    };

    const getTypeMessage = () => {
      if (campaign.type === 'multiplier') {
        const mult = campaign.multiplier ?? null;
        return mult ? `Earn ${mult}x points on eligible purchases.` : 'Earn more points on eligible purchases.';
      }
      if (campaign.type === 'bonusPoints') {
        const points = campaign.bonusPoints ?? null;
        return points ? `Get ${points} extra points on eligible purchases.` : 'Get extra points on eligible purchases.';
      }
      if (campaign.type === 'bonusPercentage') {
        const pct = campaign.bonusPercentage ?? null;
        return pct ? `Earn ${pct}% extra points on eligible purchases.` : 'Earn extra percentage points on eligible purchases.';
      }
      return 'Earn more points on eligible purchases.';
    };

    const typeMessage = getTypeMessage();
    const startAt = formatDateTime(campaign.startDate);
    const endAt = formatDateTime(campaign.endDate);
    let pumpScopeText = 'Available at all pumps';
    if (pumpIds && pumpIds.length > 0) {
      const pumps = await pumpRepository.listByIds(pumpIds);
      const pumpNameById = new Map(
        pumps.map((p) => [String(p._id), p.name || p.code || String(p._id)])
      );
      const namesInOrder = [...new Set(
        pumpIds.map((id) => pumpNameById.get(String(id)) || String(id))
      )];
      pumpScopeText = `Available at ${namesInOrder.join(', ')}`;
    }
    const title = 'New offer';
    const body = `${campaign.name} is now live. ${typeMessage} Valid from ${startAt} to ${endAt}. ${pumpScopeText}. Visit now and earn rewards!`;
    await notificationService.sendToUsers(userIds, title, body);
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
    const query = { ...filter };

    // Apply pump scope for manager
    if (userRole === ROLES.MANAGER && allowedPumpIds !== null) {
      const requestedPumpId = query.pumpIds ? String(query.pumpIds) : null;
      const allowed = (allowedPumpIds || []).map((id) => String(id));

      let scopedPumpIds = allowed;
      if (requestedPumpId) {
        if (!allowed.includes(requestedPumpId)) {
          throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied to this pump');
        }
        scopedPumpIds = [requestedPumpId];
      }

      // Remove direct pumpIds filter so global campaigns (pumpIds: []) are still included.
      delete query.pumpIds;

      query.$or = [
        { pumpIds: null },
        { pumpIds: { $exists: false } },
        { pumpIds: { $size: 0 } }, // Global campaigns
        { pumpIds: { $in: scopedPumpIds } }, // Campaigns for manager's pumps
        { createdBy: userId }, // Campaigns created by this manager
      ];
    }

    return campaignRepository.list(query, options);
  },

  /**
   * Find active campaigns for a transaction
   * Used in transaction points calculation. Pass liters/fuelType so Fuel-specific conditions can be applied.
   */
  async findActiveCampaignsForTransaction(pumpId, category, amount, liters = null, fuelType = null) {
    return campaignRepository.findActiveCampaigns({
      pumpId,
      category,
      amount,
      liters,
      fuelType,
    });
  },
};
