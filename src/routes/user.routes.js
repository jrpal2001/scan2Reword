import { Router } from 'express';
import * as vehicleController from '../controllers/vehicle.controller.js';
import * as walletController from '../controllers/wallet.controller.js';
import * as userController from '../controllers/user.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { vehicleValidation } from '../validation/vehicle.validation.js';
import { userValidation } from '../validation/userValidation.js';
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

// Wallet
router.get('/:userId/wallet', verifyJWT, walletController.getWallet);

export default router;