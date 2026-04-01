import { Router } from 'express';
import * as vehicleController from '../controllers/vehicle.controller.js';
import * as walletController from '../controllers/wallet.controller.js';
import * as userController from '../controllers/user.controller.js';
import * as pumpBackgroundController from '../controllers/pumpBackground.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/rbac.middleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { vehicleValidation } from '../validation/vehicle.validation.js';
import { userValidation } from '../validation/userValidation.js';
import { ROLES } from '../constants/roles.js';
import { uploadToS3 } from '../middlewares/uploadToS3.js';
import { parseBodyJson } from '../middlewares/parseBodyJson.js';
import { upload, profileUpdateFields } from '../utils/multerConfig.js';

const router = Router();

// Profile (individual, owner, fleet driver) - must be before /:userId
router.get('/profile', verifyJWT, userController.getProfile);
router.patch(
  '/profile',
  verifyJWT,
  upload.fields(profileUpdateFields),
  parseBodyJson,
  uploadToS3('users/profile'),
  validateRequest(userValidation.updateProfile),
  userController.updateProfile
);

// Dashboard (points summary, recent transactions)
router.get('/dashboard', verifyJWT, userController.getDashboard);

// Referral code (manager/staff only)
router.get('/referral-code', verifyJWT, userController.getReferralCode);

router.get('/vehicles', verifyJWT, vehicleController.getVehicles);
router.post('/vehicles', verifyJWT, validateRequest(vehicleValidation.create), vehicleController.addVehicle);
router.patch('/vehicles/:vehicleId', verifyJWT, validateRequest(vehicleValidation.update), vehicleController.updateVehicle);

// My transactions (individual/driver/owner) – pagination + filters: vehicleId, category, status, dates, time
router.get(
  '/transactions',
  verifyJWT,
  validateRequest(userValidation.listMyTransactions, 'query'),
  userController.listMyTransactions
);

// Lookup customer by loyaltyId, vehicleNumber, or mobile (admin, manager, staff, owner, user)
router.get(
  '/scan/lookup',
  verifyJWT,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF, ROLES.USER]),
  validateRequest(userValidation.lookupCustomer, 'query'),
  userController.lookupCustomer
);

// Wallet (public — no access token, by vehicleId)
router.get('/wallet/:vehicleId', walletController.getUserWallet);

// Wallet (authenticated — by userId)
router.get('/:userId/wallet', verifyJWT, walletController.getWallet);

//pump background
router.get(
  '/pump-background',
  verifyJWT,
  pumpBackgroundController.getPublicBackgrounds
);

export default router;