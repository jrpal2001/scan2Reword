import mongoose from 'mongoose';

const rewardSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['discount', 'freeItem', 'cashback', 'voucher'],
      required: true,
    },
    pointsRequired: { type: Number, required: true, min: 1 },
    value: { type: Number, required: true, min: 0 }, // Discount amount, cashback amount, etc.
    discountType: {
      type: String,
      enum: ['percentage', 'fixed', 'free'],
      default: 'fixed',
    },
    availability: {
      type: String,
      enum: ['unlimited', 'limited'],
      default: 'unlimited',
    },
    totalQuantity: { type: Number, default: null }, // For limited availability
    redeemedQuantity: { type: Number, default: 0 }, // Track redemptions
    validFrom: { type: Date, required: true },
    validUntil: { type: Date, required: true },
    applicablePumps: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Pump' }], // Empty array = all pumps
    status: {
      type: String,
      enum: ['active', 'inactive', 'expired'],
      default: 'active',
    },
    description: { type: String, trim: true, default: null },
    imageUrl: { type: String, default: null },
  },
  { timestamps: true }
);

// Indexes
rewardSchema.index({ status: 1 });
rewardSchema.index({ validFrom: 1 });
rewardSchema.index({ validUntil: 1 });
rewardSchema.index({ applicablePumps: 1 });
rewardSchema.index({ pointsRequired: 1 });

const Reward = mongoose.models.Reward || mongoose.model('Reward', rewardSchema);
export default Reward;
