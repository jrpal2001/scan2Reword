import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ownerService } from '../services/owner.service.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * GET /api/owner/search
 * Query: identifier (owner ID or phone number)
 * Search for owner by ID or phone number
 */
export const searchOwner = asyncHandler(async (req, res) => {
  const { identifier } = req.query;
  if (!identifier) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      ApiResponse.error('Identifier (ID or phone) is required')
    );
  }

  const owner = await ownerService.searchOwner(identifier);
  if (!owner) {
    return res.status(HTTP_STATUS.NOT_FOUND).json(
      ApiResponse.error('Owner not found')
    );
  }

  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(owner, 'Owner found')
  );
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

  const result = await ownerService.addVehicle(ownerId, {
    ...value,
    profilePhoto: s3Uploads.profilePhoto || null,
    driverPhoto: s3Uploads.driverPhoto || null,
    rcPhoto: s3Uploads.rcPhoto || null,
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

  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(result, 'Fleet vehicles retrieved')
  );
});
