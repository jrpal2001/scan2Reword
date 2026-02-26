import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
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
    ownerOnly: !!v.ownerOnly,
    accountType: v.accountType || 'individual',
    mobile: v.mobile,
    fullName: v.fullName,
    email: v.email || undefined,
    role: v.role,
    password: v.password || undefined,
    address: v.address || undefined,
    profilePhoto: s3Uploads.profilePhoto || undefined,
    driverPhoto: s3Uploads.driverPhoto || undefined,
    ownerPhoto: s3Uploads.ownerPhoto || undefined,
    managerCode: v.managerCode || undefined,
    staffCode: v.staffCode || undefined,
    assignedManagerId: v.assignedManagerId && v.assignedManagerId.trim() ? v.assignedManagerId : undefined,
    pumpId: v.pumpId && v.pumpId.trim() ? v.pumpId : undefined, // For staff - assign to pump during creation
    referralCode: v.referralCode && v.referralCode.trim() ? v.referralCode.trim() : undefined,
    // Organization fields
    ownerType: v.ownerType || undefined,
    ownerIdentifier: v.ownerIdentifier || undefined,
    owner: v.owner || undefined,
  };
  
  // Prepare vehicle data with optional photos
  const vehicleData = v.vehicle ? {
    ...v.vehicle,
    rcPhoto: s3Uploads.rcPhoto || null,
    insurancePhoto: s3Uploads.insurancePhoto || null,
    fitnessPhoto: s3Uploads.fitnessPhoto || null,
    pollutionPhoto: s3Uploads.pollutionPhoto || null,
    vehiclePhoto: Array.isArray(s3Uploads.vehiclePhoto) ? s3Uploads.vehiclePhoto : (s3Uploads.vehiclePhoto ? [s3Uploads.vehiclePhoto] : []),
  } : null;

  const result = await userService.createUserByAdmin(userData, vehicleData, req.user._id);

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

  // Include ownerId if organization account
  if (result.ownerId) {
    responseData.ownerId = result.ownerId;
  }

  const assignmentMessage = result.assignment ? ' and assigned to pump' : '';
  const ownerMessage = result.ownerId ? (result.user.ownerId ? ' (linked to existing owner)' : ' (owner created)') : '';

  return res.status(HTTP_STATUS.CREATED).json(
    ApiResponse.success(
      responseData,
      'User created successfully' + assignmentMessage + ownerMessage
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
    ownerOnly: !!v.ownerOnly,
    accountType: v.accountType || 'individual',
    mobile: v.mobile,
    fullName: v.fullName,
    email: v.email || undefined,
    role: v.role || ROLES.USER,
    password: v.password || undefined,
    address: v.address || undefined,
    profilePhoto: s3Uploads.profilePhoto || undefined,
    driverPhoto: s3Uploads.driverPhoto || undefined,
    ownerPhoto: s3Uploads.ownerPhoto || undefined,
    staffCode: v.staffCode || undefined,
    assignedManagerId,
    pumpId: v.pumpId && v.pumpId.trim() ? v.pumpId : undefined, // For staff - assign to pump during creation
    // Organization fields
    ownerType: v.ownerType || undefined,
    ownerIdentifier: v.ownerIdentifier || undefined,
    owner: v.owner || undefined,
  };
  
  // Prepare vehicle data with optional photos
  const vehicleData = v.vehicle ? {
    ...v.vehicle,
    rcPhoto: s3Uploads.rcPhoto || null,
    insurancePhoto: s3Uploads.insurancePhoto || null,
    fitnessPhoto: s3Uploads.fitnessPhoto || null,
    pollutionPhoto: s3Uploads.pollutionPhoto || null,
    vehiclePhoto: Array.isArray(s3Uploads.vehiclePhoto) ? s3Uploads.vehiclePhoto : (s3Uploads.vehiclePhoto ? [s3Uploads.vehiclePhoto] : []),
  } : null;

  const result = await userService.createUserByManagerOrStaff(
    userData,
    vehicleData,
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

  // Include ownerId if organization account
  if (result.ownerId) {
    responseData.ownerId = result.ownerId;
  }

  const assignmentMessage = result.assignment ? ' and assigned to pump' : '';
  const ownerMessage = result.ownerId ? (result.user.ownerId ? ' (linked to existing owner)' : ' (owner created)') : '';

  return res.status(HTTP_STATUS.CREATED).json(
    ApiResponse.success(
      responseData,
      'User created successfully' + assignmentMessage + ownerMessage
    )
  );
});

/**
 * GET /api/admin/users
 * List users with filters and pagination
 */
export const listUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, search } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { mobile: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  const result = await userService.listUsers(
    filter,
    { page: parseInt(page), limit: parseInt(limit) },
    req.allowedPumpIds || null
  );

  return res.sendPaginated(result, 'Users retrieved successfully', HTTP_STATUS.OK);
});

/**
 * GET /api/admin/users/:userId
 * Get user by ID. Admin: any user. Manager (GET /api/manager/users/:userId): only if user registered at manager's pump.
 */
export const getUserById = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const user = await userService.getUserById(userId);
  const allowedPumpIds = req.allowedPumpIds;
  if (allowedPumpIds != null && Array.isArray(allowedPumpIds) && allowedPumpIds.length > 0) {
    if (!user.registeredPumpId || !allowedPumpIds.map((id) => String(id)).includes(String(user.registeredPumpId))) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'You can only view users who registered at your pump(s)');
    }
  }
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(user, 'User retrieved successfully')
  );
});

/**
 * PATCH /api/admin/users/:userId
 * Query: type (optional) - 'manager' | 'staff' | 'user'. If omitted, treats as customer (user).
 * Update user (customer), staff, or manager. For staff you can set assignedManagerId. For pump assignment use POST /api/admin/staff-assignments.
 */
export const updateUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const updateData = req.validated;
  const type = (req.query.type || 'user').toLowerCase();

  let before = null;
  let updated = null;
  let entityType = 'User';

  if (type === 'staff') {
    const staffBefore = await userService.getStaffById(userId);
    if (!staffBefore) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Staff not found');
    before = { fullName: staffBefore.fullName, email: staffBefore.email, assignedManagerId: staffBefore.assignedManagerId };
    updated = await userService.updateStaff(userId, updateData, req.user._id);
    entityType = 'Staff';
  } else if (type === 'manager') {
    const managerBefore = await userService.getManagerById(userId);
    if (!managerBefore) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Manager not found');
    before = { fullName: managerBefore.fullName, email: managerBefore.email };
    updated = await userService.updateManager(userId, updateData, req.user._id);
    entityType = 'Manager';
  } else {
    const userBefore = await userService.getUserById(userId);
    before = { fullName: userBefore.fullName, email: userBefore.email, role: userBefore.role, status: userBefore.status };
    updated = await userService.updateUser(userId, updateData, req.user._id);
    entityType = 'User';
  }

  await auditLogService.log({
    userId: req.user._id,
    action: 'user.update',
    entityType,
    entityId: userId,
    before,
    after: { fullName: updated.fullName, email: updated.email, ...(updated.assignedManagerId !== undefined && { assignedManagerId: updated.assignedManagerId }) },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  const message = type === 'staff' ? 'Staff updated successfully' : type === 'manager' ? 'Manager updated successfully' : 'User updated successfully';
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(updated, message)
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

/**
 * DELETE /api/admin/users/:userId
 * Query: type (optional) - 'manager' | 'staff' | 'user'. If omitted, resolves by checking Manager, then Staff, then User.
 * Delete any user (manager, staff, or customer). Admin only.
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const query = req.validated || {};
  const type = query.type || null;

  const result = await userService.deleteUser(userId, type);

  await auditLogService.log({
    userId: req.user._id,
    action: 'user.delete',
    entityType: result.type === 'manager' ? 'Manager' : result.type === 'staff' ? 'Staff' : 'User',
    entityId: userId,
    before: null,
    after: { deleted: true, type: result.type },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success({ deleted: true, type: result.type }, `${result.type} deleted successfully`)
  );
});
