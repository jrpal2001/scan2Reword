import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserLoyalty', required: true },
    action: { type: String, required: true }, // e.g., 'user.create', 'wallet.adjust', 'redemption.create', 'campaign.create'
    entityType: { type: String, required: true }, // e.g., 'User', 'Wallet', 'Redemption', 'Campaign'
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null }, // ID of the affected entity
    before: { type: mongoose.Schema.Types.Mixed, default: null }, // State before action
    after: { type: mongoose.Schema.Types.Mixed, default: null }, // State after action
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }, // Additional context
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: true }
);

// Indexes for efficient querying
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
