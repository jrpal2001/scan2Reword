import { managerRepository } from '../repositories/manager.repository.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

export const managerService = {
  /**
   * Get manager profile by ID.
   * @param {string} managerId - Manager _id
   * @returns {Promise<Object>} Manager document (no passwordHash)
   */
  async getProfile(managerId) {
    const manager = await managerRepository.findById(managerId);
    if (!manager) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Manager not found');
    }
    return manager;
  },

  /**
   * Update manager profile (fullName, email, address, profilePhoto).
   * @param {string} managerId - Manager _id
   * @param {Object} data - { fullName?, email?, address?, profilePhoto? }
   * @returns {Promise<Object>} Updated manager document
   */
  async updateProfile(managerId, data) {
    const manager = await managerRepository.findById(managerId);
    if (!manager) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Manager not found');
    }
    const updateData = {};
    if (data.fullName !== undefined) updateData.fullName = data.fullName.trim();
    if (data.email !== undefined) updateData.email = data.email ? data.email.trim().toLowerCase() : null;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.profilePhoto !== undefined) updateData.profilePhoto = data.profilePhoto || null;
    if (Object.keys(updateData).length === 0) {
      return manager;
    }
    return await managerRepository.update(managerId, updateData);
  },
};
