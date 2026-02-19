import { Router } from 'express';
import * as rewardController from '../controllers/reward.controller.js';

const router = Router();

// Public endpoint - get available rewards
router.get('/', rewardController.getRewards);

export default router;
