import mongoose from 'mongoose';

const staffAssignmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserLoyalty', required: true },
    pumpId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pump', required: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    assignedAt: { type: Date, default: Date.now },
    endDate: { type: Date, default: null },
  },
  { timestamps: true }
);

staffAssignmentSchema.index({ userId: 1 });
staffAssignmentSchema.index({ pumpId: 1 });
staffAssignmentSchema.index({ userId: 1, pumpId: 1 }, { unique: true });

const StaffAssignment = mongoose.models.StaffAssignment || mongoose.model('StaffAssignment', staffAssignmentSchema);
export default StaffAssignment;
