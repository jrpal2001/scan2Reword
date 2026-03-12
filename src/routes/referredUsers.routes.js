import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/rbac.middleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { userValidation } from '../validation/userValidation.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

/**
 * GET /api/users/referred
 * Admin/Manager/Staff: list users referred/registered by a manager/staff.
 * - Admin: must pass referrerId (manager/staff id)
 * - Manager/Staff: referrerId optional (defaults to self); cannot query other ids
 */
router.get(
  '/referred',
  verifyJWT,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF]),
  validateRequest(userValidation.listReferredUsers, 'query'),
  adminController.listReferredUsers
);

export default router;

