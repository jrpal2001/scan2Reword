import { Router } from 'express';
import * as bannerController from '../controllers/banner.controller.js';

const router = Router();

// Public endpoint - get active banners
router.get('/', bannerController.getActiveBanners);

export default router;
