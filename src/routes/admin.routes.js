import { Router } from 'express';
import { adminLogin } from '../controllers/adminAuth.controller.js';
import * as adminController from '../controllers/admin.controller.js';
import * as dashboardController from '../controllers/dashboard.controller.js';
import * as pumpController from '../controllers/pump.controller.js';
import * as walletController from '../controllers/wallet.controller.js';
import * as campaignController from '../controllers/campaign.controller.js';
import * as bannerController from '../controllers/banner.controller.js';
import * as rewardController from '../controllers/reward.controller.js';
import * as systemConfigController from '../controllers/systemConfig.controller.js';
import * as staffAssignmentController from '../controllers/staffAssignment.controller.js';
import * as redemptionController from '../controllers/redemption.controller.js';
import * as notificationController from '../controllers/notification.controller.js';
import * as onboardingController from '../controllers/onboarding.controller.js';
import * as statsController from '../controllers/stats.controller.js';
import * as pumpBackgroundController from '../controllers/pumpBackground.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requireRoles, attachPumpScope, requirePumpAccess } from '../middlewares/rbac.middleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { userValidation } from '../validation/userValidation.js';
import { adminValidation } from '../validation/admin.validation.js';
import { pumpValidation } from '../validation/pump.validation.js';
import { walletValidation } from '../validation/wallet.validation.js';
import { campaignValidation } from '../validation/campaign.validation.js';
import { bannerValidation } from '../validation/banner.validation.js';
import { rewardValidation } from '../validation/reward.validation.js';
import { systemConfigValidation } from '../validation/systemConfig.validation.js';
import { staffAssignmentValidation } from '../validation/staffAssignment.validation.js';
import { redemptionValidation } from '../validation/redemption.validation.js';
import { onboardingValidation } from '../validation/onboarding.validation.js';
import { statsValidation } from '../validation/stats.validation.js';
import { pumpBackgroundValidation } from '../validation/pumpBackground.validation.js';
import { ROLES } from '../constants/roles.js';
import { uploadToS3 } from '../middlewares/uploadToS3.js';
import { parseBodyJson } from '../middlewares/parseBodyJson.js';
import { normalizeFormBody } from '../middlewares/normalizeFormBody.js';
import { upload, userUploadFields, pumpUploadFields, bannerUploadFields, onboardingUploadFields } from '../utils/multerConfig.js';

const router = Router();

// Debug logging for admin routes
router.use((req, res, next) => {
  console.log('[Admin Routes] Request:', req.method, req.path, { body: req.body, validated: req.validated });
  next();
});

// Admin login (legacy Admin model — email + password, cookies)
router.post('/login', validateRequest(adminValidation.login), adminLogin);

// ——— RBAC: routes below use UserLoyalty JWT (from POST /api/auth/login) ———
router.get('/me', verifyJWT, requireRoles([ROLES.ADMIN]), (req, res) => {
  res.status(200).json({ success: true, user: req.user, userType: req.userType });
});

// Dashboard
router.get(
  '/dashboard',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  dashboardController.getAdminDashboard
);

// Review statistics (no pagination, no attachments). Filters: startDate, endDate, month, year, startTime, endTime, pumpId?, userId?
router.get(
  '/stats/review',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  attachPumpScope,
  validateRequest(statsValidation.review, 'query'),
  statsController.getReviewStats
);

// User registration graph. Query: startDate?, endDate?, month?, year?, groupBy? ('day' | 'month')
router.get(
  '/stats/user-registrations',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  attachPumpScope,
  validateRequest(statsValidation.userRegistrationGraph, 'query'),
  statsController.getUserRegistrationGraph
);

// Users: one multer per route, allowed fields from multerConfig
router.post(
  '/users',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  upload.fields(userUploadFields),
  parseBodyJson,
  uploadToS3('users'),
  validateRequest(userValidation.createUser),
  adminController.createUser
);

router.get(
  '/users',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  adminController.listUsers
);

router.get(
  '/users/:userId',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  adminController.getUserById
);

router.patch(
  '/users/:userId',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  validateRequest(userValidation.updateUser),
  adminController.updateUser
);

router.patch(
  '/users/:userId/status',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  validateRequest(userValidation.updateUserStatus),
  adminController.updateUserStatus
);

router.delete(
  '/users/:userId',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  validateRequest(userValidation.deleteUser, 'query'),
  adminController.deleteUser
);

// Managers (list + get by ID; no password in response)
router.get(
  '/managers',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  adminController.listManagers
);
router.get(
  '/managers/:managerId',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  adminController.getManagerById
);

// Staff (list + get by ID; no password in response)
router.get(
  '/staff',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  adminController.listStaff
);
router.get(
  '/staff/:staffId',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  adminController.getStaffById
);

// Pumps CRUD (create/update support multipart with pumpImages)
router.post(
  '/pumps',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  upload.fields(pumpUploadFields),
  parseBodyJson,
  uploadToS3('pumps'),
  validateRequest(pumpValidation.create),
  pumpController.createPump
);

router.get(
  '/pumps',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  pumpController.listPumps
);

router.get(
  '/pumps/:pumpId',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  pumpController.getPumpById
);

router.patch(
  '/pumps/:pumpId',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  upload.fields(pumpUploadFields),
  parseBodyJson,
  uploadToS3('pumps'),
  validateRequest(pumpValidation.update),
  pumpController.updatePump
);

router.delete(
  '/pumps/:pumpId',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  pumpController.deletePump
);

// Wallet adjustment
router.post(
  '/wallet/adjust',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  validateRequest(walletValidation.adjust),
  walletController.adjustWallet
);

// Campaigns CRUD
router.post(
  '/campaigns',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  validateRequest(campaignValidation.create),
  campaignController.createCampaign
);

router.get(
  '/campaigns',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  campaignController.listCampaigns
);

router.get(
  '/campaigns/:campaignId',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  campaignController.getCampaignById
);

router.patch(
  '/campaigns/:campaignId',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  validateRequest(campaignValidation.update),
  campaignController.updateCampaign
);

router.delete(
  '/campaigns/:campaignId',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  campaignController.deleteCampaign
);

// Banners CRUD (form-data: imageUrl = file upload to S3; other fields in body or JSON string)
router.post(
  '/banners',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
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
  requireRoles([ROLES.ADMIN]),
  bannerController.listBanners
);

router.get(
  '/banners/:bannerId',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  bannerController.getBannerById
);

router.patch(
  '/banners/:bannerId',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
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
  requireRoles([ROLES.ADMIN]),
  bannerController.deleteBanner
);

// Rewards CRUD
router.post(
  '/rewards',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  validateRequest(rewardValidation.create),
  rewardController.createReward
);

router.get(
  '/rewards',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  rewardController.listRewards
);

router.get(
  '/rewards/:rewardId',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  rewardController.getRewardById
);

router.patch(
  '/rewards/:rewardId',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  validateRequest(rewardValidation.update),
  rewardController.updateReward
);

router.delete(
  '/rewards/:rewardId',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  rewardController.deleteReward
);

// System Config
router.get(
  '/config',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  systemConfigController.getConfig
);

router.patch(
  '/config',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  validateRequest(systemConfigValidation.update),
  systemConfigController.updateConfig
);

// Staff Assignments (Admin + Manager; Manager can only assign to their pumps)
router.post(
  '/staff-assignments',
  verifyJWT,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER]),
  attachPumpScope,
  validateRequest(staffAssignmentValidation.assign),
  staffAssignmentController.assignStaffToPump
);

router.get(
  '/staff-assignments',
  verifyJWT,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER]),
  attachPumpScope,
  validateRequest(staffAssignmentValidation.list, 'query'),
  staffAssignmentController.listAssignments
);

router.get(
  '/employee-list',
  verifyJWT,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER]),
  attachPumpScope,
  validateRequest(staffAssignmentValidation.unassigned, 'query'),
  staffAssignmentController.getUnassignedList
);

router.get(
  '/staff-assignments/staff/:staffId',
  verifyJWT,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER]),
  attachPumpScope,
  staffAssignmentController.getAssignmentsByStaff
);

router.get(
  '/staff-assignments/pump/:pumpId',
  verifyJWT,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER]),
  attachPumpScope,
  requirePumpAccess,
  staffAssignmentController.getStaffByPump
);

router.delete(
  '/staff-assignments/:assignmentId',
  verifyJWT,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER]),
  attachPumpScope,
  staffAssignmentController.removeStaffFromPump
);

// Admin notifications (e.g. new redemption requests from manager/staff)
router.get(
  '/notifications',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  notificationController.getAdminNotifications
);

// Onboarding (admin CRUD) — onboardImage[]; create/update = multipart "images" (max 10)
router.post(
  '/onboarding',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  upload.fields(onboardingUploadFields),
  parseBodyJson,
  normalizeFormBody,
  uploadToS3('onboarding'),
  validateRequest(onboardingValidation.create),
  onboardingController.createOnboarding
);
router.get(
  '/onboarding',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  validateRequest(onboardingValidation.list, 'query'),
  onboardingController.listOnboarding
);
router.get(
  '/onboarding/:id',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  onboardingController.getOnboardingById
);
router.patch(
  '/onboarding/:id',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  upload.fields(onboardingUploadFields),
  parseBodyJson,
  normalizeFormBody,
  uploadToS3('onboarding'),
  validateRequest(onboardingValidation.update),
  onboardingController.updateOnboarding
);
router.delete(
  '/onboarding/:id',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  onboardingController.deleteOnboarding
);

// Redemptions: admin direct redeem, approve/reject (manager/staff redemptions go to admin for approval)
router.post(
  '/redemptions/direct',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  validateRequest(redemptionValidation.directRedemption),
  redemptionController.createDirectRedemption
);
router.post(
  '/redemptions/:id/approve',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  redemptionController.approveRedemption
);
router.post(
  '/redemptions/:id/reject',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  validateRequest(redemptionValidation.reject, 'body'),
  redemptionController.rejectRedemption
);

//background images crud

router.post(
  '/pump-background',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  upload.fields([{ name: 'imageUrl', maxCount: 10 }]),
  parseBodyJson,
  normalizeFormBody,
  uploadToS3('pump-background'),
  validateRequest(pumpBackgroundValidation.create),
  pumpBackgroundController.createBackground
);

router.get(
  '/pump-background',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  pumpBackgroundController.getAllBackgrounds
);

router.get(
  '/pump-background/:id',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  pumpBackgroundController.getBackgroundById
);

router.patch(
  '/pump-background/:id',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  upload.fields([{ name: 'imageUrl', maxCount: 10 }]),
  parseBodyJson,
  normalizeFormBody,
  uploadToS3('pump-background'),
  validateRequest(pumpBackgroundValidation.update),
  pumpBackgroundController.updateBackground
);

router.delete(
  '/pump-background/:id',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  pumpBackgroundController.deleteBackground
);

router.get(
  '/public/pump-background',
  pumpBackgroundController.getPublicBackgrounds
);

export default router;