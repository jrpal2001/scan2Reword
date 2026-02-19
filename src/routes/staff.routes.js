import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requireRoles, attachPumpScope } from '../middlewares/rbac.middleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { userValidation } from '../validation/userValidation.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

router.post(
  '/users',verifyJWT,requireRoles([ROLES.STAFF]),attachPumpScope,validateRequest(userValidation.createUserByOperator),adminController.createUserByOperator);

export default router;
