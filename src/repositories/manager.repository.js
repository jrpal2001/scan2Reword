import mongoose from 'mongoose';
import Manager from '../models/Manager.model.js';

export const managerRepository = {
  async create(data) {
    return Manager.create(data);
  },

  async findById(id) {
    return Manager.findById(id).select('-passwordHash').lean();
  },

  async findByIdWithPassword(id) {
    return Manager.findById(id);
  },

  async findByMobile(mobile) {
    return Manager.findOne({ mobile: mobile?.trim() }).lean();
  },

  async findByEmail(email) {
    return Manager.findOne({ email: email?.trim().toLowerCase() }).lean();
  },

  async findByManagerCode(code) {
    return Manager.findOne({ managerCode: code?.trim() }).lean();
  },

  async findByReferralCode(code) {
    return Manager.findOne({ referralCode: code?.trim() }).lean();
  },

  /** Resolve identifier (email, phone, or _id) for login */
  async findByIdentifier(identifier) {
    if (!identifier || typeof identifier !== 'string') return null;
    const trimmed = identifier.trim();
    if (mongoose.Types.ObjectId.isValid(trimmed) && String(new mongoose.Types.ObjectId(trimmed)) === trimmed) {
      const byId = await Manager.findById(trimmed);
      if (byId) return byId;
    }
    const byMobile = await Manager.findOne({ mobile: trimmed });
    if (byMobile) return byMobile;
    const byEmail = await Manager.findOne({ email: trimmed.toLowerCase() });
    return byEmail || null;
  },

  async update(id, data) {
    return Manager.findByIdAndUpdate(id, { $set: data }, { new: true }).select('-passwordHash').lean();
  },

  async list(filter = {}, options = {}) {
    const { page = 1, limit = 20, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      Manager.find(filter).sort(sort).skip(skip).limit(limit).select('-passwordHash').lean(),
      Manager.countDocuments(filter),
    ]);
    return { list, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async delete(id) {
    const doc = await Manager.findByIdAndDelete(id);
    return !!doc;
  },
};
