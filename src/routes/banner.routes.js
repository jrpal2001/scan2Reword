import { Router } from 'express';
import * as bannerController from '../controllers/banner.controller.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { bannerValidation } from '../validation/banner.validation.js';

const router = Router();

// Public endpoint - get active banners
router.get('/', validateRequest(bannerValidation.publicList, 'query'), bannerController.getActiveBanners);

export default router;
