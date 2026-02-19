import mongoose from 'mongoose';

const pointsLedgerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserLoyalty', required: true },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
    redemptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Redemption', default: null },
    type: {
      type: String,
      enum: ['credit', 'debit', 'expiry', 'adjustment', 'refund'],
      required: true,
    },
    points: { type: Number, required: true }, // Signed: positive for credit, negative for debit
    balanceAfter: { type: Number, required: true }, // Balance after this transaction
    expiryDate: { type: Date, default: null }, // For credit entries (points expire after this date)
    reason: { type: String, trim: true, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserLoyalty', default: null },
  },
  { timestamps: true }
);

// Indexes
pointsLedgerSchema.index({ userId: 1 });
pointsLedgerSchema.index({ createdAt: -1 });
pointsLedgerSchema.index({ expiryDate: 1 });
pointsLedgerSchema.index({ userId: 1, createdAt: -1 });
pointsLedgerSchema.index({ transactionId: 1 });
pointsLedgerSchema.index({ redemptionId: 1 });

const PointsLedger = mongoose.models.PointsLedger || mongoose.model('PointsLedger', pointsLedgerSchema);
export default PointsLedger;
