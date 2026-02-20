import { Router } from 'express';
import * as vehicleController from '../controllers/vehicle.controller.js';
import * as walletController from '../controllers/wallet.controller.js';
import * as userController from '../controllers/user.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { vehicleValidation } from '../validation/vehicle.validation.js';

const router = Router();

// Referral code endpoint (must be before /:userId routes)
router.get('/referral-code', verifyJWT, userController.getReferralCode);

router.get('/vehicles', verifyJWT, vehicleController.getVehicles);
router.post('/vehicles', verifyJWT, validateRequest(vehicleValidation.create), vehicleController.addVehicle);
router.patch('/vehicles/:vehicleId', verifyJWT, validateRequest(vehicleValidation.update), vehicleController.updateVehicle);

// Wallet
router.get('/:userId/wallet', verifyJWT, walletController.getWallet);

export default router;