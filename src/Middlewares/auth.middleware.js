import jwt from 'jsonwebtoken';
import { asyncHandler } from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { config } from '../config/index.js';
import Admin from '../models/Admin.js';
import { userRepository } from '../repositories/user.repository.js';
import { managerRepository } from '../repositories/manager.repository.js';
import { staffRepository } from '../repositories/staff.repository.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import { ROLES } from '../constants/roles.js';

/**
 * Verify JWT and attach req.user, req.userType (role: 'admin' | 'manager' | 'staff' | 'user').
 * Resolves by decoded.userType: Admin, Manager, Staff, UserLoyalty.
 */
export const verifyJWT = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized — No token provided');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.accessSecret);
  } catch (err) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token');
  }

  const userType = decoded.userType || 'UserLoyalty';

  if (userType === 'Admin') {
    const admin = await Admin.findById(decoded._id).select('-password');
    if (!admin) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Admin not found or unauthorized');
    }
    req.user = {
      _id: admin._id,
      fullName: admin.name,
      email: admin.email,
      phone: admin.phone,
      role: ROLES.ADMIN,
      status: 'active',
    };
    req.userType = ROLES.ADMIN;
    return next();
  }

  if (userType === 'Manager') {
    const manager = await managerRepository.findById(decoded._id);
    if (!manager) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Manager not found or unauthorized');
    }
    if (manager.status !== 'active') {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Account is inactive or blocked');
    }
    req.user = { ...manager, role: ROLES.MANAGER };
    req.userType = ROLES.MANAGER;
    return next();
  }

  if (userType === 'Staff') {
    const staff = await staffRepository.findById(decoded._id);
    if (!staff) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Staff not found or unauthorized');
    }
    if (staff.status !== 'active') {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Account is inactive or blocked');
    }
    req.user = { ...staff, role: ROLES.STAFF };
    req.userType = ROLES.STAFF;
    return next();
  }

  // UserLoyalty (customer)
  const user = await userRepository.findById(decoded._id);
  if (!user) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'User not found or unauthorized');
  }
  if (user.status !== 'active') {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Account is inactive or blocked');
  }
  req.user = { ...user, role: ROLES.USER };
  req.userType = ROLES.USER;
  next();
});
