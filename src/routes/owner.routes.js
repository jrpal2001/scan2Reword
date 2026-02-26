import { Router } from 'express';
import * as ownerController from '../controllers/owner.controller.js';
import * as dashboardController from '../controllers/dashboard.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/rbac.middleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { ownerValidation } from '../validation/owner.validation.js';
import { uploadToS3 } from '../middlewares/uploadToS3.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

// Fleet aggregation
router.get(
  '/fleet-aggregation',
  verifyJWT,
  requireRoles([ROLES.USER]),
  dashboardController.getFleetAggregation
);

// Search owner (public endpoint for registration flow)
router.get(
  '/search',
  validateRequest(ownerValidation.searchOwner, 'query'),
  ownerController.searchOwner
);

// Owner endpoints (authenticated)
router.post(
  '/vehicles',
  verifyJWT,
  uploadToS3('owners/fleet'),
  validateRequest(ownerValidation.addVehicle),
  ownerController.addVehicle
);

router.get(
  '/vehicles',
  verifyJWT,
  ownerController.getFleetVehicles
);

export default router;
