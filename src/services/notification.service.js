import { notificationRepository } from '../repositories/notification.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import admin from '../firebase/firebase.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * Create FCM message payload
 */
function createNotificationMessage(title, body, link = null) {
  return {
    notification: { title, body },
    android: { priority: 'high' },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          'content-available': 1,
        },
      },
    },
    webpush: {
      notification: { title, body, icon: 'icon.png' },
      fcm_options: link ? { link } : undefined,
    },
    data: link ? { link } : undefined,
  };
}

/**
 * Create topic message (for "all" notifications)
 */
function createTopicMessage(title, body) {
  return {
    topic: 'all',
    notification: { title, body },
    android: { priority: 'high' },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          'content-available': 1,
        },
      },
    },
    webpush: {
      notification: { title, body, icon: 'icon.png' },
    },
  };
}

export const notificationService = {
  /**
   * Subscribe FCM token to topic
   */
  async subscribeTokenToTopic(token, topic = 'all') {
    try {
      await admin.messaging().subscribeToTopic([token], topic);
      return true;
    } catch (error) {
      console.error('Error subscribing token to topic:', error.message);
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to subscribe token');
    }
  },

  /**
   * Save FCM token to user and subscribe to topic
   */
  async saveAndSubscribeToken(userId, token) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
    }

    // Add token to user's FcmTokens array if not already present
    const tokens = user.FcmTokens || [];
    if (!tokens.includes(token)) {
      await userRepository.update(userId, {
        FcmTokens: [...tokens, token],
      });
    }

    // Subscribe to topic
    await this.subscribeTokenToTopic(token, 'all');

    return { success: true };
  },

  /**
   * Send notification to all users (via topic)
   */
  async sendToAll(title, body, link = null, img = null) {
    const message = createTopicMessage(title, body);
    
    try {
      const response = await admin.messaging().send(message);
      
      // Create notification document for all users (for in-app list)
      // Get all active users (for in-app notification list)
      // Note: Topic notification goes to all subscribed devices, but we create notification docs for in-app list
      // In production, you might want to batch this or use a different approach
      const users = await userRepository.list({ status: 'active' }, { page: 1, limit: 10000 });
      const userIds = users.list.map((u) => String(u._id));

      const notification = await notificationRepository.create({
        title,
        body,
        link,
        img,
        notificationTime: new Date(),
        users: userIds,
      });

      return { notification, messageId: response };
    } catch (error) {
      console.error('Error sending notification to all:', error.message);
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to send notification');
    }
  },

  /**
   * Send notification to specific users
   */
  async sendToUsers(userIds, title, body, link = null, img = null) {
    // Get FCM tokens for users
    const users = await userRepository.list({ _id: { $in: userIds } }, { page: 1, limit: 10000 });
    const tokens = [];
    const validUserIds = [];

    for (const user of users.list) {
      if (user.FcmTokens && user.FcmTokens.length > 0) {
        tokens.push(...user.FcmTokens);
        validUserIds.push(String(user._id));
      }
    }

    if (tokens.length === 0) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'No FCM tokens found for the specified users');
    }

    const message = createNotificationMessage(title, body, link);
    const results = [];
    const errors = [];

    // Send to each token
    for (const token of tokens) {
      try {
        const response = await admin.messaging().send({ ...message, token });
        results.push({ token, success: true, messageId: response });
      } catch (error) {
        errors.push({ token, error: error.message });
        // Remove invalid tokens from user
        if (error.code === 'messaging/invalid-registration-token' || error.code === 'messaging/registration-token-not-registered') {
          // TODO: Remove invalid token from user's FcmTokens array
        }
      }
    }

    // Create notification document for each user (for in-app list)
    const notifications = [];
    for (const userId of validUserIds) {
      const notification = await notificationRepository.create({
        title,
        body,
        link,
        img,
        notificationTime: new Date(),
        users: [userId],
      });
      notifications.push(notification);
    }

    return { notifications, results, errors };
  },

  /**
   * Get notifications for a user
   */
  async getMyNotifications(userId, options = {}) {
    return notificationRepository.findByUserId(userId, options);
  },

  /**
   * Delete notification for user (remove user from notification's users array)
   */
  async deleteMyNotification(notificationId, userId) {
    const notification = await notificationRepository.findById(notificationId);
    if (!notification) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Notification not found');
    }

    if (!notification.users || !notification.users.includes(userId)) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Notification not found for this user');
    }

    await notificationRepository.removeUserFromNotification(notificationId, userId);
    return { success: true };
  },
};
