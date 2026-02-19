import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { userService } from '../services/user.service.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import { ROLES } from '../constants/roles.js';

/**
 * POST /api/admin/users
 * Body: req.validated (mobile, fullName, email?, role?, vehicle?)
 * Admin only.
 */
export const createUser = asyncHandler(async (req, res) => {
  const v = req.validated;
  const userData = {
    mobile: v.mobile,
    fullName: v.fullName,
    email: v.email || undefined,
    role: v.role,
  };
  const result = await userService.createUserByAdmin(userData, v.vehicle || null, req.user._id);
  return res.status(HTTP_STATUS.CREATED).json(
    ApiResponse.success(
      { user: result.user, vehicle: result.vehicle },
      'User created successfully'
    )
  );
});

/**
 * POST /api/manager/users or POST /api/staff/users
 * Body: req.validated (mobile, fullName, email?, vehicle?)
 * Manager/Staff create customer (role=user) only; optional vehicle.
 */
export const createUserByOperator = asyncHandler(async (req, res) => {
  const v = req.validated;
  const userData = {
    mobile: v.mobile,
    fullName: v.fullName,
    email: v.email || undefined,
    role: ROLES.USER,
  };
  const role = (req.userType || req.user?.role || '').toLowerCase();
  const result = await userService.createUserByManagerOrStaff(
    userData,
    v.vehicle || null,
    req.user._id,
    role
  );
  return res.status(HTTP_STATUS.CREATED).json(
    ApiResponse.success(
      { user: result.user, vehicle: result.vehicle },
      'User created successfully'
    )
  );
});
