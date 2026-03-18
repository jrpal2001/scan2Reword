import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import { addISTToList, addISTToPayload } from '../utils/dateUtils.js';
import { pointsService } from '../services/points.service.js';
import { userService } from '../services/user.service.js';
import { ROLES } from '../constants/roles.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

function resolveOwnerTypeFromRole(role) {
  if (role === ROLES.MANAGER) return 'Manager';
  if (role === ROLES.STAFF) return 'Staff';
  return null;
}

/**
 * GET /api/manager/referrals/summary or /api/staff/referrals/summary
 * Shows: referredUserCount + walletSummary (earned/available/redeemed/expired)
 */
export const getMyReferralSummary = asyncHandler(async (req, res) => {
  const role = req.userType;
  const ownerType = resolveOwnerTypeFromRole(role);
  if (!ownerType) throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Only manager or staff can access referral summary');

  const referredUserCount = await userService.countUsersByReferrerId(req.user._id);
  const wallet = await pointsService.getWallet(req.user._id, { ownerType, page: 1, limit: 1 });

  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(
      addISTToPayload({
        referredUserCount,
        walletSummary: wallet.walletSummary,
      }),
      'Referral summary retrieved'
    )
  );
});

/**
 * GET /api/manager/referrals/history or /api/staff/referrals/history
 * Query: page?, limit?
 * Returns paginated PointsLedger entries for this manager/staff (includes referral credits + redemption/debit history).
 */
export const getMyReferralHistory = asyncHandler(async (req, res) => {
  const role = req.userType;
  const ownerType = resolveOwnerTypeFromRole(role);
  if (!ownerType) throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Only manager or staff can access referral history');

  const { page = 1, limit = 10 } = req.query;
  const wallet = await pointsService.getWallet(req.user._id, {
    ownerType,
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 10,
  });

  const listWithIST = addISTToList(wallet.ledger?.list ?? []);
  return res.sendPaginatedMeta(
    { walletSummary: wallet.walletSummary, ledger: listWithIST },
    wallet.ledger,
    'Referral history retrieved',
    HTTP_STATUS.OK
  );
});

