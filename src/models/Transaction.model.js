import mongoose from 'mongoose';
import { TRANSACTION_STATUS } from '../constants/status.js';

/**
 * Transactions are never deleted when a User, Manager, or Staff is deleted.
 * They are retained for admin analytics and review tracking.
 */
const transactionSchema = new mongoose.Schema(
  {
    pumpId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pump', required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserLoyalty', required: true },
    operatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserLoyalty', required: true },
    amount: { type: Number, default: 0, min: 0 },
    liters: { type: Number, min: 0, default: null },
    category: {
      type: String,
      enum: ['Fuel', 'Lubricant', 'Store', 'Service'],
      default: 'Fuel',
    },
    /** Fuel type when category is Fuel: Petrol, Diesel, CNG. Null for non-Fuel. */
    fuelType: {
      type: String,
      enum: ['Petrol', 'Diesel', 'CNG'],
      default: null,
    },
    billNumber: { type: String, default: '', trim: true },
    paymentMode: {
      type: String,
      enum: ['Cash', 'Card', 'UPI', 'Wallet', 'Other'],
      default: 'Other',
    },
    pointsEarned: { type: Number, default: 0, min: 0 },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', default: null }, // First applied campaign (backward compat)
    campaignIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' }], // All campaigns applied (stacked)
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
transactionSchema.index({ fuelType: 1 });

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
export default Transaction;
