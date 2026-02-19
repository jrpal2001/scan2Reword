import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import * as walletController from '../controllers/wallet.controller.js';
import * as campaignController from '../controllers/campaign.controller.js';
import * as bannerController from '../controllers/banner.controller.js';
import * as redemptionController from '../controllers/redemption.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requireRoles, attachPumpScope } from '../middlewares/rbac.middleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { userValidation } from '../validation/userValidation.js';
import { walletValidation } from '../validation/wallet.validation.js';
import { campaignValidation } from '../validation/campaign.validation.js';
import { bannerValidation } from '../validation/banner.validation.js';
import { redemptionValidation } from '../validation/redemption.validation.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

router.post(
  '/users',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
  validateRequest(userValidation.createUserByOperator),
  adminController.createUserByOperator
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

router.put(
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

// Banners CRUD (pump-scoped)
router.post(
  '/banners',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
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

router.put(
  '/banners/:bannerId',
  verifyJWT,
  requireRoles([ROLES.MANAGER]),
  attachPumpScope,
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

export default router;
