import mongoose from 'mongoose';
import { REDEMPTION_STATUS } from '../constants/status.js';

const redemptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserLoyalty', required: true },
    rewardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reward', default: null }, // Optional for at-pump redemptions
    pointsUsed: { type: Number, required: true, min: 1 },
    redemptionCode: { type: String, required: true, trim: true, uppercase: true },
    status: {
      type: String,
      enum: Object.values(REDEMPTION_STATUS),
      default: REDEMPTION_STATUS.PENDING,
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserLoyalty', default: null },
    /** Who created this redemption (Manager/Staff at pump). Used to notify creator when admin approves. */
    createdBy: { type: mongoose.Schema.Types.ObjectId, refPath: 'createdByModel', default: null },
    createdByModel: { type: String, enum: ['Manager', 'Staff'], default: null },
    usedAtPump: { type: mongoose.Schema.Types.ObjectId, ref: 'Pump', default: null },
    expiryDate: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    rejectedReason: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

// Indexes
redemptionSchema.index({ userId: 1 });
redemptionSchema.index({ status: 1 });
redemptionSchema.index({ redemptionCode: 1 }, { unique: true });
redemptionSchema.index({ expiryDate: 1 });
redemptionSchema.index({ userId: 1, status: 1 });

const Redemption = mongoose.models.Redemption || mongoose.model('Redemption', redemptionSchema);
export default Redemption;
