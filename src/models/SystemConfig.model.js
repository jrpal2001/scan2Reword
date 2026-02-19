import mongoose from 'mongoose';

const systemConfigSchema = new mongoose.Schema(
  {
    // Points configuration
    points: {
      registration: { type: Number, default: 0, min: 0 },
      referral: { type: Number, default: 0, min: 0 },
      fuel: {
        pointsPerLiter: { type: Number, default: 1, min: 0 },
      },
      lubricant: {
        pointsPer100Rupees: { type: Number, default: 5, min: 0 },
      },
      store: {
        pointsPer100Rupees: { type: Number, default: 5, min: 0 },
      },
      service: {
        pointsPer100Rupees: { type: Number, default: 5, min: 0 },
      },
    },
    // Points expiry configuration
    pointsExpiry: {
      durationMonths: { type: Number, default: 12, min: 1 },
      notificationDays: [{ type: Number }], // e.g., [30, 7, 1] for 30 days, 7 days, 1 day before expiry
    },
  },
  { timestamps: true }
);

// Ensure only one document exists (singleton pattern)
systemConfigSchema.statics.getConfig = async function () {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({});
  }
  return config;
};

const SystemConfig = mongoose.models.SystemConfig || mongoose.model('SystemConfig', systemConfigSchema);
export default SystemConfig;
