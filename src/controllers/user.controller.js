import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { userService } from '../services/user.service.js';
import { ROLES } from '../constants/roles.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * GET /api/user/profile
 * Get current user's profile (individual, owner, or fleet driver). UserLoyalty only.
 */
export const getProfile = asyncHandler(async (req, res) => {
  if (req.userType !== ROLES.USER) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Profile is only available for registered users (individual, owner, driver)');
  }
  const profile = await userService.getProfile(req.user._id);
  return res.status(HTTP_STATUS.OK).json(ApiResponse.success(profile, 'Profile retrieved'));
});

/**
 * PATCH /api/user/profile
 * Update profile (fullName, email, address, avatar/profilePhoto). UserLoyalty only.
 * Optional multipart: profilePhoto file; or send profilePhoto URL in body.
 */
export const updateProfile = asyncHandler(async (req, res) => {
  if (req.userType !== ROLES.USER) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Profile update is only available for registered users');
  }
  const data = { ...(req.validated || {}) };
  const uploadedUrl = req.s3Uploads?.profilePhoto?.[0];
  if (uploadedUrl) data.profilePhoto = uploadedUrl;
  const profile = await userService.updateProfile(req.user._id, data);
  return res.status(HTTP_STATUS.OK).json(ApiResponse.success(profile, 'Profile updated'));
});

/**
 * GET /api/user/dashboard
 * User dashboard: points summary + recent transactions. UserLoyalty only.
 */
export const getDashboard = asyncHandler(async (req, res) => {
  if (req.userType !== ROLES.USER) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Dashboard is only available for registered users');
  }
  const dashboard = await userService.getUserDashboard(req.user._id);
  return res.status(HTTP_STATUS.OK).json(ApiResponse.success(dashboard, 'Dashboard retrieved'));
});

/**
 * GET /api/user/referral-code
 * Get or generate referral code for manager/staff (req.user is Manager or Staff from verifyJWT)
 */
export const getReferralCode = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const userType = req.userType === ROLES.MANAGER ? 'Manager' : req.userType === ROLES.STAFF ? 'Staff' : null;
  if (!userType) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Referral codes are only available for managers and staff');
  }

  let referralCode = req.user.referralCode;
  if (!referralCode) {
    referralCode = await userService.generateReferralCode(userId, userType);
  }

  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success({ referralCode }, 'Referral code retrieved')
  );
});
