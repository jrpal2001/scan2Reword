import { Router } from 'express';
import { getPublicPumpList, getPublicPumpsBasicList } from '../controllers/pump.controller.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { pumpValidation } from '../validation/pump.validation.js';

const router = Router();

// Public: simple list of active pumps (id, name, code)
router.get('/list', getPublicPumpsBasicList);

// Public: list all active pumps with optional distance/search
router.get(
  '/',
  validateRequest(pumpValidation.publicList, 'query'),
  getPublicPumpList
);

export default router;
