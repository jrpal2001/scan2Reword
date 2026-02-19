import mongoose from 'mongoose';
import User from '../models/User.model.js';

/**
 * User repository - data access only. No business logic.
 */
export const userRepository = {
  async create(data) {
    const user = await User.create(data);
    return user;
  },

  async findById(id) {
    return User.findById(id).select('-passwordHash').lean();
  },

  async findByMobile(mobile) {
    return User.findOne({ mobile: mobile?.trim() }).lean();
  },

  async findByMobileWithPassword(mobile) {
    return User.findOne({ mobile: mobile?.trim() });
  },

  async findByEmail(email) {
    return User.findOne({ email: email?.trim().toLowerCase() }).lean();
  },

  async findByReferralCode(code) {
    return User.findOne({ referralCode: code?.trim() }).lean();
  },

  /** Resolve identifier (email, phone, or _id) to user - for admin/manager/staff login */
  async findByIdentifier(identifier) {
    if (!identifier || typeof identifier !== 'string') return null;
    const trimmed = identifier.trim();
    const byId =
      mongoose.Types.ObjectId.isValid(trimmed) && String(new mongoose.Types.ObjectId(trimmed)) === trimmed
        ? await User.findById(trimmed)
        : null;
    if (byId) return byId;
    const byMobile = await User.findOne({ mobile: trimmed });
    if (byMobile) return byMobile;
    const byEmail = await User.findOne({ email: trimmed.toLowerCase() });
    if (byEmail) return byEmail;
    return User.findOne({ referralCode: trimmed }) || null;
  },

  async update(id, data) {
    const user = await User.findByIdAndUpdate(id, { $set: data }, { new: true }).select('-passwordHash').lean();
    return user;
  },

  async list(filter = {}, options = {}) {
    const { page = 1, limit = 20, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      User.find(filter).sort(sort).skip(skip).limit(limit).select('-passwordHash').lean(),
      User.countDocuments(filter),
    ]);
    return { list, total, page, limit, totalPages: Math.ceil(total / limit) };
  },
};
