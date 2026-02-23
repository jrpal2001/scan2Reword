import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    userType: { type: String, enum: ['UserLoyalty', 'Manager', 'Staff', 'Admin'], default: 'UserLoyalty', index: true },
    token: { type: String, required: true, unique: true, index: true },
    fcmToken: { type: String, default: null }, // FCM token for this device
    deviceInfo: {
      deviceId: { type: String, default: null },
      deviceName: { type: String, default: null },
      platform: { type: String, default: null }, // 'ios', 'android', 'web'
      appVersion: { type: String, default: null },
    },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } }, // Auto-delete expired tokens
    revoked: { type: Boolean, default: false },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Compound index for faster lookups
refreshTokenSchema.index({ userId: 1, userType: 1, revoked: 1 });
refreshTokenSchema.index({ token: 1, revoked: 1 });

const RefreshToken = mongoose.models.RefreshToken || mongoose.model('RefreshToken', refreshTokenSchema);
export default RefreshToken;
