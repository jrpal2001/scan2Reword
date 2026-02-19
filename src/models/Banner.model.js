import mongoose from 'mongoose';
import { ROLES } from '../constants/roles.js';

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: null },
    imageUrl: { type: String, default: null },
    linkUrl: { type: String, trim: true, default: null },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    pumpIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Pump' }], // Empty array = global/show to all
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserLoyalty', required: true },
    createdByRole: {
      type: String,
      enum: [ROLES.ADMIN, ROLES.MANAGER],
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'expired'],
      default: 'active',
    },
  },
  { timestamps: true }
);

// Indexes
bannerSchema.index({ startTime: 1 });
bannerSchema.index({ endTime: 1 });
bannerSchema.index({ pumpIds: 1 });
bannerSchema.index({ status: 1 });
bannerSchema.index({ startTime: 1, endTime: 1 });

const Banner = mongoose.models.Banner || mongoose.model('Banner', bannerSchema);
export default Banner;
