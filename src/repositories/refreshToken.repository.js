import RefreshToken from '../models/RefreshToken.model.js';

/**
 * Refresh Token repository - data access only
 */
export const refreshTokenRepository = {
  async create(data) {
    const token = await RefreshToken.create(data);
    return token;
  },

  async findByToken(token) {
    return RefreshToken.findOne({ token, revoked: false }).lean();
  },

  async findByTokenIncludeRevoked(token) {
    return RefreshToken.findOne({ token }).lean();
  },

  async findByUserId(userId, options = {}) {
    const { revoked, fcmToken, userType } = options;
    const filter = { userId };
    if (userType) filter.userType = userType;
    if (revoked !== undefined) filter.revoked = revoked;
    if (fcmToken) filter.fcmToken = fcmToken;
    return RefreshToken.find(filter).sort({ createdAt: -1 }).lean();
  },

  async findByUserIdAndFcmToken(userId, fcmToken) {
    return RefreshToken.findOne({ userId, fcmToken, revoked: false }).lean();
  },

  async revokeToken(tokenId) {
    return RefreshToken.findByIdAndUpdate(
      tokenId,
      { revoked: true, revokedAt: new Date() },
      { new: true }
    ).lean();
  },

  async revokeByToken(token) {
    return RefreshToken.findOneAndUpdate(
      { token },
      { revoked: true, revokedAt: new Date() },
      { new: true }
    ).lean();
  },

  async revokeByFcmToken(userId, fcmToken, userType = null) {
    const filter = { userId, fcmToken };
    if (userType) filter.userType = userType;
    return RefreshToken.updateMany(filter, { revoked: true, revokedAt: new Date() });
  },

  async revokeAllUserTokens(userId, userType = null) {
    const filter = { userId, revoked: false };
    if (userType) filter.userType = userType;
    return RefreshToken.updateMany(filter, { revoked: true, revokedAt: new Date() });
  },

  async deleteExpired() {
    // MongoDB TTL index will handle this automatically, but we can also manually clean up
    return RefreshToken.deleteMany({ expiresAt: { $lt: new Date() } });
  },

  async deleteById(id) {
    await RefreshToken.findByIdAndDelete(id);
    return true;
  },
};
