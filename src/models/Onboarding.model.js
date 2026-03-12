import mongoose from 'mongoose';

/**
 * Onboarding: one document with multiple images. Admin uploads images; public GET returns list of docs (each with onboardImage[]).
 */
const onboardingSchema = new mongoose.Schema(
  {
    onboardImage: [{ type: String, required: true }],
  },
  { timestamps: true }
);

onboardingSchema.index({ createdAt: 1 });

const Onboarding = mongoose.models.Onboarding || mongoose.model('Onboarding', onboardingSchema);
export default Onboarding;
