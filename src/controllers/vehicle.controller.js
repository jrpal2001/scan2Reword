import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { vehicleService } from '../services/vehicle.service.js';
import { ROLES } from '../constants/roles.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * GET /api/user/vehicles or GET /api/manager/vehicles?userId= (admin/manager can pass userId)
 * Returns vehicles for req.user (or for userId if allowed).
 */
export const getVehicles = asyncHandler(async (req, res) => {
  const role = (req.userType || req.user?.role || '').toLowerCase();
  const queryUserId = req.query.userId;
  let userId = req.user._id;
  if (queryUserId && (role === ROLES.ADMIN || role === ROLES.MANAGER)) {
    userId = queryUserId;
  } else if (queryUserId && queryUserId !== String(req.user._id)) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied');
  }
  const vehicles = await vehicleService.getVehiclesByUserId(userId);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(vehicles, 'Vehicles retrieved')
  );
});

/**
 * POST /api/user/vehicles
 * Body: req.validated (vehicleNumber, vehicleType, fuelType, ...)
 * Creates vehicle for authenticated user.
 */
export const addVehicle = asyncHandler(async (req, res) => {
  const data = { ...req.validated, userId: req.user._id };
  const vehicle = await vehicleService.createVehicle(data);
  return res.status(HTTP_STATUS.CREATED).json(
    ApiResponse.success(
      { vehicle, loyaltyId: vehicle.loyaltyId },
      'Vehicle added successfully'
    )
  );
});

/**
 * PUT /api/user/vehicles/:vehicleId
 * Body: req.validated (partial vehicle fields)
 * Only owner or admin can update.
 */
export const updateVehicle = asyncHandler(async (req, res) => {
  const { vehicleId } = req.params;
  const role = (req.userType || req.user?.role || '').toLowerCase();
  const existing = await vehicleService.getVehicleById(vehicleId);
  if (role !== ROLES.ADMIN && String(existing.userId) !== String(req.user._id)) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied to this vehicle');
  }
  const vehicle = await vehicleService.updateVehicle(vehicleId, req.validated);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(vehicle, 'Vehicle updated')
  );
});
