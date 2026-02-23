import mongoose from 'mongoose';
import { USER_STATUS } from '../constants/status.js';

const managerSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    mobile: { type: String, required: true, trim: true, match: /^[6-9]\d{9}$/, unique: true },
    email: { type: String, trim: true, lowercase: true, sparse: true },
    passwordHash: { type: String, required: true },
    managerCode: { type: String, trim: true, sparse: true, unique: true },
    referralCode: { type: String, sparse: true },
    walletSummary: {
      totalEarned: { type: Number, default: 0 },
      availablePoints: { type: Number, default: 0 },
      redeemedPoints: { type: Number, default: 0 },
      expiredPoints: { type: Number, default: 0 },
    },
    address: {
      street: { type: String, default: null },
      city: { type: String, default: null },
      state: { type: String, default: null },
      pincode: { type: String, default: null },
    },
    profilePhoto: { type: String, default: null },
    FcmTokens: [{ type: String }],
    status: { type: String, enum: Object.values(USER_STATUS), default: USER_STATUS.ACTIVE },
    createdBy: { type: mongoose.Schema.Types.ObjectId, refPath: 'createdByModel', default: null },
    createdByModel: { type: String, enum: ['Admin', 'UserLoyalty'], default: null },
  },
  { timestamps: true }
);

managerSchema.index({ mobile: 1 }, { unique: true });
managerSchema.index({ managerCode: 1 }, { unique: true, sparse: true });
managerSchema.index({ referralCode: 1 }, { unique: true, sparse: true });
managerSchema.index({ status: 1 });

const Manager = mongoose.models.Manager || mongoose.model('Manager', managerSchema);
export default Manager;
