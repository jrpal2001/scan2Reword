import Campaign from '../models/Campaign.model.js';

/**
 * Campaign repository - data access only.
 */
export const campaignRepository = {
  async create(data) {
    const campaign = await Campaign.create(data);
    return campaign.toObject ? campaign.toObject() : campaign;
  },

  async findById(id) {
    return Campaign.findById(id).lean();
  },

  async list(filter = {}, options = {}) {
    const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
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
   * @param {Object} criteria - { pumpId?, category?, amount?, liters?, fuelType?, userId? }
   * @returns {Array} Active campaigns
   */
  async findActiveCampaigns(criteria = {}) {
    const now = new Date();
    const { pumpId, category, amount, liters, fuelType, userId } = criteria;

    const filter = {
      status: 'active',
      startDate: { $lte: now },
      endDate: { $gte: now },
    };

    // Pump filter: empty pumpIds = all pumps, or pumpId in pumpIds
    if (pumpId) {
      filter.$or = [
        { pumpIds: null },
        { pumpIds: { $exists: false } },
        { pumpIds: { $size: 0 } }, // Global campaign
        { pumpIds: pumpId }, // Campaign for this pump
      ];
    }

    const campaigns = await Campaign.find(filter).lean();

    // Filter by conditions
    const filtered = campaigns.filter((campaign) => {
      const conditions = campaign.conditions || {};

      // Check min amount
      if (conditions.minAmount && amount != null && amount < conditions.minAmount) {
        return false;
      }

      // Check min liters (for Fuel): campaign applies only if user buys at least minliters
      if (conditions.minliters != null && conditions.minliters > 0) {
        if (liters == null || liters < conditions.minliters) {
          return false;
        }
      }

      // Check category
      if (conditions.categories && conditions.categories.length > 0 && category) {
        if (!conditions.categories.includes(category)) {
          return false;
        }
      }

      // Check fuel type (for Fuel campaigns): if campaign specifies fuelType, transaction fuelType must match
      if (conditions.fuelType) {
        if (!fuelType || conditions.fuelType !== fuelType) {
          return false;
        }
      }

      // TODO: Check userSegment and frequencyLimit if userId provided

      return true;
    });

    return filtered;
  },
};
