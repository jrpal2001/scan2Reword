import mongoose from 'mongoose';
import { TRANSACTION_STATUS } from '../constants/status.js';

const transactionSchema = new mongoose.Schema(
  {
    pumpId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pump', required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserLoyalty', required: true },
    operatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserLoyalty', required: true },
    amount: { type: Number, required: true, min: 0 },
    liters: { type: Number, min: 0, default: null },
    category: {
      type: String,
      enum: ['Fuel', 'Lubricant', 'Store', 'Service'],
      required: true,
    },
    billNumber: { type: String, required: true, trim: true },
    paymentMode: {
      type: String,
      enum: ['Cash', 'Card', 'UPI', 'Wallet', 'Other'],
      required: true,
    },
    pointsEarned: { type: Number, default: 0, min: 0 },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', default: null },
    status: {
      type: String,
      enum: Object.values(TRANSACTION_STATUS),
      default: TRANSACTION_STATUS.COMPLETED,
    },
    attachments: [{ type: String }], // Array of file URLs
  },
  { timestamps: true }
);

// Indexes
transactionSchema.index({ pumpId: 1 });
transactionSchema.index({ vehicleId: 1 });
transactionSchema.index({ userId: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ pumpId: 1, billNumber: 1 }, { unique: true });

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
export default Transaction;
