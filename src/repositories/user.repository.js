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
    const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
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
    const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      User.find(filter).sort(sort).skip(skip).limit(limit).select('-passwordHash').lean(),
      User.countDocuments(filter),
    ]);
    return { list, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  /** Get all active customer (UserLoyalty) IDs - e.g. for campaign "all pumps" notification. */
  async getActiveCustomerIds() {
    return User.distinct('_id', { status: 'active' });
  },

  /** Get active customer profile fields needed for WhatsApp campaign sends. */
  async getActiveCustomerWhatsappTargetsByIds(userIds = []) {
    if (!Array.isArray(userIds) || userIds.length === 0) return [];
    return User.find({ _id: { $in: userIds }, status: 'active' })
      .select('_id fullName mobile status')
      .lean();
  },

  /**
   * Get fleet member IDs for a fleet owner: owner + all drivers (users with ownerId = ownerId).
   * @param {string|import('mongoose').Types.ObjectId} ownerId
   * @returns {Promise<string[]>} Array of user IDs (owner + drivers)
   */
  async getFleetUserIds(ownerId) {
    const id = typeof ownerId === 'string' ? new mongoose.Types.ObjectId(ownerId) : ownerId;
    const driverIds = await User.find({ ownerId: id, status: 'active' }).select('_id').lean();
    const ids = [id.toString(), ...driverIds.map((d) => d._id.toString())];
    return ids;
  },

  async delete(id) {
    const doc = await User.findByIdAndDelete(id);
    return !!doc;
  },

  /** Count users referred/registered by a given manager or staff. */
  async countReferredBy(referrerId) {
    return User.countDocuments({ createdBy: referrerId, createdByModel: { $in: ['Manager', 'Staff'] } });
  },
};
