import { staffAssignmentRepository } from '../repositories/staffAssignment.repository.js';
import { staffRepository } from '../repositories/staff.repository.js';
import { managerRepository } from '../repositories/manager.repository.js';
import { pumpRepository } from '../repositories/pump.repository.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

function buildSearchFilter(search, fields) {
  if (!search || typeof search !== 'string' || !search.trim()) return {};
  const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(term, 'i');
  return {
    $or: fields.map((f) => ({ [f]: re })),
  };
}

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

  /**
   * List staff or managers who are not assigned to any pump.
   * @param {'staff'|'manager'} type - 'staff' = unassigned staff, 'manager' = unassigned managers (or not assigned to given pump)
   * @param {string} [search] - Optional search term; partial match on fullName, mobile, email, staffCode (staff) or managerCode (manager)
   * @param {{ page: number, limit: number, pumpId?: string }} options - Pagination; pumpId only for type=manager (managers not assigned to that pump)
   */
  async getUnassignedList(type, search, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const pagination = { page, limit, sort: { createdAt: -1 } };

    // Search fields: fullName, mobile, email, staffCode (for staff) or managerCode (for manager)
    const staffSearchFields = ['fullName', 'mobile', 'email', 'staffCode'];
    const managerSearchFields = ['fullName', 'mobile', 'email', 'managerCode'];

    if (type === 'staff') {
      const assignedStaffIds = await staffAssignmentRepository.getAssignedStaffIds();
      const filter = { _id: { $nin: assignedStaffIds } };
      const searchFilter = buildSearchFilter(search, staffSearchFields);
      const combined = Object.keys(searchFilter).length ? { $and: [filter, searchFilter] } : filter;
      return await staffRepository.list(combined, pagination);
    }

    if (type === 'manager') {
      let filter;
      if (options.pumpId) {
        const pump = await pumpRepository.findById(options.pumpId);
        if (!pump) {
          throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Pump not found');
        }
        // Exclude only the manager assigned to THIS pump. Show all others (including managers assigned to other pumps, since a manager can be assigned to multiple pumps).
        const currentManagerId = pump.managerId;
        filter = currentManagerId ? { _id: { $ne: currentManagerId } } : {};
      } else {
        const assignedManagerIds = await pumpRepository.getAssignedManagerIds();
        filter = { _id: { $nin: assignedManagerIds } };
      }
      const searchFilter = buildSearchFilter(search, managerSearchFields);
      const combined = Object.keys(searchFilter).length ? { $and: [filter, searchFilter] } : filter;
      return await managerRepository.list(combined, pagination);
    }

    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'type must be staff or manager');
  },
};
