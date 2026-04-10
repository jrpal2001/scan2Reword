import { campaignRepository } from '../repositories/campaign.repository.js';
import { pumpRepository } from '../repositories/pump.repository.js';
import { transactionRepository } from '../repositories/transaction.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { notificationService } from './notification.service.js';
import { whatsappService } from './whatsapp.service.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import { CAMPAIGN_STATUS } from '../constants/status.js';
import { ROLES } from '../constants/roles.js';

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const TZ_SUFFIX_REGEX = /(Z|[+-]\d{2}:\d{2}|[+-]\d{4})$/i;
const ISO_LOCAL_DATE_TIME_REGEX = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2})(?::(\d{2}))(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/;

function parseCampaignDateInput(value) {
  if (value == null || value === '') return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value !== 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const raw = value.trim();
  if (!raw) return null;

  // If timezone is provided explicitly, keep that instant unchanged.
  if (TZ_SUFFIX_REGEX.test(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // If timezone is missing (e.g. from datetime-local), interpret as IST.
  const match = raw.match(ISO_LOCAL_DATE_TIME_REGEX);
  if (match) {
    const [
      ,
      year,
      month,
      day,
      hour = '00',
      minute = '00',
      second = '00',
      millisecond = '0',
    ] = match;

    const ms = millisecond.padEnd(3, '0').slice(0, 3);
    const utcMs = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      Number(ms)
    ) - IST_OFFSET_MS;

    const d = new Date(utcMs);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

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

    const parsedStartDate = parseCampaignDateInput(data.startDate);
    const parsedEndDate = parseCampaignDateInput(data.endDate);
    if (!parsedStartDate || !parsedEndDate) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid startDate or endDate');
    }

    // Validate dates
    if (parsedStartDate >= parsedEndDate) {
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
      startDate: parsedStartDate,
      endDate: parsedEndDate,
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
  async _resolveCampaignRecipientUserIds(campaign) {
    const pumpIds = campaign.pumpIds && campaign.pumpIds.length > 0 ? campaign.pumpIds : null;
    if (!pumpIds || pumpIds.length === 0) {
      return userRepository.getActiveCustomerIds();
    }
    const [transactedUserIds, registeredUserIds] = await Promise.all([
      transactionRepository.getDistinctUserIdsByPumpIds(pumpIds),
      userRepository.getActiveCustomerIdsByRegisteredPumps(pumpIds)
    ]);
    
    // Combine and return distinct string IDs
    const allUserIds = [...transactedUserIds, ...registeredUserIds].map(id => String(id));
    return [...new Set(allUserIds)];
  },

  async _buildCampaignNotificationContent(campaign) {
    const formatDateTime = (value) => {
      if (!value) return 'N/A';
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return 'N/A';

      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).formatToParts(d);

      const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));
      const day = partMap.day || '00';
      const month = partMap.month || '00';
      const year = partMap.year || '0000';
      const hour = (partMap.hour || '00').padStart(2, '0');
      const minute = partMap.minute || '00';
      const meridiem = (partMap.dayPeriod || 'am').toLowerCase();

      // Required format: 23/04/2016 ,10.20 am
      return `${day}/${month}/${year} ,${hour}.${minute} ${meridiem}`;
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
    const validityRangeText = `${startAt} to ${endAt}`;
    const pumpIds = campaign.pumpIds && campaign.pumpIds.length > 0 ? campaign.pumpIds : null;
    let pumpScopeText = 'Available at all pumps';
    let pumpScopeTemplateValue = 'All Pumps';
    if (pumpIds && pumpIds.length > 0) {
      const pumps = await pumpRepository.listByIds(pumpIds);
      const pumpNameById = new Map(
        pumps.map((p) => [String(p._id), p.name || p.code || String(p._id)])
      );
      const namesInOrder = [...new Set(
        pumpIds.map((id) => pumpNameById.get(String(id)) || String(id))
      )];
      pumpScopeText = `Available at ${namesInOrder.join(', ')}`;
      pumpScopeTemplateValue = namesInOrder.join(', ');
    }
    const title = 'New offer';
    const body = `${campaign.name} is now live. ${typeMessage} Valid from ${startAt} to ${endAt}. ${pumpScopeText}. Visit now and earn rewards!`;
    // API campaign template from manager uses 4 vars: {{1}} {{2}} {{3}} {{4}}
    // e.g. "{{1}} is now live. {{2}} Valid from {{3}}. Available at {{4}}. Visit now and earn rewards!"
    const templateParams = [campaign.name, typeMessage, validityRangeText, pumpScopeTemplateValue];
    return { title, body, templateParams };
  },

  async _sendCampaignCreatedWhatsApp(userIds, templateParams) {
    const users = await userRepository.getActiveCustomerWhatsappTargetsByIds(userIds);
    if (!users || users.length === 0) return;
    const result = await whatsappService.sendCampaignBroadcast(users, templateParams);
    console.log(
      `[Campaign] WhatsApp broadcast summary | attempted=${result.attempted} sent=${result.sent} failed=${result.failed} skipped=${result.skipped}`
    );

    const userById = new Map(users.map((u) => [String(u._id), u]));
    const deliveredUsers = (result.results || [])
      .filter((r) => r.success)
      .map((r) => {
        const user = userById.get(String(r.userId));
        return {
          userId: r.userId || null,
          name: user?.fullName || 'Customer',
          mobile: user?.mobile || r.destination || null,
        };
      });

    console.log('[Campaign] WhatsApp delivered users:', deliveredUsers);

    const failedUsers = (result.results || [])
      .filter((r) => !r.success && !r.skipped)
      .map((r) => ({
        userId: r.userId || null,
        destination: r.destination || null,
        error: r.error || 'Unknown error',
        status: r.status || null,
      }));
    if (failedUsers.length > 0) {
      console.warn('[Campaign] WhatsApp failed users:', failedUsers);
    }
  },

  async _sendCampaignCreatedNotification(campaign) {
    const userIds = await this._resolveCampaignRecipientUserIds(campaign);
    if (!userIds || userIds.length === 0) return;

    const { title, body, templateParams } = await this._buildCampaignNotificationContent(campaign);
    let notificationError = null;
    try {
      await notificationService.sendToUsers(userIds, title, body);
    } catch (err) {
      notificationError = err;
    }

    if (String(campaign.status || '').toLowerCase() === CAMPAIGN_STATUS.ACTIVE) {
      void this._sendCampaignCreatedWhatsApp(userIds, templateParams).catch((err) => {
        console.warn('[Campaign] WhatsApp notification after create failed:', err?.message);
      });
    } else {
      console.log(
        `[Campaign] WhatsApp skipped: campaign status is "${campaign.status}" (only "${CAMPAIGN_STATUS.ACTIVE}" sends WhatsApp).`
      );
    }

    if (notificationError) throw notificationError;
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
    const updatePayload = { ...data };

    if (data.startDate || data.endDate) {
      const startDate = data.startDate
        ? parseCampaignDateInput(data.startDate)
        : new Date(existing.startDate);
      const endDate = data.endDate
        ? parseCampaignDateInput(data.endDate)
        : new Date(existing.endDate);
      if (!startDate || !endDate) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid startDate or endDate');
      }
      if (startDate >= endDate) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'End date must be after start date');
      }

      if (data.startDate) updatePayload.startDate = startDate;
      if (data.endDate) updatePayload.endDate = endDate;
    }

    const campaign = await campaignRepository.update(campaignId, updatePayload);
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
