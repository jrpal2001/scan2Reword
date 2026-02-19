import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { notificationService } from '../services/notification.service.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * POST /api/notifications/subscribeToken
 * Body: { token }
 * Subscribe FCM token to topic and save to user.
 */
export const subscribeToken = asyncHandler(async (req, res) => {
  const { token } = req.validated;
  const result = await notificationService.saveAndSubscribeToken(req.user._id, token);
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
  const { page = 1, limit = 20 } = req.query;
  const result = await notificationService.getMyNotifications(req.user._id, {
    page: parseInt(page),
    limit: parseInt(limit),
  });
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(result, 'Notifications retrieved')
  );
});

/**
 * DELETE /api/notifications/my
 * Body: { notificationId }
 * Remove user from notification's users array.
 */
export const deleteMyNotification = asyncHandler(async (req, res) => {
  const { notificationId } = req.validated;
  await notificationService.deleteMyNotification(notificationId, req.user._id);
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
    ApiResponse.success(result, 'Notification sent to all users')
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
    ApiResponse.success(result, 'Notifications sent to users')
  );
});
