import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { staffAssignmentService } from '../services/staffAssignment.service.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * POST /api/admin/staff-assignments
 * Assign staff to pump
 */
export const assignStaffToPump = asyncHandler(async (req, res) => {
  const { staffId, pumpId } = req.validated;
  const assignment = await staffAssignmentService.assignStaffToPump(staffId, pumpId, req.user._id);
  return res.status(HTTP_STATUS.CREATED).json(
    ApiResponse.success(assignment, 'Staff assigned to pump successfully')
  );
});

/**
 * DELETE /api/admin/staff-assignments/:assignmentId
 * Remove staff from pump
 */
export const removeStaffFromPump = asyncHandler(async (req, res) => {
  const { assignmentId } = req.params;
  await staffAssignmentService.removeStaffFromPump(assignmentId, req.user._id);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(null, 'Staff removed from pump successfully')
  );
});

/**
 * GET /api/admin/staff-assignments
 * List all staff assignments
 */
export const listAssignments = asyncHandler(async (req, res) => {
  const { page, limit, staffId, pumpId, status } = req.query;
  const filter = {};
  if (staffId) filter.userId = staffId;
  if (pumpId) filter.pumpId = pumpId;
  if (status) filter.status = status;

  const result = await staffAssignmentService.listAssignments(filter, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
  });

  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(result, 'Assignments retrieved successfully')
  );
});

/**
 * GET /api/admin/staff-assignments/staff/:staffId
 * Get assignments for a specific staff member
 */
export const getAssignmentsByStaff = asyncHandler(async (req, res) => {
  const { staffId } = req.params;
  const assignments = await staffAssignmentService.getAssignmentsByStaff(staffId);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(assignments, 'Staff assignments retrieved successfully')
  );
});

/**
 * GET /api/admin/staff-assignments/pump/:pumpId
 * Get staff assigned to a specific pump
 */
export const getStaffByPump = asyncHandler(async (req, res) => {
  const { pumpId } = req.params;
  const staff = await staffAssignmentService.getStaffByPump(pumpId);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(staff, 'Pump staff retrieved successfully')
  );
});
