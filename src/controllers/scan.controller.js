import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { scanService } from '../services/scan.service.js';

/**
 * POST /api/scan/validate
 * Body: { identifier }
 * Returns user/vehicle info for transaction or redemption.
 */
export const validateIdentifier = asyncHandler(async (req, res) => {
  const { identifier } = req.validated;
  const result = await scanService.validateIdentifier(identifier);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(
      {
        user: {
          _id: result.user._id,
          fullName: result.user.fullName,
          mobile: result.user.mobile,
          role: result.user.role,
          walletSummary: result.user.walletSummary,
        },
        vehicle: result.vehicle
          ? {
              _id: result.vehicle._id,
              vehicleNumber: result.vehicle.vehicleNumber,
              loyaltyId: result.vehicle.loyaltyId,
              vehicleType: result.vehicle.vehicleType,
              fuelType: result.vehicle.fuelType,
            }
          : null,
        isOwner: result.isOwner,
      },
      result.isOwner ? 'Owner ID validated' : 'Vehicle/driver ID validated'
    )
  );
});
