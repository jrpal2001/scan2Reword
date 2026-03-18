import mongoose from 'mongoose';
import Manager from '../models/Manager.model.js';

export const managerRepository = {
  async create(data) {
    return Manager.create(data);
  },

  async findById(id) {
    return Manager.findById(id).select('-passwordHash').lean();
  },

  async listByIds(ids) {
    if (!ids?.length) return [];
    return Manager.find({ _id: { $in: ids } }).select('fullName managerCode').lean();
  },

  async findByIdWithPassword(id) {
    return Manager.findById(id).select('+passwordEncrypted');
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

  /** Resolve identifier (email, phone, managerCode, or _id) for login. Returns full document (incl. passwordHash) for auth. */
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
    if (byEmail) return byEmail;
    const byManagerCode = await Manager.findOne({ managerCode: trimmed });
    return byManagerCode || null;
  },

  async update(id, data) {
    return Manager.findByIdAndUpdate(id, { $set: data }, { new: true }).select('-passwordHash').lean();
  },

  /**
   * Update manager fields and optionally set a new password (uses pre-save hook for hash/encrypt).
   * Note: uses doc.save() so hooks run.
   */
  async updateWithPassword(id, data, password = null) {
    const doc = await Manager.findById(id);
    if (!doc) return null;
    if (data && typeof data === 'object') {
      Object.assign(doc, data);
    }
    if (password != null && String(password).trim() !== '') {
      doc.password = String(password).trim();
    }
    await doc.save();
    return Manager.findById(id).select('-passwordHash').lean();
  },

  async list(filter = {}, options = {}) {
    const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
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
