import { userRepository } from '../repositories/user.repository.js';
import { vehicleRepository } from '../repositories/vehicle.repository.js';
import { vehicleService } from './vehicle.service.js';
import { USER_TYPES } from '../models/User.model.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

export const ownerService = {
  /**
   * Search registered owners by partial match (e.g. "678" matches phones containing 678).
   * Searches mobile, fullName, loyaltyId. Paginated.
   * @param {string} query - Search term (min 1 char)
   * @param {Object} options - { page, limit }
   * @returns {Promise<{ list, total, page, limit, totalPages }>}
   */
  async searchOwner(query, options = {}) {
    const result = await userRepository.searchOwnersByQuery(query, options);
    const list = result.list.map((owner) => ({
      _id: owner._id,
      fullName: owner.fullName,
      mobile: owner.mobile,
      email: owner.email,
      address: owner.address,
      loyaltyId: owner.loyaltyId || null,
      profilePhoto: owner.profilePhoto || null,
    }));
    return { ...result, list };
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

    if (vehicleData?.vehicleNumber) {
      const existingVehicle = await vehicleRepository.findByVehicleNumber(vehicleData.vehicleNumber);
      if (existingVehicle) {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'Duplicate value for vehicleNumber');
      }
    }

    // Create driver user linked to owner
    const driver = await userRepository.create({
      fullName: userData.fullName,
      mobile: userData.mobile,
      email: userData.email || null,
      userType: USER_TYPES.DRIVER,
      walletSummary: { totalEarned: 0, availablePoints: 0, redeemedPoints: 0, expiredPoints: 0 },
      status: 'active',
      mobileVerified: true,
      address: userData.address || null,
      profilePhoto: profilePhoto || null,
      driverPhoto: driverPhoto || null,
      ownerId: ownerId, // Link to owner
    });

    let vehicle;
    try {
      vehicle = await vehicleService.createVehicle({
        ...vehicleData,
        userId: driver._id,
        rcPhoto: rcPhoto || null,
        insurancePhoto: insurancePhoto || null,
        fitnessPhoto: fitnessPhoto || null,
        pollutionPhoto: pollutionPhoto || null,
        vehiclePhoto: vehiclePhoto || [],
      });
    } catch (vehicleError) {
      await userRepository.delete(driver._id);
      throw vehicleError;
    }

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
