import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { campaignService } from '../services/campaign.service.js';
import { auditLogService } from '../services/auditLog.service.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * POST /api/admin/campaigns or POST /api/manager/campaigns
 * Body: req.validated (campaign data)
 * Admin/Manager only.
 */
export const createCampaign = asyncHandler(async (req, res) => {
  const role = (req.userType || req.user?.role || '').toLowerCase();
  const campaign = await campaignService.createCampaign(
    req.validated,
    req.user._id,
    role,
    req.allowedPumpIds
  );

  // Log audit
  await auditLogService.log({
    userId: req.user._id,
    action: 'campaign.create',
    entityType: 'Campaign',
    entityId: campaign._id,
    before: null,
    after: { name: campaign.name, type: campaign.type, status: campaign.status },
    metadata: { pumpIds: campaign.pumpIds },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  return res.status(HTTP_STATUS.CREATED).json(
    ApiResponse.success(campaign, 'Campaign created successfully')
  );
});

/**
 * PUT /api/admin/campaigns/:campaignId or PUT /api/manager/campaigns/:campaignId
 * Body: req.validated (partial campaign data)
 * Admin/Manager only.
 */
export const updateCampaign = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;
  const role = (req.userType || req.user?.role || '').toLowerCase();
  const campaign = await campaignService.updateCampaign(
    campaignId,
    req.validated,
    req.user._id,
    role,
    req.allowedPumpIds
  );
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(campaign, 'Campaign updated successfully')
  );
});

/**
 * DELETE /api/admin/campaigns/:campaignId or DELETE /api/manager/campaigns/:campaignId
 * Admin/Manager only.
 */
export const deleteCampaign = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;
  const role = (req.userType || req.user?.role || '').toLowerCase();
  await campaignService.deleteCampaign(campaignId, req.user._id, role);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(null, 'Campaign deleted successfully')
  );
});

/**
 * GET /api/admin/campaigns/:campaignId or GET /api/manager/campaigns/:campaignId
 * Admin/Manager only.
 */
export const getCampaignById = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;
  const role = (req.userType || req.user?.role || '').toLowerCase();
  const campaign = await campaignService.getCampaignById(
    campaignId,
    req.user._id,
    role,
    req.allowedPumpIds
  );
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(campaign, 'Campaign retrieved')
  );
});

/**
 * GET /api/admin/campaigns or GET /api/manager/campaigns
 * Query: page?, limit?, status?, pumpId?
 * Admin/Manager only.
 */
export const listCampaigns = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, pumpId } = req.query;
  const role = (req.userType || req.user?.role || '').toLowerCase();
  
  const filter = {};
  if (status) filter.status = status;
  if (pumpId) filter.pumpIds = pumpId;

  const result = await campaignService.listCampaigns(
    filter,
    {
      page: parseInt(page),
      limit: parseInt(limit),
    },
    req.user._id,
    role,
    req.allowedPumpIds
  );
  return res.sendPaginated(result, 'Campaigns retrieved', HTTP_STATUS.OK);
});
