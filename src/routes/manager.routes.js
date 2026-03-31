import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import * as dashboardController from '../controllers/dashboard.controller.js';
import * as managerController from '../controllers/manager.controller.js';
import * as walletController from '../controllers/wallet.controller.js';
import * as campaignController from '../controllers/campaign.controller.js';
import * as bannerController from '../controllers/banner.controller.js';
import * as redemptionController from '../controllers/redemption.controller.js';
import * as transactionController from '../controllers/transaction.controller.js';
import * as statsController from '../controllers/stats.controller.js';
import * as referralController from '../controllers/referral.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requireRoles, attachPumpScope } from '../middlewares/rbac.middleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { userValidation } from '../validation/userValidation.js';
import { walletValidation } from '../validation/wallet.validation.js';
import { campaignValidation } from '../validation/campaign.validation.js';
import { bannerValidation } from '../validation/banner.validation.js';
import { redemptionValidation } from '../validation/redemption.validation.js';
import { transactionValidation } from '../validation/transaction.validation.js';
import { statsValidation } from '../validation/stats.validation.js';
import { ROLES } from '../constants/roles.js';
import { uploadToS3 } from '../middlewares/uploadToS3.js';
import { parseBodyJson } from '../middlewares/parseBodyJson.js';
import { normalizeFormBody } from '../middlewares/normalizeFormBody.js';
import { upload, userUploadFields, profileUpdateFields, bannerUploadFields } from '../utils/multerConfig.js';

const router = Router();

// Manager profile (must be before /:param routes)
router.get('/profile', verifyJWT, requireRoles([ROLES.MANAGER]), managerController.getProfile);
router.patch(
  '/profile',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  upload.fields(profileUpdateFields),
  parseBodyJson,
  uploadToS3('managers/profile'),
  validateRequest(userValidation.managerProfileUpdate),
  managerController.updateProfile
);

// My assigned pumps
router.get(
  '/pumps',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  managerController.listMyPumps
);

// Dashboard
router.get(
  '/dashboard',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  dashboardController.getManagerDashboard
);

// Referral summary + points/redemption history (manager's own points)
router.get(
  '/referrals/summary',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  referralController.getMyReferralSummary
);
router.get(
  '/referrals/history',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  referralController.getMyReferralHistory
);

router.post(
  '/users',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  upload.fields(userUploadFields),
  parseBodyJson,
  uploadToS3('users'),
  validateRequest(userValidation.createUserByOperator),
  adminController.createUserByOperator
);

// List users who registered at this manager's pump(s)
router.get(
  '/users',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  adminController.listUsers
);

// List all users for manager (same response shape as listUsers API)
router.get(
  '/users/all',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  adminController.listUsers
);

router.get(
  '/users/:userId',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  adminController.getUserById
);

// Wallet adjustment (pump-scoped)
router.post(
  '/wallet/adjust',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  validateRequest(walletValidation.adjust),
  walletController.adjustWallet
);

// Campaigns CRUD (pump-scoped)
router.post(
  '/campaigns',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  validateRequest(campaignValidation.create),
  campaignController.createCampaign
);

router.get(
  '/campaigns',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  campaignController.listCampaigns
);

router.get(
  '/campaigns/:campaignId',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  campaignController.getCampaignById
);

router.patch(
  '/campaigns/:campaignId',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  validateRequest(campaignValidation.update),
  campaignController.updateCampaign
);

router.delete(
  '/campaigns/:campaignId',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  campaignController.deleteCampaign
);

// Banners CRUD (pump-scoped; form-data: imageUrl = file upload to S3)
router.post(
  '/banners',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  upload.fields(bannerUploadFields),
  parseBodyJson,
  normalizeFormBody,
  uploadToS3('banners'),
  validateRequest(bannerValidation.create),
  bannerController.createBanner
);

router.get(
  '/banners',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  bannerController.listBanners
);

router.get(
  '/banners/:bannerId',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  bannerController.getBannerById
);

router.patch(
  '/banners/:bannerId',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  upload.fields(bannerUploadFields),
  parseBodyJson,
  normalizeFormBody,
  uploadToS3('banners'),
  validateRequest(bannerValidation.update),
  bannerController.updateBanner
);

router.delete(
  '/banners/:bannerId',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  bannerController.deleteBanner
);

// Redemptions (approve/reject, at-pump redemption)
router.post(
  '/redeem',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  validateRequest(redemptionValidation.atPumpRedemption),
  redemptionController.createAtPumpRedemption
);

router.post(
  '/redemptions/:id/approve',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  redemptionController.approveRedemption
);

router.post(
  '/redemptions/:id/reject',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  validateRequest(redemptionValidation.reject),
  redemptionController.rejectRedemption
);

// Review statistics (no pagination). Scoped to manager's pumps. Filters: startDate, endDate, month, year, startTime, endTime, pumpId?, userId?
router.get(
  '/stats/review',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  validateRequest(statsValidation.review, 'query'),
  statsController.getReviewStats
);

// User registration graph (users registered at manager's pumps). Query: startDate?, endDate?, month?, year?, groupBy?
router.get(
  '/stats/user-registrations',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  validateRequest(statsValidation.userRegistrationGraph, 'query'),
  statsController.getUserRegistrationGraph
);

// Transactions (list for manager's pump(s))
router.get(
  '/transactions',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  validateRequest(transactionValidation.list, 'query'),
  transactionController.listTransactions
);

// Download user statement as PDF for manager's pump scope
router.get(
  '/transactions/statement/download',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  validateRequest(transactionValidation.downloadStatement, 'query'),
  transactionController.downloadUserStatement
);

// Get transaction by ID
router.get(
  '/transactions/:transactionId',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  transactionController.getTransactionById
);

// Update transaction (correct liters/amount; points recalculated, wallet adjusted)
router.patch(
  '/transactions/:transactionId',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  validateRequest(transactionValidation.update),
  transactionController.updateTransaction
);

export default router;
