import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authValidation } from '../validation/auth.validation.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { upload } from '../utils/multerConfig.js';
import { uploadToS3 } from '../middlewares/uploadToS3.js';

const router = Router();

router.post('/send-otp', validateRequest(authValidation.sendOtp), authController.sendOtp);
router.post('/verify-otp', validateRequest(authValidation.verifyOtp), authController.verifyOtp);

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

router.post('/login', validateRequest(authValidation.login), authController.login);

export default router;
