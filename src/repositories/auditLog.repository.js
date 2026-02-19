import AuditLog from '../models/AuditLog.model.js';

/**
 * AuditLog repository - data access only
 */
export const auditLogRepository = {
  /**
   * Create audit log entry
   */
  async create(data) {
    const log = await AuditLog.create(data);
    return log;
  },

  /**
   * List audit logs with filters and pagination
   */
  async list(filter = {}, options = {}) {
    const { page = 1, limit = 50, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      AuditLog.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);
    return { list, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  /**
   * Get audit logs for a specific entity
   */
  async findByEntity(entityType, entityId) {
    return AuditLog.find({ entityType, entityId }).sort({ createdAt: -1 }).lean();
  },

  /**
   * Get audit logs for a user
   */
  async findByUserId(userId, options = {}) {
    return this.list({ userId }, options);
  },
};
