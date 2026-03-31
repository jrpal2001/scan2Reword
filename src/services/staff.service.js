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

    const { staffAssignmentRepository } = await import('../repositories/staffAssignment.repository.js');
    const { pumpRepository } = await import('../repositories/pump.repository.js');
    const { managerRepository } = await import('../repositories/manager.repository.js');

    const activeAssignment = await staffAssignmentRepository.findActiveAssignmentByStaff(staffId);
    const assignedPump = activeAssignment?.pumpId ? await pumpRepository.findById(activeAssignment.pumpId) : null;

    let managerIdsStr = [];
    if (assignedPump) {
      if (Array.isArray(assignedPump.managerIds) && assignedPump.managerIds.length > 0) {
        managerIdsStr = assignedPump.managerIds.filter(Boolean).map(id => String(id));
      } else if (assignedPump.managerId) {
        managerIdsStr = [String(assignedPump.managerId)];
      }
    } else if (staff.assignedManagerId) {
      managerIdsStr = [String(staff.assignedManagerId)];
    }

    const uniqueManagerIds = [...new Set(managerIdsStr)];
    const assignedManagersList = await Promise.all(
      uniqueManagerIds.map(id => managerRepository.findById(id))
    );

    staff.assignedManager = assignedManagersList.filter(Boolean).map(m => ({
      _id: m._id,
      fullName: m.fullName ?? null,
      managerCode: m.managerCode ?? null,
      mobile: m.mobile ?? null,
      profilePhoto: m.profilePhoto ?? null
    }));

    // Change assignedManagerId to array representation for consistency
    staff.assignedManagerId = uniqueManagerIds;

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
