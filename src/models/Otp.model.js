import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema(
  {
    mobile: { type: String, required: true, index: true },
    otp: { type: String, required: true },
    purpose: { type: String, enum: ['login', 'register'], default: 'register' },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
  },
  { timestamps: true }
);

otpSchema.index({ mobile: 1, purpose: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Otp = mongoose.models.Otp || mongoose.model('Otp', otpSchema);
export default Otp;
