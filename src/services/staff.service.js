import { staffRepository } from '../repositories/staff.repository.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

export const staffService = {
  /**
   * Get staff profile by ID.
   * @param {string} staffId - Staff _id
   * @returns {Promise<Object>} Staff document (no passwordHash)
   */
  async getProfile(staffId) {
    const staff = await staffRepository.findById(staffId);
    if (!staff) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Staff not found');
    }
    return staff;
  },

  /**
   * Update staff profile (fullName, email, address, profilePhoto).
   * @param {string} staffId - Staff _id
   * @param {Object} data - { fullName?, email?, address?, profilePhoto? }
   * @returns {Promise<Object>} Updated staff document
   */
  async updateProfile(staffId, data) {
    const staff = await staffRepository.findById(staffId);
    if (!staff) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Staff not found');
    }
    const updateData = {};
    if (data.fullName !== undefined) updateData.fullName = data.fullName.trim();
    if (data.email !== undefined) updateData.email = data.email ? data.email.trim().toLowerCase() : null;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.profilePhoto !== undefined) updateData.profilePhoto = data.profilePhoto || null;
    if (Object.keys(updateData).length === 0) {
      return staff;
    }
    return await staffRepository.update(staffId, updateData);
  },
};
