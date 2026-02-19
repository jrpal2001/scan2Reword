import mongoose from 'mongoose';
import { ROLES } from '../constants/roles.js';
import { USER_STATUS } from '../constants/status.js';

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    mobile: { type: String, required: true, trim: true, match: /^[6-9]\d{9}$/ },
    email: { type: String, trim: true, lowercase: true, sparse: true },
    passwordHash: { type: String, default: null },
    role: { type: String, required: true, enum: Object.values(ROLES), default: ROLES.USER },
    walletSummary: {
      totalEarned: { type: Number, default: 0 },
      availablePoints: { type: Number, default: 0 },
      redeemedPoints: { type: Number, default: 0 },
      expiredPoints: { type: Number, default: 0 },
    },
    referralCode: { type: String, sparse: true },
    FcmTokens: [{ type: String }],
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: Object.values(USER_STATUS), default: USER_STATUS.ACTIVE },
    emailVerified: { type: Boolean, default: false },
    mobileVerified: { type: Boolean, default: false },
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
    },
    profilePhoto: { type: String, default: null },
    driverPhoto: { type: String, default: null },
    ownerPhoto: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

userSchema.index({ mobile: 1 }, { unique: true });
userSchema.index({ referralCode: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1 });
userSchema.index({ ownerId: 1 });
userSchema.index({ status: 1 });

const User = mongoose.models.UserLoyalty || mongoose.model('UserLoyalty', userSchema);
export default User;
