import { pumpRepository } from '../repositories/pump.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import { ROLES } from '../constants/roles.js';
import { PUMP_STATUS } from '../constants/status.js';

export const pumpService = {
  async createPump(data, adminId) {
    // Check if code already exists
    const existing = await pumpRepository.findByCode(data.code);
    if (existing) {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'Pump code already exists');
    }

    // Convert empty string managerId to null
    if (data.managerId === '' || data.managerId === undefined) {
      data.managerId = null;
    }

    // Validate managerId if provided
    if (data.managerId) {
      const manager = await userRepository.findById(data.managerId);
      if (!manager) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Manager not found');
      }
      if (manager.role?.toLowerCase() !== ROLES.MANAGER) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'User must have manager role');
      }
    }

    const pump = await pumpRepository.create({
      ...data,
      managerId: data.managerId || null, // Ensure null if empty
      status: data.status || PUMP_STATUS.ACTIVE,
    });
    return pump;
  },

  async updatePump(pumpId, data, adminId) {
    const existing = await pumpRepository.findById(pumpId);
    if (!existing) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Pump not found');
    }

    // Check code uniqueness if code is being updated
    if (data.code && data.code !== existing.code) {
      const codeExists = await pumpRepository.findByCode(data.code);
      if (codeExists) {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'Pump code already exists');
      }
    }

    // Convert empty string managerId to null
    if (data.managerId === '' || data.managerId === undefined) {
      data.managerId = null;
    }

    // Validate managerId if provided
    if (data.managerId !== undefined && data.managerId !== null) {
      const manager = await userRepository.findById(data.managerId);
      if (!manager) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Manager not found');
      }
      if (manager.role?.toLowerCase() !== ROLES.MANAGER) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'User must have manager role');
      }
    }

    // Ensure managerId is explicitly set to null if empty
    const updateData = {
      ...data,
      managerId: data.managerId !== undefined ? (data.managerId || null) : undefined,
    };

    const pump = await pumpRepository.update(pumpId, updateData);
    return pump;
  },

  async deletePump(pumpId) {
    const existing = await pumpRepository.findById(pumpId);
    if (!existing) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Pump not found');
    }
    await pumpRepository.delete(pumpId);
    return { success: true };
  },

  async getPumpById(pumpId) {
    const pump = await pumpRepository.findById(pumpId);
    if (!pump) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Pump not found');
    }
    return pump;
  },

  async listPumps(filter = {}, options = {}) {
    return pumpRepository.list(filter, options);
  },
};
