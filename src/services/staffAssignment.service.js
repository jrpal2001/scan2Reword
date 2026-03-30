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

function getManagerIdsFromPump(pump) {
  if (Array.isArray(pump?.managerIds) && pump.managerIds.length > 0) {
    return [...new Set(pump.managerIds.filter(Boolean).map((id) => String(id?._id ?? id)))];
  }
  return pump?.managerId ? [String(pump.managerId?._id ?? pump.managerId)] : [];
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

    // Hard delete the assignment
    await staffAssignmentRepository.delete(assignmentId);

    return true; // Indicate success
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
   * List staff or managers for assignment UI.
   * @param {'staff'|'manager'} type - 'staff' = unassigned staff, 'manager' = all managers (or managers not assigned to pumpId when provided)
   * @param {string} [search] - Optional search term; partial match on fullName, mobile, email, staffCode (staff) or managerCode (manager)
   * @param {{ page: number, limit: number, pumpId?: string }} options - Pagination; pumpId only for type=manager (for pump existence validation/context)
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
      const filter = {};
      if (options.pumpId) {
        const pump = await pumpRepository.findById(options.pumpId);
        if (!pump) {
          throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Pump not found');
        }
        // Exclude managers already assigned to this specific pump.
        const assignedToPump = getManagerIdsFromPump(pump);
        if (assignedToPump.length > 0) {
          filter._id = { $nin: assignedToPump };
        }
      }
      const searchFilter = buildSearchFilter(search, managerSearchFields);
      const hasFilter = Object.keys(filter).length > 0;
      const hasSearch = Object.keys(searchFilter).length > 0;
      const combined = hasFilter && hasSearch
        ? { $and: [filter, searchFilter] }
        : hasFilter
          ? filter
          : hasSearch
            ? searchFilter
            : {};
      return await managerRepository.list(combined, pagination);
    }

    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'type must be staff or manager');
  },
};
