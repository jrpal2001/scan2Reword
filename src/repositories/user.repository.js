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

  /** Find user (e.g. owner) by loyaltyId - used for fleet owner QR when vehicle QR not available */
  async findByLoyaltyId(loyaltyId) {
    return User.findOne({ loyaltyId: loyaltyId?.trim() }).lean();
  },

  /** Resolve identifier (email, phone, or _id) - for customer lookup / owner search (exact match) */
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

  /**
   * Search registered owners by partial match on mobile, fullName, or loyaltyId (for public owner search).
   * Only returns users who are owners (ownerId null). Paginated.
   * e.g. query "678" matches mobile 9876543678, 6789123456, etc.
   */
  async searchOwnersByQuery(queryString, options = {}) {
    const { page = 1, limit = 20, sort = { createdAt: -1 } } = options;
    if (!queryString || typeof queryString !== 'string' || !queryString.trim()) {
      return { list: [], total: 0, page, limit, totalPages: 0 };
    }
    const trimmed = queryString.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(trimmed, 'i');
    const filter = {
      ownerId: null,
      $or: [
        { mobile: regex },
        { fullName: regex },
        { loyaltyId: regex },
      ],
    };
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      User.find(filter).sort(sort).skip(skip).limit(limit).select('-passwordHash').lean(),
      User.countDocuments(filter),
    ]);
    return { list, total, page, limit, totalPages: Math.ceil(total / limit) };
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

  async delete(id) {
    const doc = await User.findByIdAndDelete(id);
    return !!doc;
  },
};
