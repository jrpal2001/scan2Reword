import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authValidation } from '../validation/auth.validation.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { strictRateLimiter } from '../middlewares/rateLimiter.middleware.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { upload } from '../utils/multerConfig.js';
import { uploadToS3 } from '../middlewares/uploadToS3.js';

const router = Router();

// Rate limiting commented out for debugging
router.post('/send-otp', /* strictRateLimiter, */ validateRequest(authValidation.sendOtp), authController.sendOtp);
router.post('/verify-otp', /* strictRateLimiter, */ validateRequest(authValidation.verifyOtp), authController.verifyOtp);

// Registration with optional file uploads
router.post(
  '/register',
  upload.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'driverPhoto', maxCount: 1 },
    { name: 'ownerPhoto', maxCount: 1 },
    { name: 'rcPhoto', maxCount: 1 },
  ]),
  uploadToS3('users/registration'),
  validateRequest(authValidation.register),
  authController.register
);

// Rate limiting commented out for debugging
router.post('/login', /* strictRateLimiter, */ validateRequest(authValidation.login), authController.login);
router.post('/refresh', validateRequest(authValidation.refresh), authController.refresh);
router.post('/logout', verifyJWT, validateRequest(authValidation.logout), authController.logout);

export default router;
