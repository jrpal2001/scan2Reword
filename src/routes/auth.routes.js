import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authValidation } from '../validation/auth.validation.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { strictRateLimiter } from '../middlewares/rateLimiter.middleware.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { uploadToS3 } from '../middlewares/uploadToS3.js';

const router = Router();

// Rate limiting commented out for debugging
router.post('/send-otp', /* strictRateLimiter, */ validateRequest(authValidation.sendOtp), authController.sendOtp);
router.post('/verify-otp', /* strictRateLimiter, */ validateRequest(authValidation.verifyOtp), authController.verifyOtp);

// Registration with optional file uploads (multipart parsed by formDataParser; uploadToS3 builds req.s3Uploads)
router.post(
  '/register',
  uploadToS3('users/registration'),
  validateRequest(authValidation.register),
  authController.register
);

// Rate limiting commented out for debugging
router.post('/login', /* strictRateLimiter, */ validateRequest(authValidation.login), authController.login);
router.post('/verify-password', /* strictRateLimiter, */ validateRequest(authValidation.verifyPassword), authController.verifyPassword);
router.post('/refresh', validateRequest(authValidation.refresh), authController.refresh);
router.post('/set-password', verifyJWT, validateRequest(authValidation.setPassword), authController.setPassword);
router.post('/logout', verifyJWT, validateRequest(authValidation.logout), authController.logout);

export default router;
