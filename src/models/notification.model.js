import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    link: { type: String, trim: true, default: null },
    img: { type: String, default: null },
    notificationTime: { type: Date, default: Date.now },
    groupName: { type: String, trim: true, default: null },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'UserLoyalty' }], // Array of userIds
  },
  { timestamps: true }
);

// Indexes
notificationSchema.index({ users: 1 });
notificationSchema.index({ notificationTime: -1 });
notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
export default Notification;

