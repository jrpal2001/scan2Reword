import { Router } from 'express';
import { adminLogin } from '../controllers/adminAuth.controller.js';
import * as adminController from '../controllers/admin.controller.js';
import * as pumpController from '../controllers/pump.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/rbac.middleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { userValidation } from '../validation/userValidation.js';
import { adminValidation } from '../validation/admin.validation.js';
import { pumpValidation } from '../validation/pump.validation.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

// Admin login (legacy Admin model — email + password, cookies)
router.post('/login', validateRequest(adminValidation.login), adminLogin);

// ——— RBAC: routes below use UserLoyalty JWT (from POST /api/auth/login) ———
router.get('/me', verifyJWT, requireRoles([ROLES.ADMIN]), (req, res) => {
  res.status(200).json({ success: true, user: req.user, userType: req.userType });
});

// Users
router.post(
  '/users',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  validateRequest(userValidation.createUser),
  adminController.createUser
);

// Pumps CRUD
router.post(
  '/pumps',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  validateRequest(pumpValidation.create),
  pumpController.createPump
);

router.get(
  '/pumps',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  pumpController.listPumps
);

router.get(
  '/pumps/:pumpId',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  pumpController.getPumpById
);

router.put(
  '/pumps/:pumpId',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  validateRequest(pumpValidation.update),
  pumpController.updatePump
);

router.delete(
  '/pumps/:pumpId',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  pumpController.deletePump
);

export default router;