import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { addISTToPayload, buildCreatedAtFilter } from '../utils/dateUtils.js';
import { userService } from '../services/user.service.js';
import { transactionRepository } from '../repositories/transaction.repository.js';
import { userRepository } from '../repositories/user.repository.js';
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
  return res.status(HTTP_STATUS.OK).json(ApiResponse.success(addISTToPayload(profile), 'Profile retrieved'));
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
  return res.status(HTTP_STATUS.OK).json(ApiResponse.success(addISTToPayload(dashboard), 'Dashboard retrieved'));
});

/**
 * GET /api/user/transactions
 * List current user's transactions. For owner: includes transactions of the owner + all their fleet drivers. For driver/individual: only their own.
 * Pagination + filters: vehicleId, category, status, startDate, endDate, month, year, startTime, endTime.
 */
export const listMyTransactions = asyncHandler(async (req, res) => {
  if (req.userType !== ROLES.USER) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Transactions list is only available for registered users (individual, owner, driver)');
  }
  const validated = req.validated || req.query;
  const { page, limit, vehicleId, category, status } = validated;
  const currentUserId = req.user._id;
  const userType = req.user.userType || (await userRepository.findById(currentUserId))?.userType;

  // Owner sees their own transactions + all their fleet drivers' transactions
  let userIdFilter;
  if (userType === 'owner') {
    const drivers = await userRepository.list({ ownerId: currentUserId }, { page: 1, limit: 500 });
    const allowedUserIds = [currentUserId, ...drivers.list.map((d) => d._id)];
    userIdFilter = allowedUserIds.length === 1 ? { userId: currentUserId } : { userId: { $in: allowedUserIds } };
  } else {
    userIdFilter = { userId: currentUserId };
  }

  let filter = { ...userIdFilter };
  if (vehicleId) filter.vehicleId = vehicleId;
  if (category) filter.category = category;
  if (status) filter.status = status;
  const createdAt = buildCreatedAtFilter(validated);
  if (createdAt) {
    if (createdAt.$and) {
      filter = { $and: [filter, ...createdAt.$and] };
    } else if (createdAt.createdAt) {
      filter.createdAt = createdAt.createdAt;
    }
  }
  const result = await transactionRepository.list(filter, {
    page: Number(page) || 1,
    limit: Number(limit) || 20,
    sort: { createdAt: -1 },
  });
  return res.sendPaginated(result, 'Transactions retrieved', HTTP_STATUS.OK);
});

/**
 * GET /api/user/lookup
 * Look up customer (UserLoyalty) by loyaltyId, vehicleNumber, or mobile. Returns user details + vehicles (same shape as profile).
 * Allowed for admin, manager, staff, owner, user (any authenticated role).
 */
export const lookupCustomer = asyncHandler(async (req, res) => {
  const validated = req.validated || req.query;
  const profile = await userService.lookupCustomer({
    loyaltyId: validated.loyaltyId,
    vehicleNumber: validated.vehicleNumber,
    mobile: validated.mobile,
  });
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(addISTToPayload(profile), 'User details retrieved')
  );
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
