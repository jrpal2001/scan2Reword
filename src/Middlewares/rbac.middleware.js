import { asyncHandler } from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { ROLES } from '../constants/roles.js';
import { pumpRepository } from '../repositories/pump.repository.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * Require that the authenticated user has one of the allowed roles.
 * Must be used after verifyJWT (so req.user and req.userType are set).
 *
 * @param {string[]} allowedRoles - e.g. ['admin'], ['admin', 'manager'], ['user']
 */
export const requireRoles = (allowedRoles) => {
  const allowed = allowedRoles.map((r) => r.toLowerCase());
  return asyncHandler((req, res, next) => {
    const role = (req.userType || req.user?.role || '').toLowerCase();
    if (!role) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Role not found');
    }
    if (!allowed.includes(role)) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, `Access denied. Required role: ${allowed.join(' or ')}`);
    }
    next();
  });
};

/**
 * Attach pump scope to request for manager/staff.
 * - Admin: req.allowedPumpIds = null (means all pumps)
 * - Manager: req.allowedPumpIds = [pumpIds where pump.managerId = req.user._id]
 * - Staff: req.allowedPumpIds = [pumpIds from StaffAssignment where userId = req.user._id]
 * - User (customer): req.allowedPumpIds = [] (no pump-scoped access for data)
 *
 * Must be used after verifyJWT and optionally after requireRoles(['admin','manager','staff']).
 */
export const attachPumpScope = asyncHandler(async (req, res, next) => {
  const role = (req.userType || req.user?.role || '').toLowerCase();

  if (role === ROLES.ADMIN) {
    req.allowedPumpIds = null; // null = all pumps
    return next();
  }

  if (role === ROLES.MANAGER) {
    const pumpIds = await pumpRepository.findPumpIdsByManagerId(req.user._id);
    req.allowedPumpIds = pumpIds;
    return next();
  }

  if (role === ROLES.STAFF) {
    const pumpIds = await pumpRepository.findPumpIdsByStaffId(req.user._id);
    req.allowedPumpIds = pumpIds;
    return next();
  }

  req.allowedPumpIds = [];
  next();
});

/**
 * Require that the user can access the given pumpId (for manager/staff).
 * Use in routes that receive pumpId in params/body. Call after attachPumpScope.
 */
export const requirePumpAccess = asyncHandler((req, res, next) => {
  const pumpId = req.params.pumpId || req.body.pumpId;
  if (!pumpId) {
    return next();
  }

  if (req.allowedPumpIds === null) {
    return next(); // admin
  }

  const allowed = (req.allowedPumpIds || []).map((id) => String(id));
  const requested = String(pumpId);
  if (!allowed.includes(requested)) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied to this pump');
  }
  next();
});

/**
 * Helper: check if current user can access a resource by userId (for "own resource" check).
 * Customer (user role) can only access their own userId.
 */
export const requireOwnResource = (paramName = 'userId') =>
  asyncHandler((req, res, next) => {
    const role = (req.userType || req.user?.role || '').toLowerCase();
    if (role === ROLES.ADMIN || role === ROLES.MANAGER || role === ROLES.STAFF) {
      return next();
    }
    const resourceUserId = req.params[paramName] || req.body[paramName];
    if (!resourceUserId) return next();
    if (String(resourceUserId) !== String(req.user._id)) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied to this resource');
    }
    next();
  });
