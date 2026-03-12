import Admin from '../models/Admin.js';
import { notificationRepository } from '../repositories/notification.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { managerRepository } from '../repositories/manager.repository.js';
import { staffRepository } from '../repositories/staff.repository.js';
import admin, { isFirebaseInitialized } from '../firebase/firebase.js';
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
 * Create topic message (for "all" or "admin" notifications)
 */
function createTopicMessage(title, body, topic = 'all') {
  return {
    topic,
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
    if (!isFirebaseInitialized) {
      console.warn('[Firebase] Not initialized. Skipping token subscription.');
      return false;
    }
    try {
      await admin.messaging().subscribeToTopic([token], topic);
      return true;
    } catch (error) {
      console.error('Error subscribing token to topic:', error.message);
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to subscribe token');
    }
  },

  /**
   * Save FCM token to user/manager/staff/admin and subscribe to topic.
   * @param {string} userId - User/Manager/Staff/Admin _id
   * @param {string} token - FCM token
   * @param {string} [userType] - 'user' | 'manager' | 'staff' | 'admin' (from req.userType)
   */
  async saveAndSubscribeToken(userId, token, userType = 'user') {
    const type = (userType || 'user').toLowerCase();
    const topic = type === 'admin' ? 'admin' : 'all';

    if (type === 'admin') {
      const entity = await Admin.findById(userId).select('FcmTokens').lean();
      if (!entity) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Admin not found');
      }
      const tokens = entity.FcmTokens || [];
      if (!tokens.includes(token)) {
        await Admin.findByIdAndUpdate(userId, { FcmTokens: [...tokens, token] });
      }
      await this.subscribeTokenToTopic(token, topic);
      return { success: true };
    }

    let entity = null;
    let updateFn = null;
    if (type === 'manager') {
      entity = await managerRepository.findById(userId);
      updateFn = (id, data) => managerRepository.update(id, data);
    } else if (type === 'staff') {
      entity = await staffRepository.findById(userId);
      updateFn = (id, data) => staffRepository.update(id, data);
    } else {
      entity = await userRepository.findById(userId);
      updateFn = (id, data) => userRepository.update(id, data);
    }

    if (!entity) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, type === 'user' ? 'User not found' : type === 'manager' ? 'Manager not found' : 'Staff not found');
    }

    const tokens = entity.FcmTokens || [];
    if (!tokens.includes(token)) {
      await updateFn(userId, { FcmTokens: [...tokens, token] });
    }

    await this.subscribeTokenToTopic(token, topic);
    return { success: true };
  },

  /**
   * Send notification to all users, managers, and staff (via topic + in-app doc).
   */
  async sendToAll(title, body, link = null, img = null) {
    const [usersResult, managersResult, staffResult] = await Promise.all([
      userRepository.list({ status: 'active' }, { page: 1, limit: 10000 }),
      managerRepository.list({ status: 'active' }, { page: 1, limit: 1000 }),
      staffRepository.list({ status: 'active' }, { page: 1, limit: 1000 }),
    ]);
    const userIds = usersResult.list.map((u) => u._id);
    const managerIds = managersResult.list.map((m) => m._id);
    const staffIds = staffResult.list.map((s) => s._id);

    if (!isFirebaseInitialized) {
      console.warn('[Firebase] Not initialized. Skipping push notification. Creating in-app notification only.');
      const notification = await notificationRepository.create({
        title,
        body,
        link,
        img,
        notificationTime: new Date(),
        users: userIds,
        managerIds,
        staffIds,
      });
      return { notification, messageId: null };
    }

    const message = createTopicMessage(title, body);
    try {
      const response = await admin.messaging().send(message);
      const notification = await notificationRepository.create({
        title,
        body,
        link,
        img,
        notificationTime: new Date(),
        users: userIds,
        managerIds,
        staffIds,
      });
      return { notification, messageId: response };
    } catch (error) {
      console.error('Error sending notification to all:', error.message);
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to send notification');
    }
  },

  /** Create in-app notification for admin only and send FCM to topic 'admin' (e.g. new redemption request). */
  async createForAdmin(title, body, link = null, { redeemerFullName = null, redeemerLoyaltyId = null, redeemerMobile = null } = {}) {
    const notification = await notificationRepository.create({
      title,
      body,
      link: link || null,
      notificationTime: new Date(),
      forAdmin: true,
      redeemerFullName: redeemerFullName || null,
      redeemerLoyaltyId: redeemerLoyaltyId || null,
      redeemerMobile: redeemerMobile || null,
    });
    if (isFirebaseInitialized) {
      try {
        await admin.messaging().send(createTopicMessage(title, body, 'admin'));
      } catch (err) {
        console.warn('[Notification] FCM to admin topic failed:', err?.message);
      }
    }
    return notification;
  },

  /** Create one in-app notification for multiple recipient types (e.g. redemption approved: manager + user + owner). */
  async createForRecipients({
    title,
    body,
    link = null,
    userIds = [],
    managerIds = [],
    staffIds = [],
    redeemerFullName = null,
    redeemerLoyaltyId = null,
    redeemerMobile = null,
  }) {
    if (userIds.length === 0 && managerIds.length === 0 && staffIds.length === 0) return null;
    return notificationRepository.create({
      title,
      body,
      link: link || null,
      notificationTime: new Date(),
      users: userIds,
      managerIds,
      staffIds,
      redeemerFullName: redeemerFullName || null,
      redeemerLoyaltyId: redeemerLoyaltyId || null,
      redeemerMobile: redeemerMobile || null,
    });
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

    if (!isFirebaseInitialized) {
      console.warn('[Firebase] Not initialized. Skipping push notification. Creating in-app notification only.');
      // Still create notification documents for in-app list
      const notifications = [];
      for (const userId of validUserIds.length > 0 ? validUserIds : userIds) {
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
      return { notifications, results: [], errors: [] };
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
   * Get notifications for user, manager, or staff (by recipient type).
   */
  async getMyNotifications(recipientId, recipientType = 'user', options = {}) {
    const type = (recipientType || 'user').toLowerCase();
    if (type === 'manager') return notificationRepository.findByManagerId(recipientId, options);
    if (type === 'staff') return notificationRepository.findByStaffId(recipientId, options);
    return notificationRepository.findByUserId(recipientId, options);
  },

  /**
   * Delete notification for current recipient (remove from users/managerIds/staffIds).
   */
  async deleteMyNotification(notificationId, recipientId, recipientType = 'user') {
    const notification = await notificationRepository.findById(notificationId);
    if (!notification) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Notification not found');
    }

    const type = (recipientType || 'user').toLowerCase();
    const idStr = String(recipientId);
    const field = type === 'manager' ? 'managerIds' : type === 'staff' ? 'staffIds' : 'users';
    const list = notification[field] || [];
    const inList = list.some((id) => String(id) === idStr);
    if (!inList) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Notification not found for this user');
    }

    await notificationRepository.removeRecipient(notificationId, type, recipientId);
    return { success: true };
  },
};
