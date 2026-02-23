import { userRepository } from '../repositories/user.repository.js';
import { vehicleRepository } from '../repositories/vehicle.repository.js';
import { vehicleService } from './vehicle.service.js';
import { ROLES } from '../constants/roles.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

export const ownerService = {
  /**
   * Search for owner by ID or phone number
   * @param {string} identifier - Owner ID or phone number
   * @returns {Promise<Object|null>} Owner details or null
   */
  async searchOwner(identifier) {
    const owner = await userRepository.findByIdentifier(identifier);
    if (!owner) {
      return null;
    }

    // Verify it's an owner (not a driver)
    if (owner.ownerId) {
      // This is a driver, not an owner
      return null;
    }

    return {
      _id: owner._id,
      fullName: owner.fullName,
      mobile: owner.mobile,
      email: owner.email,
      address: owner.address,
    };
  },

  /**
   * Add a vehicle (user/driver) to owner's fleet
   * @param {string} ownerId - Owner's user ID
   * @param {Object} data - User and vehicle data
   * @returns {Promise<Object>} Created user and vehicle
   */
  async addVehicle(ownerId, data) {
    const { user: userData, vehicle: vehicleData, profilePhoto, driverPhoto, rcPhoto, insurancePhoto, fitnessPhoto, pollutionPhoto, vehiclePhoto } = data;

    // Verify owner exists
    const owner = await userRepository.findById(ownerId);
    if (!owner) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Owner not found');
    }

    // Check if driver mobile already exists
    const existing = await userRepository.findByMobile(userData.mobile);
    if (existing) {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'User with this mobile number already exists');
    }

    // Create driver user linked to owner
    const driver = await userRepository.create({
      fullName: userData.fullName,
      mobile: userData.mobile,
      email: userData.email || null,
      walletSummary: { totalEarned: 0, availablePoints: 0, redeemedPoints: 0, expiredPoints: 0 },
      status: 'active',
      mobileVerified: true,
      address: userData.address || null,
      profilePhoto: profilePhoto || null,
      driverPhoto: driverPhoto || null,
      ownerId: ownerId, // Link to owner
    });

    // Create vehicle for driver
    const vehicle = await vehicleService.createVehicle({
      ...vehicleData,
      userId: driver._id,
      rcPhoto: rcPhoto || null,
      insurancePhoto: insurancePhoto || null,
      fitnessPhoto: fitnessPhoto || null,
      pollutionPhoto: pollutionPhoto || null,
      vehiclePhoto: vehiclePhoto || [],
    });

    return {
      userId: driver._id,
      vehicleId: vehicle._id,
      loyaltyId: vehicle.loyaltyId,
      user: await userRepository.findById(driver._id),
      vehicle,
    };
  },

  /**
   * Get all vehicles (users/drivers) in owner's fleet
   * @param {string} ownerId - Owner's user ID
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} List of fleet vehicles with vehicle details
   */
  async getFleetVehicles(ownerId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const result = await userRepository.list({ ownerId }, { page, limit });
    
    // Get vehicles for each driver
    const fleetData = await Promise.all(
      result.list.map(async (user) => {
        const vehicles = await vehicleRepository.list({ userId: user._id }, { page: 1, limit: 100 });
        return {
          ...user,
          vehicles: vehicles.list,
        };
      })
    );

    return {
      ...result,
      list: fleetData,
    };
  },
};
