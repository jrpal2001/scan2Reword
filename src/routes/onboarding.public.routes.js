import { Router } from 'express';
import { getPublicOnboardingList } from '../controllers/onboarding.controller.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { onboardingValidation } from '../validation/onboarding.validation.js';

const router = Router();

// Public: list active onboarding items (no auth). For app onboarding screens.
router.get(
  '/',
  validateRequest(onboardingValidation.publicList, 'query'),
  getPublicOnboardingList
);

export default router;
