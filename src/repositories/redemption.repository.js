import Redemption from '../models/Redemption.model.js';

/**
 * Redemption repository - data access only.
 */
export const redemptionRepository = {
  async create(data) {
    const redemption = await Redemption.create(data);
    return redemption;
  },

  async findById(id) {
    return Redemption.findById(id).lean();
  },

  async findByRedemptionCode(code) {
    return Redemption.findOne({ redemptionCode: code?.trim().toUpperCase() }).lean();
  },

  async list(filter = {}, options = {}) {
    const { page = 1, limit = 20, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      Redemption.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Redemption.countDocuments(filter),
    ]);
    return { list, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async update(id, data) {
    const redemption = await Redemption.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
    return redemption;
  },
};
