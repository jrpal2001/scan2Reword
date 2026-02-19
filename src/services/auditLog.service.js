import { auditLogRepository } from '../repositories/auditLog.repository.js';

/**
 * Audit Log Service
 * Logs sensitive actions for audit trail
 */
export const auditLogService = {
  /**
   * Log an action
   * @param {Object} params
   * @param {string} params.userId - User who performed the action
   * @param {string} params.action - Action name (e.g., 'user.create', 'wallet.adjust')
   * @param {string} params.entityType - Entity type (e.g., 'User', 'Wallet')
   * @param {string} params.entityId - Entity ID (optional)
   * @param {Object} params.before - State before action (optional)
   * @param {Object} params.after - State after action (optional)
   * @param {Object} params.metadata - Additional metadata (optional)
   * @param {string} params.ipAddress - IP address (optional)
   * @param {string} params.userAgent - User agent (optional)
   */
  async log({
    userId,
    action,
    entityType,
    entityId = null,
    before = null,
    after = null,
    metadata = {},
    ipAddress = null,
    userAgent = null,
  }) {
    try {
      await auditLogRepository.create({
        userId,
        action,
        entityType,
        entityId,
        before,
        after,
        metadata,
        ipAddress,
        userAgent,
      });
    } catch (error) {
      // Don't fail the main operation if audit logging fails
      console.error('[AuditLog] Failed to log action:', error.message);
    }
  },

  /**
   * Get audit logs with filters
   */
  async getLogs(filter = {}, options = {}) {
    return auditLogRepository.list(filter, options);
  },

  /**
   * Get audit logs for a specific entity
   */
  async getEntityLogs(entityType, entityId) {
    return auditLogRepository.findByEntity(entityType, entityId);
  },

  /**
   * Get audit logs for a user
   */
  async getUserLogs(userId, options = {}) {
    return auditLogRepository.findByUserId(userId, options);
  },
};
