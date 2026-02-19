import { Router } from 'express';
import * as scanController from '../controllers/scan.controller.js';
import { scanValidation } from '../validation/scan.validation.js';
import { validateRequest } from '../middlewares/validateRequest.js';

const router = Router();

router.post('/validate', validateRequest(scanValidation.validateIdentifier), scanController.validateIdentifier);

export default router;
