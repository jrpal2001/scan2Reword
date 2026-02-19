import { Router } from 'express';
import * as transactionController from '../controllers/transaction.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requireRoles, attachPumpScope } from '../middlewares/rbac.middleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { uploadToS3 } from '../middlewares/uploadToS3.js';
import { transactionValidation } from '../validation/transaction.validation.js';
import { upload } from '../utils/multerConfig.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

// Create transaction (with file upload to AWS S3)
router.post(
  '/',
  verifyJWT,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF]),
  attachPumpScope,
  upload.array('attachments', 5), // Max 5 files
  uploadToS3('transactions'),
  validateRequest(transactionValidation.create),
  transactionController.createTransaction
);

// List transactions
router.get(
  '/',
  verifyJWT,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF]),
  attachPumpScope,
  validateRequest(transactionValidation.list, 'query'),
  transactionController.listTransactions
);

// Get transaction by ID
router.get(
  '/:transactionId',
  verifyJWT,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF]),
  attachPumpScope,
  transactionController.getTransactionById
);

export default router;
