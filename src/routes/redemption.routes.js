import { Router } from 'express';
import * as redemptionController from '../controllers/redemption.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requireRoles, attachPumpScope } from '../middlewares/rbac.middleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { redemptionValidation } from '../validation/redemption.validation.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

// User-initiated redemption
router.post(
  '/',
  verifyJWT,
  requireRoles([ROLES.USER]),
  validateRequest(redemptionValidation.create),
  redemptionController.createRedemption
);

// At-pump redemption (manager/staff)
router.post(
  '/at-pump',
  verifyJWT,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF]),
  attachPumpScope,
  validateRequest(redemptionValidation.atPumpRedemption),
  redemptionController.createAtPumpRedemption
);

// Approve/reject redemption (manager)
router.post(
  '/:id/approve',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  redemptionController.approveRedemption
);

router.post(
  '/:id/reject',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  validateRequest(redemptionValidation.reject),
  redemptionController.rejectRedemption
);

// Verify redemption code (public, but can be used by manager/staff too)
router.post(
  '/:code/verify',
  verifyJWT,
  redemptionController.verifyRedemptionCode
);

// Use redemption code (mark as used)
router.post(
  '/:code/use',
  verifyJWT,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF]),
  redemptionController.useRedemptionCode
);

// List redemptions
router.get(
  '/',
  verifyJWT,
  redemptionController.listRedemptions
);

// Get redemption by ID
router.get(
  '/:redemptionId',
  verifyJWT,
  redemptionController.getRedemptionById
);

export default router;
