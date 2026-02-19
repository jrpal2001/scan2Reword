import Notification from '../models/notification.model.js';

/**
 * Notification repository - data access only.
 */
export const notificationRepository = {
  async create(data) {
    const notification = await Notification.create(data);
    return notification;
  },

  async findById(id) {
    return Notification.findById(id).lean();
  },

  async findByUserId(userId, options = {}) {
    const { page = 1, limit = 20, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      Notification.find({ users: userId }).sort(sort).skip(skip).limit(limit).lean(),
      Notification.countDocuments({ users: userId }),
    ]);
    return { list, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async removeUserFromNotification(notificationId, userId) {
    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { $pull: { users: userId } },
      { new: true }
    ).lean();
    return notification;
  },

  async list(filter = {}, options = {}) {
    const { page = 1, limit = 20, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      Notification.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
    ]);
    return { list, total, page, limit, totalPages: Math.ceil(total / limit) };
  },
};
