import { userRepository } from '../repositories/user.repository.js';
import { vehicleService } from './vehicle.service.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * Scan/validate service - resolves identifier (loyaltyId, owner ID, mobile, vehicleId) to user/vehicle info.
 * Used for transaction entry and redemption.
 */
export const scanService = {
  /**
   * Validate identifier and return user/vehicle info.
   * @param {string} identifier - loyaltyId (vehicle/driver), owner ID (fleet owner), mobile, or vehicleId
   * @returns {Object} { user, vehicle, isOwner } - user info, vehicle info (if vehicle QR), and whether it's owner QR
   */
  async validateIdentifier(identifier) {
    if (!identifier || typeof identifier !== 'string') {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Identifier is required');
    }
    const trimmed = identifier.trim();

    // Try as loyaltyId (vehicle/driver)
    try {
      const vehicle = await vehicleService.getVehicleByLoyaltyId(trimmed);
      if (vehicle) {
        const user = await userRepository.findById(vehicle.userId);
        if (!user) {
          throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found for this vehicle');
        }
        return { user, vehicle, isOwner: false };
      }
    } catch (err) {
      if (err.statusCode === HTTP_STATUS.NOT_FOUND && err.message.includes('Vehicle not found')) {
        // Not a vehicle loyaltyId, continue
      } else {
        throw err;
      }
    }

    // Try as owner ID (userId) or mobile
    const user = await userRepository.findByIdentifier(trimmed);
    if (user) {
      // If user has ownerId set, they're a driver (not owner)
      // If user has no ownerId, they could be owner or individual user
      // For transaction: if scanned ID is owner ID (not via vehicle), credit to this user's account
      const isOwner = !user.ownerId; // No ownerId = not a driver, so could be owner or individual
      return { user, vehicle: null, isOwner };
    }

    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Identifier not found (not a vehicle loyaltyId, owner ID, or mobile)');
  },
};
