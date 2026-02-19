import Reward from '../models/Reward.model.js';

/**
 * Reward repository - data access only.
 */
export const rewardRepository = {
  async create(data) {
    const reward = await Reward.create(data);
    return reward;
  },

  async findById(id) {
    return Reward.findById(id).lean();
  },

  async list(filter = {}, options = {}) {
    const { page = 1, limit = 20, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      Reward.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Reward.countDocuments(filter),
    ]);
    return { list, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async update(id, data) {
    const reward = await Reward.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
    return reward;
  },

  async delete(id) {
    await Reward.findByIdAndDelete(id);
    return true;
  },

  /**
   * Find available rewards (active, within validity, available quantity)
   */
  async findAvailableRewards(pumpId = null) {
    const now = new Date();
    const filter = {
      status: 'active',
      validFrom: { $lte: now },
      validUntil: { $gte: now },
    };

    // Pump filter: empty applicablePumps = all pumps, or pumpId in applicablePumps
    if (pumpId) {
      filter.$or = [
        { applicablePumps: { $size: 0 } }, // Global rewards
        { applicablePumps: pumpId }, // Rewards for this pump
      ];
    }

    const rewards = await Reward.find(filter).lean();

    // Filter by availability
    return rewards.filter((reward) => {
      if (reward.availability === 'unlimited') {
        return true;
      }
      // Limited: check if redeemedQuantity < totalQuantity
      return reward.redeemedQuantity < reward.totalQuantity;
    });
  },
};
