import IdempotencyKey from '../models/IdempotencyKey.model.js';

/**
 * IdempotencyKey repository - data access only
 */
export const idempotencyKeyRepository = {
  /**
   * Find idempotency key by key and userId
   */
  async findByKey(key, userId) {
    return IdempotencyKey.findOne({ key, userId }).lean();
  },

  /**
   * Create idempotency key record
   */
  async create(data) {
    const record = await IdempotencyKey.create(data);
    return record;
  },
};
