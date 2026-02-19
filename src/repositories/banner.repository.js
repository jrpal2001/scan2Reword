import Banner from '../models/Banner.model.js';

/**
 * Banner repository - data access only.
 */
export const bannerRepository = {
  async create(data) {
    const banner = await Banner.create(data);
    return banner;
  },

  async findById(id) {
    return Banner.findById(id).lean();
  },

  async list(filter = {}, options = {}) {
    const { page = 1, limit = 20, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      Banner.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Banner.countDocuments(filter),
    ]);
    return { list, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async update(id, data) {
    const banner = await Banner.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
    return banner;
  },

  async delete(id) {
    await Banner.findByIdAndDelete(id);
    return true;
  },

  /**
   * Find active banners (startTime ≤ now and endTime > now)
   * @param {string} pumpId - Optional pump ID to filter
   * @returns {Array} Active banners
   */
  async findActiveBanners(pumpId = null) {
    const now = new Date();
    const filter = {
      startTime: { $lte: now },
      endTime: { $gt: now },
      status: 'active',
    };

    // Pump filter: empty pumpIds = global, or pumpId in pumpIds
    if (pumpId) {
      filter.$or = [
        { pumpIds: { $size: 0 } }, // Global banners
        { pumpIds: pumpId }, // Banners for this pump
      ];
    } else {
      // If no pumpId specified, return all active banners (global + pump-specific)
      // Filter will match banners with empty pumpIds or any pumpIds
    }

    return Banner.find(filter).sort({ createdAt: -1 }).lean();
  },
};
