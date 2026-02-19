import jwt from 'jsonwebtoken';
import { asyncHandler } from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { config } from '../config/index.js';
import User from '../models/User.model.js';
import Admin from '../models/Admin.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * Verify JWT and attach req.user, req.userType (role).
 * Supports both UserLoyalty model (new system) and Admin model (legacy).
 * Use for protected routes (all roles: admin, manager, staff, user).
 */
export const verifyJWT = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  console.log('[verifyJWT] Token received:', { hasToken: !!token, authHeader: authHeader?.substring(0, 20) });

  if (!token) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized — No token provided');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.accessSecret);
    console.log('[verifyJWT] Token decoded:', { _id: decoded._id, userType: decoded.userType, role: decoded.role });
  } catch (err) {
    console.log('[verifyJWT] Token verification failed:', err.message);
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token');
  }

  // Check if this is a legacy Admin token (has userType: "Admin")
  if (decoded.userType === 'Admin') {
    console.log('[verifyJWT] Legacy Admin token detected, looking up Admin model');
    const admin = await Admin.findById(decoded._id).select('-password');
    if (!admin) {
      console.log('[verifyJWT] Admin not found for ID:', decoded._id);
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Admin not found or unauthorized');
    }
    // Convert Admin to user-like object for compatibility
    req.user = {
      _id: admin._id,
      fullName: admin.name,
      email: admin.email,
      phone: admin.phone,
      role: 'admin', // Map Admin userType to 'admin' role
      status: 'active', // Legacy admins are always active
    };
    req.userType = 'admin';
    console.log('[verifyJWT] Admin authenticated:', { _id: admin._id, email: admin.email });
    return next();
  }

  // Otherwise, look up in UserLoyalty model
  console.log('[verifyJWT] UserLoyalty token detected, looking up User model');
  const user = await User.findById(decoded._id).select('-passwordHash');
  if (!user) {
    console.log('[verifyJWT] User not found for ID:', decoded._id);
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'User not found or unauthorized');
  }
  if (user.status !== 'active') {
    console.log('[verifyJWT] User account is inactive:', user.status);
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Account is inactive or blocked');
  }

  req.user = user;
  req.userType = (user.role || decoded.role || '').toLowerCase();
  console.log('[verifyJWT] User authenticated:', { _id: user._id, role: req.userType });
  next();
});
