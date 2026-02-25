import mongoose from 'mongoose';
import { USER_STATUS } from '../constants/status.js';

const staffSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    mobile: { type: String, required: true, trim: true, match: /^[6-9]\d{9}$/, unique: true },
    email: { type: String, trim: true, lowercase: true, sparse: true },
    passwordHash: { type: String, required: false, default: null },
    staffCode: { type: String, trim: true, sparse: true, unique: true },
    referralCode: { type: String, sparse: true, unique: true },
    walletSummary: {
      totalEarned: { type: Number, default: 0 },
      availablePoints: { type: Number, default: 0 },
      redeemedPoints: { type: Number, default: 0 },
      expiredPoints: { type: Number, default: 0 },
    },
    assignedManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Manager', default: null },
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
    createdByModel: { type: String, enum: ['Admin', 'Manager'], default: null },
  },
  { timestamps: true }
);

staffSchema.index({ assignedManagerId: 1 });
staffSchema.index({ status: 1 });

const Staff = mongoose.models.Staff || mongoose.model('Staff', staffSchema);
export default Staff;
