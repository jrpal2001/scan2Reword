import Campaign from '../models/Campaign.model.js';

/**
 * Campaign repository - data access only.
 */
export const campaignRepository = {
  async create(data) {
    const campaign = await Campaign.create(data);
    return campaign;
  },

  async findById(id) {
    return Campaign.findById(id).lean();
  },

  async list(filter = {}, options = {}) {
    const { page = 1, limit = 20, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      Campaign.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Campaign.countDocuments(filter),
    ]);
    return { list, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async update(id, data) {
    const campaign = await Campaign.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
    return campaign;
  },

  async delete(id) {
    await Campaign.findByIdAndDelete(id);
    return true;
  },

  /**
   * Find active campaigns matching criteria
   * @param {Object} criteria - { pumpId?, category?, amount?, userId? }
   * @returns {Array} Active campaigns
   */
  async findActiveCampaigns(criteria = {}) {
    const now = new Date();
    const { pumpId, category, amount, userId } = criteria;

    const filter = {
      status: 'active',
      startDate: { $lte: now },
      endDate: { $gte: now },
    };

    // Pump filter: empty pumpIds = all pumps, or pumpId in pumpIds
    if (pumpId) {
      filter.$or = [
        { pumpIds: { $size: 0 } }, // Global campaign
        { pumpIds: pumpId }, // Campaign for this pump
      ];
    }

    const campaigns = await Campaign.find(filter).lean();

    // Filter by conditions
    return campaigns.filter((campaign) => {
      const { conditions } = campaign;

      // Check min amount
      if (conditions.minAmount && amount && amount < conditions.minAmount) {
        return false;
      }

      // Check category
      if (conditions.categories && conditions.categories.length > 0 && category) {
        if (!conditions.categories.includes(category)) {
          return false;
        }
      }

      // TODO: Check userSegment and frequencyLimit if userId provided

      return true;
    });
  },
};
