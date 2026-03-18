import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import * as redemptionController from '../controllers/redemption.controller.js';
import * as dashboardController from '../controllers/dashboard.controller.js';
import * as staffController from '../controllers/staff.controller.js';
import * as referralController from '../controllers/referral.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requireRoles, attachPumpScope } from '../middlewares/rbac.middleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { userValidation } from '../validation/userValidation.js';
import { redemptionValidation } from '../validation/redemption.validation.js';
import { ROLES } from '../constants/roles.js';
import { uploadToS3 } from '../middlewares/uploadToS3.js';
import { parseBodyJson } from '../middlewares/parseBodyJson.js';
import { upload, userUploadFields, profileUpdateFields } from '../utils/multerConfig.js';

const router = Router();

// Staff profile (must be before /:param routes)
router.get('/profile', verifyJWT, requireRoles([ROLES.STAFF]), staffController.getProfile);
router.patch(
  '/profile',
  verifyJWT,
  requireRoles([ROLES.STAFF]),
  upload.fields(profileUpdateFields),
  parseBodyJson,
  uploadToS3('staff/profile'),
  validateRequest(userValidation.staffProfileUpdate),
  staffController.updateProfile
);

// Staff dashboard (assigned pump(s), transactions, revenue, points, recent transactions)
router.get(
  '/dashboard',
  verifyJWT,
  requireRoles([ROLES.STAFF]),
  attachPumpScope,
  dashboardController.getStaffDashboard
);

// Referral summary + points/redemption history (staff's own points)
router.get(
  '/referrals/summary',
  verifyJWT,
  requireRoles([ROLES.STAFF]),
  referralController.getMyReferralSummary
);
router.get(
  '/referrals/history',
  verifyJWT,
  requireRoles([ROLES.STAFF]),
  referralController.getMyReferralHistory
);

router.post(
  '/users',
  verifyJWT,
  requireRoles([ROLES.STAFF]),
  attachPumpScope,
  upload.fields(userUploadFields),
  parseBodyJson,
  uploadToS3('users'),
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
