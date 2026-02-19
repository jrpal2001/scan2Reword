import mongoose from 'mongoose';

const idempotencyKeySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserLoyalty', required: true },
    method: { type: String, required: true }, // POST, PUT, PATCH
    path: { type: String, required: true }, // e.g., '/api/transactions', '/api/redeem'
    statusCode: { type: Number, required: true }, // HTTP status code of the response
    responseBody: { type: mongoose.Schema.Types.Mixed, required: true }, // Store the response
    expiresAt: { type: Date, required: true }, // Auto-delete after expiry
  },
  { timestamps: true }
);

// Index for faster lookups
idempotencyKeySchema.index({ key: 1, userId: 1 });
idempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const IdempotencyKey = mongoose.models.IdempotencyKey || mongoose.model('IdempotencyKey', idempotencyKeySchema);
export default IdempotencyKey;
