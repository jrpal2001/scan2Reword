import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { addISTToList } from '../utils/dateUtils.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import { ROLES } from '../constants/roles.js';
import { USER_TYPES } from '../models/User.model.js';
import * as statsService from '../services/stats.service.js';
import { staffAssignmentRepository } from '../repositories/staffAssignment.repository.js';
import ApiError from '../utils/ApiError.js';

/**
 * GET /api/admin/stats/review
 * Query: startDate?, endDate?, month?, year?, startTime?, endTime?, pumpId?, userId?
 * When no date filter: current month (IST). Returns list of enriched transactions (no attachments, no byPeriod) + totals.
 */
export const getReviewStats = asyncHandler(async (req, res) => {
  const validated = req.validated || req.query;
  const stats = await statsService.getReviewStats(validated, req.allowedPumpIds ?? null);
  const listWithIST = addISTToList(stats.list || []);
  const listWithoutAttachments = listWithIST.map(({ attachments, ...rest }) => rest);
  const data = {
    list: listWithoutAttachments,
    totalAmount: stats.totalAmount,
    totalLiters: stats.totalLiters,
    totalPointsGenerated: stats.totalPointsGenerated,
    totalPointsRedeemed: stats.totalPointsRedeemed,
    totalPointsGeneratedByStaffManager: stats.totalPointsGeneratedByStaffManager,
    totalPointsRedeemedByStaffManager: stats.totalPointsRedeemedByStaffManager,
  };
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(data, 'Review statistics retrieved')
  );
});

/**
 * GET /api/owner/stats/review
 * Fleet owner only. Same query as admin review: startDate?, endDate?, month?, year?, startTime?, endTime?, pumpId?, userId?
 * Returns stats for owner + all their drivers (fleet). Optional userId filters to that driver if they belong to the fleet.
 */
export const getFleetReviewStats = asyncHandler(async (req, res) => {
  if (req.user?.userType !== USER_TYPES.OWNER) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Fleet statistics are only available for fleet owners');
  }
  const validated = req.validated || req.query;
  const stats = await statsService.getFleetReviewStats(validated, req.user._id);
  const listWithIST = addISTToList(stats.list || []);
  const listWithoutAttachments = listWithIST.map(({ attachments, ...rest }) => rest);
  const data = {
    list: listWithoutAttachments,
    totalAmount: stats.totalAmount,
    totalLiters: stats.totalLiters,
    totalPointsGenerated: stats.totalPointsGenerated,
    totalPointsRedeemed: stats.totalPointsRedeemed,
    totalPointsGeneratedByStaffManager: stats.totalPointsGeneratedByStaffManager,
    totalPointsRedeemedByStaffManager: stats.totalPointsRedeemedByStaffManager,
  };
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(data, 'Fleet review statistics retrieved')
  );
});

/**
 * GET /api/admin/stats/user-registrations
 * Query: startDate?, endDate?, month?, year?, groupBy? ('day' | 'month')
 * When no date filter: current month (IST). Returns list + totalRegistrations + byPeriod + referral earned statistics.
 */
export const getUserRegistrationGraph = asyncHandler(async (req, res) => {
  const validated = req.validated || req.query;
  const groupBy = validated.groupBy || 'day';
  let referrerIds = null;
  if (req.userType === ROLES.MANAGER && req.allowedPumpIds?.length) {
    const staffIds = await staffAssignmentRepository.getStaffIdsByPumpIds(req.allowedPumpIds);
    referrerIds = [req.user._id, ...(staffIds || [])].map(String);
  }
  const result = await statsService.getUserRegistrationGraph(
    validated,
    req.allowedPumpIds ?? null,
    referrerIds,
    groupBy
  );
  const listWithIST = addISTToList(result.list || []);
  const listWithoutSensitive = listWithIST.map(
    ({ profilePhoto, driverPhoto, ownerPhoto, walletSummary, ...rest }) => rest
  );
  const data = {
    list: listWithoutSensitive,
    totalRegistrations: result.totalRegistrations ?? 0,
    byPeriod: result.byPeriod || [],
    totalReferralPointsEarned: result.totalReferralPointsEarned ?? 0,
    totalReferralSignups: result.totalReferralSignups ?? 0,
  };
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(data, 'User registration data retrieved')
  );
});
