import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import * as redemptionController from '../controllers/redemption.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requireRoles, attachPumpScope } from '../middlewares/rbac.middleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { userValidation } from '../validation/userValidation.js';
import { redemptionValidation } from '../validation/redemption.validation.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

router.post(
  '/users',
  verifyJWT,
  requireRoles([ROLES.STAFF]),
  attachPumpScope,
  validateRequest(userValidation.createUserByOperator),
  adminController.createUserByOperator
);

// At-pump redemption (staff)
router.post(
  '/redeem',
  verifyJWT,
  requireRoles([ROLES.STAFF]),
  attachPumpScope,
  validateRequest(redemptionValidation.atPumpRedemption),
  redemptionController.createAtPumpRedemption
);

export default router;
