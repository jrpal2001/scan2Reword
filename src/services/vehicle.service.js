import { vehicleRepository } from '../repositories/vehicle.repository.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * Generate unique loyalty ID (e.g. LOY + 8 digits)
 */
function generateLoyaltyId() {
  const prefix = 'LOY';
  const randomDigits = Math.floor(10000000 + Math.random() * 90000000).toString();
  return `${prefix}${randomDigits}`;
}

export const vehicleService = {
  async generateLoyaltyId() {
    let loyaltyId;
    let exists = true;
    while (exists) {
      loyaltyId = generateLoyaltyId();
      const existing = await vehicleRepository.findByLoyaltyId(loyaltyId);
      exists = !!existing;
    }
    return loyaltyId;
  },

  async createVehicle(data) {
    if (!data.loyaltyId) {
      data.loyaltyId = await this.generateLoyaltyId();
    }
    const vehicle = await vehicleRepository.create(data);
    return vehicle;
  },

  async getVehiclesByUserId(userId) {
    return vehicleRepository.findByUserId(userId);
  },

  async getVehicleById(vehicleId) {
    const vehicle = await vehicleRepository.findById(vehicleId);
    if (!vehicle) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Vehicle not found');
    }
    return vehicle;
  },

  async getVehicleByLoyaltyId(loyaltyId) {
    const vehicle = await vehicleRepository.findByLoyaltyId(loyaltyId);
    if (!vehicle) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Vehicle not found');
    }
    return vehicle;
  },

  async updateVehicle(vehicleId, data) {
    const vehicle = await vehicleRepository.findById(vehicleId);
    if (!vehicle) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Vehicle not found');
    }
    return vehicleRepository.update(vehicleId, data);
  },
};
