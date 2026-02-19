import jwt from 'jsonwebtoken';
import { asyncHandler } from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { config } from '../config/index.js';
import User from '../models/User.model.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * Verify JWT and attach req.user, req.userType (role).
 * Use for protected routes (all roles: admin, manager, staff, user).
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

  const user = await User.findById(decoded._id).select('-passwordHash');
  if (!user) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'User not found or unauthorized');
  }
  if (user.status !== 'active') {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Account is inactive or blocked');
  }

  req.user = user;
  req.userType = (user.role || decoded.role || '').toLowerCase();
  next();
});
