import Onboarding from '../models/Onboarding.model.js';

export const onboardingRepository = {
  async create(data) {
    return Onboarding.create(data);
  },

  async findById(id) {
    return Onboarding.findById(id).lean();
  },

  async list(filter = {}, options = {}) {
    const { page = 1, limit = 50, sort = { createdAt: 1 } } = options;
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      Onboarding.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Onboarding.countDocuments(filter),
    ]);
    return { list, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  /** Public: list all onboarding images sorted by createdAt. */
  async listActive(limit = 20) {
    return Onboarding.find({}).sort({ createdAt: 1 }).limit(limit).lean();
  },

  /** Create one document with onboardImage array (multiple URLs). */
  async createWithImages(urls) {
    if (!urls?.length) return null;
    const doc = await Onboarding.create({ onboardImage: urls });
    return doc.toObject ? doc.toObject() : doc;
  },

  async update(id, data) {
    return Onboarding.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
  },

  async delete(id) {
    const doc = await Onboarding.findByIdAndDelete(id);
    return !!doc;
  },
};
