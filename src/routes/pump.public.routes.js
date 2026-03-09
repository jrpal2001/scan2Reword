import { Router } from 'express';
import { getPublicPumpList } from '../controllers/pump.controller.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { pumpValidation } from '../validation/pump.validation.js';

const router = Router();

// Public: list all active pumps; optional lat, lng to get distance and sort by distance
router.get(
  '/',
  validateRequest(pumpValidation.publicList, 'query'),
  getPublicPumpList
);

export default router;
