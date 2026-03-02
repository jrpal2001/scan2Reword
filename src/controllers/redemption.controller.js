import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { redemptionService } from '../services/redemption.service.js';
import { auditLogService } from '../services/auditLog.service.js';
import { ROLES } from '../constants/roles.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * POST /api/redeem
 * Body: { rewardId }
 * User-initiated redemption.
 */
export const createRedemption = asyncHandler(async (req, res) => {
  const { rewardId } = req.validated;
  const redemption = await redemptionService.createRedemption({
    userId: req.user._id,
    rewardId,
  });

  // Log audit
  await auditLogService.log({
    userId: req.user._id,
    action: 'redemption.create',
    entityType: 'Redemption',
    entityId: redemption._id,
    before: null,
    after: { pointsUsed: redemption.pointsUsed, status: redemption.status },
    metadata: { rewardId },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  return res.status(HTTP_STATUS.CREATED).json(
    ApiResponse.success(
      { redemption, redemptionCode: redemption.redemptionCode },
      'Redemption created successfully. Points deducted. Awaiting approval.'
    )
  );
});

/**
 * POST /api/redeem/at-pump or POST /api/manager/redeem or POST /api/staff/redeem
 * Body: { identifier, pointsToDeduct, pumpId? } — pumpId optional for Staff (derived from single assignment); required for Manager/Admin
 */
export const createAtPumpRedemption = asyncHandler(async (req, res) => {
  let { identifier, pointsToDeduct, pumpId } = req.validated;
  if (!pumpId && req.userType === ROLES.STAFF && req.allowedPumpIds?.length === 1) {
    pumpId = req.allowedPumpIds[0];
  }
  if (!pumpId) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'pumpId is required for Manager/Admin; Staff must be assigned to exactly one pump');
  }
  const result = await redemptionService.createAtPumpRedemption({
    identifier,
    pointsToDeduct,
    operatorId: req.user._id,
    pumpId,
  });
  return res.status(HTTP_STATUS.CREATED).json(
    ApiResponse.success(
      {
        redemption: result.redemption,
        redemptionCode: result.redemption.redemptionCode,
        user: result.user,
        wallet: result.wallet,
      },
      'Redemption request created. Awaiting admin approval. Points will be deducted after approval.'
    )
  );
});

/**
 * POST /api/manager/redemptions/:id/approve
 * Manager only.
 */
export const approveRedemption = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const redemption = await redemptionService.approveRedemption(id, req.user._id);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(redemption, 'Redemption approved successfully')
  );
});

/**
 * POST /api/manager/redemptions/:id/reject
 * Body: { reason }
 * Manager only.
 */
export const rejectRedemption = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.validated;
  const redemption = await redemptionService.rejectRedemption(id, req.user._id, reason);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(redemption, 'Redemption rejected. Points refunded.')
  );
});

/**
 * POST /api/redeem/:code/verify
 * Verify redemption code (e.g. at pump).
 */
export const verifyRedemptionCode = asyncHandler(async (req, res) => {
  const { code } = req.params;
  const redemption = await redemptionService.verifyRedemptionCode(code);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(redemption, 'Redemption code is valid')
  );
});

/**
 * POST /api/redeem/:code/use
 * Mark redemption as used (after verification at pump).
 */
export const useRedemptionCode = asyncHandler(async (req, res) => {
  const { code } = req.params;
  const { pumpId } = req.body;
  const redemption = await redemptionService.verifyRedemptionCode(code);
  const updated = await redemptionService.markAsUsed(redemption._id, pumpId);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(updated, 'Redemption code used successfully')
  );
});

/**
 * GET /api/redemptions
 * Query: page?, limit?, status?, userId?
 * User can see own redemptions; Admin/Manager can see all.
 */
export const listRedemptions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, userId } = req.query;
  const role = (req.userType || req.user?.role || '').toLowerCase();
  
  const filter = {};
  if (status) filter.status = status;
  // User can only see own redemptions
  if (role === 'user') {
    filter.userId = req.user._id;
  } else if (userId) {
    filter.userId = userId;
  }

  const result = await redemptionService.listRedemptions(filter, {
    page: parseInt(page),
    limit: parseInt(limit),
  });
  return res.sendPaginated(result, 'Redemptions retrieved', HTTP_STATUS.OK);
});

/**
 * GET /api/redemptions/:redemptionId
 */
export const getRedemptionById = asyncHandler(async (req, res) => {
  const { redemptionId } = req.params;
  const redemption = await redemptionService.getRedemptionById(redemptionId);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(redemption, 'Redemption retrieved')
  );
});

/**
 * POST /api/admin/redemptions/direct
 * Body: { userId, pointsToDeduct, pumpId }
 * Admin only. Direct redeem: deduct points immediately. pumpId required to track at which pump redemption was done.
 */
export const createDirectRedemption = asyncHandler(async (req, res) => {
  const { userId, pointsToDeduct, pumpId } = req.validated;
  const { redemption, pumpName } = await redemptionService.createDirectRedemption({
    userId,
    pointsToDeduct,
    pumpId,
    adminId: req.user._id,
  });
  const n = redemption.pointsUsed;
  const pointsText = n === 1 ? '1 point' : `${n} points`;
  const verb = n === 1 ? 'has' : 'have';
  const message = `Your ${pointsText} ${verb} been Redeemed at ${pumpName}.`;
  return res.status(HTTP_STATUS.CREATED).json(
    ApiResponse.success(
      { redemption, redemptionCode: redemption.redemptionCode, message },
      message
    )
  );
});
