import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { userService } from '../services/user.service.js';
import { auditLogService } from '../services/auditLog.service.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import { ROLES } from '../constants/roles.js';
import { USER_STATUS } from '../constants/status.js';

/**
 * POST /api/admin/users
 * Body: req.validated (mobile, fullName, email?, role?, vehicle?)
 * Admin only.
 */
export const createUser = asyncHandler(async (req, res) => {
  const v = req.validated;
  const s3Uploads = req.s3Uploads || {};
  const userData = {
    mobile: v.mobile,
    fullName: v.fullName,
    email: v.email || undefined,
    role: v.role,
    password: v.password || undefined,
    address: v.address || undefined,
    profilePhoto: s3Uploads.profilePhoto || undefined,
    managerCode: v.managerCode || undefined,
    staffCode: v.staffCode || undefined,
    assignedManagerId: v.assignedManagerId && v.assignedManagerId.trim() ? v.assignedManagerId : undefined,
    pumpId: v.pumpId && v.pumpId.trim() ? v.pumpId : undefined, // For staff - assign to pump during creation
  };
  const result = await userService.createUserByAdmin(userData, v.vehicle || null, req.user._id);

  // Log audit
  await auditLogService.log({
    userId: req.user._id,
    action: 'user.create',
    entityType: 'User',
    entityId: result.user._id,
    before: null,
    after: { fullName: result.user.fullName, mobile: result.user.mobile, role: result.user.role },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  const responseData = {
    user: result.user,
    vehicle: result.vehicle,
  };
  
  // Include assignment info if staff was assigned to pump
  if (result.assignment) {
    responseData.assignment = result.assignment;
  }

  const assignmentMessage = result.assignment ? ' and assigned to pump' : '';

  return res.status(HTTP_STATUS.CREATED).json(
    ApiResponse.success(
      responseData,
      'User created successfully' + assignmentMessage
    )
  );
});

/**
 * POST /api/manager/users or POST /api/staff/users
 * Body: req.validated (mobile, fullName, email?, role?, vehicle?)
 * Manager can create staff or user, Staff can only create user
 */
export const createUserByOperator = asyncHandler(async (req, res) => {
  const v = req.validated;
  const operatorRole = (req.userType || req.user?.role || '').toLowerCase();
  
  // Staff cannot create staff, only managers can
  if (v.role === ROLES.STAFF && operatorRole !== ROLES.MANAGER) {
    return res.status(HTTP_STATUS.FORBIDDEN).json(
      ApiResponse.error('Only managers can create staff members')
    );
  }

  const s3Uploads = req.s3Uploads || {};
  let assignedManagerId = v.assignedManagerId && v.assignedManagerId.trim() ? v.assignedManagerId : undefined;
  if (v.role === ROLES.STAFF && !assignedManagerId && operatorRole === ROLES.MANAGER) {
    assignedManagerId = req.user._id; // Default to current manager when manager creates staff
  }
  const userData = {
    mobile: v.mobile,
    fullName: v.fullName,
    email: v.email || undefined,
    role: v.role || ROLES.USER,
    password: v.password || undefined,
    address: v.address || undefined,
    profilePhoto: s3Uploads.profilePhoto || undefined,
    staffCode: v.staffCode || undefined,
    assignedManagerId,
    pumpId: v.pumpId && v.pumpId.trim() ? v.pumpId : undefined, // For staff - assign to pump during creation
  };
  
  const result = await userService.createUserByManagerOrStaff(
    userData,
    v.vehicle || null,
    req.user._id,
    operatorRole
  );
  
  const responseData = {
    user: result.user,
    vehicle: result.vehicle,
  };
  
  // Include assignment info if staff was assigned to pump
  if (result.assignment) {
    responseData.assignment = result.assignment;
  }

  const assignmentMessage = result.assignment ? ' and assigned to pump' : '';

  return res.status(HTTP_STATUS.CREATED).json(
    ApiResponse.success(
      responseData,
      'User created successfully' + assignmentMessage
    )
  );
});

/**
 * GET /api/admin/users
 * List users with filters and pagination
 */
export const listUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, role, status, search } = req.query;
  const filter = {};
  
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { mobile: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const result = await userService.listUsers(filter, {
    page: parseInt(page),
    limit: parseInt(limit),
  });

  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(result, 'Users retrieved successfully')
  );
});

/**
 * GET /api/admin/users/:userId
 * Get user by ID
 */
export const getUserById = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const user = await userService.getUserById(userId);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(user, 'User retrieved successfully')
  );
});

/**
 * PUT /api/admin/users/:userId
 * Update user
 */
export const updateUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const updateData = req.validated;

  // Get user before update for audit log
  const userBefore = await userService.getUserById(userId);

  const updated = await userService.updateUser(userId, updateData, req.user._id);

  // Log audit
  await auditLogService.log({
    userId: req.user._id,
    action: 'user.update',
    entityType: 'User',
    entityId: userId,
    before: { fullName: userBefore.fullName, email: userBefore.email, role: userBefore.role, status: userBefore.status },
    after: { fullName: updated.fullName, email: updated.email, role: updated.role, status: updated.status },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(updated, 'User updated successfully')
  );
});

/**
 * PUT /api/admin/users/:userId/status
 * Block/unblock user
 */
export const updateUserStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { status } = req.validated;

  // Get user before update for audit log
  const userBefore = await userService.getUserById(userId);

  const updated = await userService.updateUserStatus(userId, status, req.user._id);

  // Log audit
  await auditLogService.log({
    userId: req.user._id,
    action: `user.${status === USER_STATUS.BLOCKED ? 'block' : 'unblock'}`,
    entityType: 'User',
    entityId: userId,
    before: { status: userBefore.status },
    after: { status: updated.status },
    metadata: { reason: req.body.reason || null },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(updated, `User ${status === USER_STATUS.BLOCKED ? 'blocked' : 'unblocked'} successfully`)
  );
});
