import { staffAssignmentRepository } from '../repositories/staffAssignment.repository.js';
import { staffRepository } from '../repositories/staff.repository.js';
import { pumpRepository } from '../repositories/pump.repository.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

export const staffAssignmentService = {
  /**
   * Assign staff to pump (staffId = Staff model _id)
   * RESTRICTION: Staff can only be assigned to ONE pump at a time
   */
  async assignStaffToPump(staffId, pumpId, adminId) {
    const staff = await staffRepository.findById(staffId);
    if (!staff) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Staff not found');
    }

    // Verify pump exists
    const pump = await pumpRepository.findById(pumpId);
    if (!pump) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Pump not found');
    }

    // RESTRICTION: Check if staff already has an active assignment to another pump
    const existingActive = await staffAssignmentRepository.findActiveAssignmentByStaff(staffId);
    if (existingActive) {
      // If trying to assign to the same pump, reactivate if inactive
      if (existingActive.pumpId.toString() === pumpId.toString()) {
        if (existingActive.status === 'active') {
          throw new ApiError(HTTP_STATUS.CONFLICT, 'Staff is already assigned to this pump');
        } else {
          // Reactivate existing assignment
          return await staffAssignmentRepository.update(existingActive._id, {
            status: 'active',
            assignedAt: new Date(),
            endDate: null,
          });
        }
      } else {
        // Staff is already assigned to a different pump
        throw new ApiError(HTTP_STATUS.CONFLICT, 'Staff can only be assigned to one pump. Please remove existing assignment first.');
      }
    }

    const assignment = await staffAssignmentRepository.create({
      staffId,
      pumpId,
      status: 'active',
      assignedAt: new Date(),
    });

    return assignment;
  },

  /**
   * Remove staff from pump (or deactivate assignment)
   */
  async removeStaffFromPump(assignmentId, adminId) {
    const assignment = await staffAssignmentRepository.findById(assignmentId);
    if (!assignment) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Assignment not found');
    }

    // Soft delete: set status to inactive
    const updated = await staffAssignmentRepository.update(assignmentId, {
      status: 'inactive',
      endDate: new Date(),
    });

    return updated;
  },

  /**
   * Get assignments for a staff member (staffId = Staff model _id)
   */
  async getAssignmentsByStaff(staffId, options = {}) {
    const staff = await staffRepository.findById(staffId);
    if (!staff) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Staff not found');
    }
    return await staffAssignmentRepository.findByStaffId(staffId, options);
  },

  /**
   * Get staff assigned to a pump
   */
  async getStaffByPump(pumpId, options = {}) {
    const pump = await pumpRepository.findById(pumpId);
    if (!pump) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Pump not found');
    }

    return await staffAssignmentRepository.findByPumpId(pumpId, options);
  },

  /**
   * List all assignments with filters
   */
  async listAssignments(filter = {}, options = {}) {
    return await staffAssignmentRepository.list(filter, options);
  },
};
