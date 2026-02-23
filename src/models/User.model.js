import mongoose from 'mongoose';
import { USER_STATUS } from '../constants/status.js';

/**
 * Customer / Driver / Fleet Owner only.
 * Managers and Staff use Manager.model.js and Staff.model.js.
 */
const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    mobile: { type: String, required: true, trim: true, match: /^[6-9]\d{9}$/ },
    email: { type: String, trim: true, lowercase: true, sparse: true },
    passwordHash: { type: String, default: null },
    walletSummary: {
      totalEarned: { type: Number, default: 0 },
      availablePoints: { type: Number, default: 0 },
      redeemedPoints: { type: Number, default: 0 },
      expiredPoints: { type: Number, default: 0 },
    },
    referralCode: { type: String, sparse: true },
    FcmTokens: [{ type: String }],
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserLoyalty', default: null },
    status: { type: String, enum: Object.values(USER_STATUS), default: USER_STATUS.ACTIVE },
    emailVerified: { type: Boolean, default: false },
    mobileVerified: { type: Boolean, default: false },
    address: {
      street: { type: String, default: null },
      city: { type: String, default: null },
      state: { type: String, default: null },
      pincode: { type: String, default: null },
    },
    profilePhoto: { type: String, default: null },
    driverPhoto: { type: String, default: null },
    ownerPhoto: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, refPath: 'createdByModel', default: null },
    createdByModel: { type: String, enum: ['Admin', 'Manager', 'Staff'], default: null },
  },
  { timestamps: true }
);

userSchema.index({ mobile: 1 }, { unique: true });
userSchema.index({ referralCode: 1 }, { unique: true, sparse: true });
userSchema.index({ ownerId: 1 });
userSchema.index({ status: 1 });

const User = mongoose.models.UserLoyalty || mongoose.model('UserLoyalty', userSchema);
export default User;
