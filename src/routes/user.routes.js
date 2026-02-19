import { Router } from 'express';
import * as vehicleController from '../controllers/vehicle.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { vehicleValidation } from '../validation/vehicle.validation.js';

const router = Router();

router.get('/vehicles', verifyJWT, vehicleController.getVehicles);
router.post(
  '/vehicles',
  verifyJWT,
  validateRequest(vehicleValidation.create),
  vehicleController.addVehicle
);
router.put(
  '/vehicles/:vehicleId',
  verifyJWT,
  validateRequest(vehicleValidation.update),
  vehicleController.updateVehicle
);

export default router;