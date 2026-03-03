import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { addISTToDocument, addISTToList } from '../utils/dateUtils.js';
import { vehicleService } from '../services/vehicle.service.js';
import { userService } from '../services/user.service.js';
import { userRepository } from '../repositories/user.repository.js';
import { ROLES } from '../constants/roles.js';
import { USER_TYPES } from '../models/User.model.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * GET /api/user/vehicles or GET /api/manager/vehicles?userId= (admin/manager can pass userId)
 * - For fleet owner (userType=owner): returns all fleet vehicles (vehicles of their drivers). Optional ?vehicleId= or ?vehicleNumber= to filter.
 * - For driver/individual: returns vehicles linked to them. Optional ?vehicleId= or ?vehicleNumber= to filter.
 */
export const getVehicles = asyncHandler(async (req, res) => {
  const role = (req.userType || req.user?.role || '').toLowerCase();
  const queryUserId = req.query.userId;
  const { vehicleId: queryVehicleId, vehicleNumber: queryVehicleNumber } = req.query || {};
  let userId = req.user._id;
  if (queryUserId && (role === ROLES.ADMIN || role === ROLES.MANAGER)) {
    userId = queryUserId;
  } else if (queryUserId && queryUserId !== String(req.user._id)) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied');
  }

  let vehicles;
  if (role === ROLES.USER) {
    const user = await userRepository.findById(userId);
    if (!user) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
    if (user.userType === USER_TYPES.OWNER) {
      vehicles = await userService.getFleetVehicles(userId);
    } else {
      vehicles = await vehicleService.getVehiclesByUserId(userId);
    }
  } else {
    vehicles = await vehicleService.getVehiclesByUserId(userId);
  }

  if (queryVehicleId && Array.isArray(vehicles)) {
    vehicles = vehicles.filter((v) => String(v._id) === String(queryVehicleId));
  }
  if (queryVehicleNumber && Array.isArray(vehicles)) {
    const num = String(queryVehicleNumber).trim().toUpperCase();
    vehicles = vehicles.filter((v) => (v.vehicleNumber || '').toUpperCase() === num);
  }

  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(Array.isArray(vehicles) ? addISTToList(vehicles) : addISTToDocument(vehicles), 'Vehicles retrieved')
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
      { vehicle: addISTToDocument(vehicle), loyaltyId: vehicle.loyaltyId },
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
    ApiResponse.success(addISTToDocument(vehicle), 'Vehicle updated')
  );
});
