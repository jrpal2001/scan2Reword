import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { userService } from '../services/user.service.js';
import { ROLES } from '../constants/roles.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

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
