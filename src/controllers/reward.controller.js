import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { rewardService } from '../services/reward.service.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * GET /api/rewards
 * Query: pumpId? (optional)
 * Public endpoint - returns available rewards
 */
export const getRewards = asyncHandler(async (req, res) => {
  const { pumpId } = req.query;
  const rewards = await rewardService.getAvailableRewards(pumpId || null);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(rewards, 'Available rewards retrieved')
  );
});

/**
 * POST /api/admin/rewards
 * Body: req.validated (reward data)
 * Admin only.
 */
export const createReward = asyncHandler(async (req, res) => {
  const reward = await rewardService.createReward(req.validated);
  return res.status(HTTP_STATUS.CREATED).json(
    ApiResponse.success(reward, 'Reward created successfully')
  );
});

/**
 * PUT /api/admin/rewards/:rewardId
 * Body: req.validated (partial reward data)
 * Admin only.
 */
export const updateReward = asyncHandler(async (req, res) => {
  const { rewardId } = req.params;
  const reward = await rewardService.updateReward(rewardId, req.validated);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(reward, 'Reward updated successfully')
  );
});

/**
 * DELETE /api/admin/rewards/:rewardId
 * Admin only.
 */
export const deleteReward = asyncHandler(async (req, res) => {
  const { rewardId } = req.params;
  await rewardService.deleteReward(rewardId);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(null, 'Reward deleted successfully')
  );
});

/**
 * GET /api/admin/rewards/:rewardId
 * Admin only.
 */
export const getRewardById = asyncHandler(async (req, res) => {
  const { rewardId } = req.params;
  const reward = await rewardService.getRewardById(rewardId);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(reward, 'Reward retrieved')
  );
});

/**
 * GET /api/admin/rewards
 * Query: page?, limit?, status?
 * Admin only.
 */
export const listRewards = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const result = await rewardService.listRewards(filter, {
    page: parseInt(page),
    limit: parseInt(limit),
  });
  return res.sendPaginated(result, 'Rewards retrieved', HTTP_STATUS.OK);
});
