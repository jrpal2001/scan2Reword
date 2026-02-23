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
    const filter = { userId, ownerType: options.ownerType || 'UserLoyalty' };
    const { page = 1, limit = 20, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      PointsLedger.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      PointsLedger.countDocuments(filter),
    ]);
    return { list, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async findExpiringPoints(userId, beforeDate, ownerType = 'UserLoyalty') {
    return PointsLedger.find({
      userId,
      ownerType,
      type: 'credit',
      expiryDate: { $lte: beforeDate, $ne: null },
      points: { $gt: 0 },
    })
      .sort({ expiryDate: 1 }) // FIFO: oldest expiry first
      .lean();
  },

  async update(id, data) {
    return PointsLedger.findByIdAndUpdate(id, data, { new: true }).lean();
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
