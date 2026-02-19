import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { userService } from '../services/user.service.js';
import { ROLES } from '../constants/roles.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * GET /api/user/referral-code
 * Get or generate referral code for manager/staff
 */
export const getReferralCode = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const user = await userService.getUserById(userId);
  
  if (![ROLES.MANAGER, ROLES.STAFF].includes(user.role?.toLowerCase())) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Referral codes are only available for managers and staff');
  }

  let referralCode = user.referralCode;
  
  // Generate if doesn't exist
  if (!referralCode) {
    referralCode = await userService.generateReferralCode(userId);
  }

  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success({ referralCode }, 'Referral code retrieved')
  );
});
