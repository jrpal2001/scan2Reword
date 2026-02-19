import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authValidation } from '../validation/auth.validation.js';
import { validateRequest } from '../middlewares/validateRequest.js';

const router = Router();

router.post('/send-otp', validateRequest(authValidation.sendOtp), authController.sendOtp);
router.post('/verify-otp', validateRequest(authValidation.verifyOtp), authController.verifyOtp);
router.post('/register', validateRequest(authValidation.register), authController.register);
router.post('/login', validateRequest(authValidation.login), authController.login);

export default router;
