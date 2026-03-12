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
    const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      Notification.find({ users: userId }).sort(sort).skip(skip).limit(limit).lean(),
      Notification.countDocuments({ users: userId }),
    ]);
    return { list, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async findByManagerId(managerId, options = {}) {
    const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      Notification.find({ managerIds: managerId }).sort(sort).skip(skip).limit(limit).lean(),
      Notification.countDocuments({ managerIds: managerId }),
    ]);
    return { list, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async findByStaffId(staffId, options = {}) {
    const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      Notification.find({ staffIds: staffId }).sort(sort).skip(skip).limit(limit).lean(),
      Notification.countDocuments({ staffIds: staffId }),
    ]);
    return { list, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async findForAdmin(options = {}) {
    const { page = 1, limit = 50, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      Notification.find({ forAdmin: true }).sort(sort).skip(skip).limit(limit).lean(),
      Notification.countDocuments({ forAdmin: true }),
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

  /** Remove recipient from notification (user, manager, or staff). */
  async removeRecipient(notificationId, recipientType, recipientId) {
    const field = recipientType === 'manager' ? 'managerIds' : recipientType === 'staff' ? 'staffIds' : 'users';
    return Notification.findByIdAndUpdate(
      notificationId,
      { $pull: { [field]: recipientId } },
      { new: true }
    ).lean();
  },

  async list(filter = {}, options = {}) {
    const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      Notification.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
    ]);
    return { list, total, page, limit, totalPages: Math.ceil(total / limit) };
  },
};
