import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { addISTToPayload } from '../utils/dateUtils.js';
import { notificationService } from '../services/notification.service.js';
import { notificationRepository } from '../repositories/notification.repository.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * POST /api/notifications/subscribeToken
 * Body: { token }
 * Subscribe FCM token to topic and save to user.
 */
export const subscribeToken = asyncHandler(async (req, res) => {
  const { token } = req.validated;
  const result = await notificationService.saveAndSubscribeToken(req.user._id, token, req.userType);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(result, 'Token subscribed successfully')
  );
});

/**
 * GET /api/notifications/my
 * Query: page?, limit?
 * Get notifications for authenticated user.
 */
export const getMyNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const result = await notificationService.getMyNotifications(req.user._id, req.userType, {
    page: parseInt(page),
    limit: parseInt(limit),
  });
  return res.sendPaginated(result, 'Notifications retrieved', HTTP_STATUS.OK);
});

/**
 * DELETE /api/notifications/my
 * Body: { notificationId }
 * Remove user from notification's users array.
 */
export const deleteMyNotification = asyncHandler(async (req, res) => {
  const { notificationId } = req.validated;
  await notificationService.deleteMyNotification(notificationId, req.user._id, req.userType);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(null, 'Notification deleted successfully')
  );
});

/**
 * POST /api/notifications/all
 * Body: { title, body, link?, img? }
 * Admin only - send notification to all users via topic.
 */
export const sendNotificationToAll = asyncHandler(async (req, res) => {
  const { title, body, link, img } = req.validated;
  const result = await notificationService.sendToAll(title, body, link, img);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(addISTToPayload(result), 'Notification sent to all users')
  );
});

/**
 * POST /api/notifications/
 * Body: { userIds, title, body, link?, img? }
 * Admin only - send notification to specific users.
 */
export const sendNotificationToUsers = asyncHandler(async (req, res) => {
  const { userIds, title, body, link, img } = req.validated;
  const result = await notificationService.sendToUsers(userIds, title, body, link, img);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(addISTToPayload(result), 'Notifications sent to users')
  );
});

/**
 * GET /api/admin/notifications
 * Admin only - list notifications for admin (e.g. new redemption requests, forAdmin: true).
 */
export const getAdminNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const result = await notificationRepository.findForAdmin({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
  });
  return res.sendPaginated(result, 'Admin notifications retrieved', HTTP_STATUS.OK);
});
