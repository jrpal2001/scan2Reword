import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import * as walletController from '../controllers/wallet.controller.js';
import * as campaignController from '../controllers/campaign.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requireRoles, attachPumpScope } from '../middlewares/rbac.middleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { userValidation } from '../validation/userValidation.js';
import { walletValidation } from '../validation/wallet.validation.js';
import { campaignValidation } from '../validation/campaign.validation.js';
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

export default router;
