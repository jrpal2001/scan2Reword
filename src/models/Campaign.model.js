import mongoose from 'mongoose';
import { CAMPAIGN_STATUS } from '../constants/status.js';
import { ROLES } from '../constants/roles.js';

const campaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['multiplier', 'bonusPoints', 'bonusPercentage'],
      required: true,
    },
    multiplier: { type: Number, min: 0, default: null }, // For type 'multiplier'
    bonusPoints: { type: Number, min: 0, default: null }, // For type 'bonusPoints'
    bonusPercentage: { type: Number, min: 0, max: 100, default: null }, // For type 'bonusPercentage'
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    conditions: {
      minAmount: { type: Number, min: 0, default: null },
      categories: [{ type: String, enum: ['Fuel', 'Lubricant', 'Store', 'Service'] }],
      userSegment: { type: String, default: null }, // e.g., 'new', 'loyal', null = all
      frequencyLimit: { type: Number, default: null }, // Max times a user can use this campaign
    },
    pumpIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Pump' }], // Empty array = all pumps
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserLoyalty', required: true },
    createdByRole: {
      type: String,
      enum: [ROLES.ADMIN, ROLES.MANAGER],
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(CAMPAIGN_STATUS),
      default: CAMPAIGN_STATUS.DRAFT,
    },
  },
  { timestamps: true }
);

// Indexes
campaignSchema.index({ status: 1 });
campaignSchema.index({ startDate: 1 });
campaignSchema.index({ endDate: 1 });
campaignSchema.index({ pumpIds: 1 });
campaignSchema.index({ createdBy: 1 });
campaignSchema.index({ status: 1, startDate: 1, endDate: 1 });

const Campaign = mongoose.models.Campaign || mongoose.model('Campaign', campaignSchema);
export default Campaign;
