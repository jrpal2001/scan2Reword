import mongoose from 'mongoose';
import Staff from '../models/Staff.model.js';

export const staffRepository = {
  async create(data) {
    return Staff.create(data);
  },

  async findById(id) {
    return Staff.findById(id).select('-passwordHash').lean();
  },

  async findByIdWithPassword(id) {
    return Staff.findById(id);
  },

  async findByMobile(mobile) {
    return Staff.findOne({ mobile: mobile?.trim() }).lean();
  },

  async findByEmail(email) {
    return Staff.findOne({ email: email?.trim().toLowerCase() }).lean();
  },

  async findByStaffCode(code) {
    return Staff.findOne({ staffCode: code?.trim() }).lean();
  },

  async findByReferralCode(code) {
    return Staff.findOne({ referralCode: code?.trim() }).lean();
  },

  async findByAssignedManagerId(managerId) {
    return Staff.find({ assignedManagerId: managerId }).select('-passwordHash').lean();
  },

  /** Resolve identifier (email, phone, or _id) for login */
  async findByIdentifier(identifier) {
    if (!identifier || typeof identifier !== 'string') return null;
    const trimmed = identifier.trim();
    if (mongoose.Types.ObjectId.isValid(trimmed) && String(new mongoose.Types.ObjectId(trimmed)) === trimmed) {
      const byId = await Staff.findById(trimmed);
      if (byId) return byId;
    }
    const byMobile = await Staff.findOne({ mobile: trimmed });
    if (byMobile) return byMobile;
    const byEmail = await Staff.findOne({ email: trimmed.toLowerCase() });
    return byEmail || null;
  },

  async update(id, data) {
    return Staff.findByIdAndUpdate(id, { $set: data }, { new: true }).select('-passwordHash').lean();
  },

  async list(filter = {}, options = {}) {
    const { page = 1, limit = 20, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      Staff.find(filter).sort(sort).skip(skip).limit(limit).select('-passwordHash').lean(),
      Staff.countDocuments(filter),
    ]);
    return { list, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async delete(id) {
    const doc = await Staff.findByIdAndDelete(id);
    return !!doc;
  },
};
