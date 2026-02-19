import PointsLedger from '../models/PointsLedger.model.js';

/**
 * PointsLedger repository - data access only.
 */
export const pointsLedgerRepository = {
  async create(data) {
    const entry = await PointsLedger.create(data);
    return entry;
  },

  async findById(id) {
    return PointsLedger.findById(id).lean();
  },

  async findByUserId(userId, options = {}) {
    const { page = 1, limit = 20, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      PointsLedger.find({ userId }).sort(sort).skip(skip).limit(limit).lean(),
      PointsLedger.countDocuments({ userId }),
    ]);
    return { list, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async findExpiringPoints(userId, beforeDate) {
    return PointsLedger.find({
      userId,
      type: 'credit',
      expiryDate: { $lte: beforeDate, $ne: null },
      points: { $gt: 0 }, // Only unexpired credits
    })
      .sort({ expiryDate: 1 }) // FIFO: oldest expiry first
      .lean();
  },

  async list(filter = {}, options = {}) {
    const { page = 1, limit = 20, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      PointsLedger.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      PointsLedger.countDocuments(filter),
    ]);
    return { list, total, page, limit, totalPages: Math.ceil(total / limit) };
  },
};
