import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/rbac.middleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { notificationValidation } from '../validation/notification.validation.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

// Subscribe FCM token
router.post(
  '/subscribeToken',
  verifyJWT,
  validateRequest(notificationValidation.subscribeToken),
  notificationController.subscribeToken
);

// Get my notifications
router.get(
  '/my',
  verifyJWT,
  notificationController.getMyNotifications
);

// Delete my notification
router.delete(
  '/my',
  verifyJWT,
  validateRequest(notificationValidation.deleteMyNotification, 'body'),
  notificationController.deleteMyNotification
);

// Admin only - send notifications
router.post(
  '/all',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  validateRequest(notificationValidation.sendToAll),
  notificationController.sendNotificationToAll
);

router.post(
  '/',
  verifyJWT,
  requireRoles([ROLES.ADMIN]),
  validateRequest(notificationValidation.sendToUsers),
  notificationController.sendNotificationToUsers
);

export default router;
