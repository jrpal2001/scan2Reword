import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ownerService } from '../services/owner.service.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * GET /api/owner/search (public, no JWT)
 * Query: identifier (partial match on mobile, fullName, loyaltyId), page?, limit?
 * e.g. identifier=678 returns all owners whose mobile/fullName/loyaltyId contains "678". Paginated.
 */
export const searchOwner = asyncHandler(async (req, res) => {
  const { identifier, page = 1, limit = 20 } = req.validated;

  const result = await ownerService.searchOwner(identifier, {
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 20,
  });

  return res.sendPaginated(result, 'Owners found', HTTP_STATUS.OK);
});

/**
 * POST /api/owner/vehicles
 * Body: { vehicle: { vehicleNumber, vehicleType, fuelType, ... }, user: { mobile, fullName, email?, ... } }
 * Files (optional): profilePhoto, driverPhoto, rcPhoto
 * Owner adds a new vehicle (user/driver) to their fleet
 */
export const addVehicle = asyncHandler(async (req, res) => {
  const value = req.validated;
  const s3Uploads = req.s3Uploads || {};
  const ownerId = req.user._id; // Owner is authenticated

  // req.s3Uploads values are always arrays; take first URL for single-photo fields
  const result = await ownerService.addVehicle(ownerId, {
    ...value,
    profilePhoto: s3Uploads.profilePhoto?.[0] ?? null,
    driverPhoto: s3Uploads.driverPhoto?.[0] ?? null,
    rcPhoto: s3Uploads.rcPhoto?.[0] ?? null,
    insurancePhoto: s3Uploads.insurancePhoto?.[0] ?? null,
    fitnessPhoto: s3Uploads.fitnessPhoto?.[0] ?? null,
    pollutionPhoto: s3Uploads.pollutionPhoto?.[0] ?? null,
    vehiclePhoto: Array.isArray(s3Uploads.vehiclePhoto) ? s3Uploads.vehiclePhoto : [],
  });

  return res.status(HTTP_STATUS.CREATED).json(
    ApiResponse.success(
      {
        userId: result.userId,
        vehicleId: result.vehicleId,
        loyaltyId: result.loyaltyId,
        user: result.user,
        vehicle: result.vehicle,
      },
      'Vehicle added to fleet successfully'
    )
  );
});

/**
 * GET /api/owner/vehicles
 * Get all vehicles (users/drivers) in owner's fleet
 */
export const getFleetVehicles = asyncHandler(async (req, res) => {
  const ownerId = req.user._id;
  const { page = 1, limit = 20 } = req.query;

  const result = await ownerService.getFleetVehicles(ownerId, {
    page: parseInt(page),
    limit: parseInt(limit),
  });

  return res.sendPaginated(result, 'Fleet vehicles retrieved', HTTP_STATUS.OK);
});
