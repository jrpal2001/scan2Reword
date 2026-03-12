import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    link: { type: String, trim: true, default: null },
    img: { type: String, default: null },
    notificationTime: { type: Date, default: Date.now },
    groupName: { type: String, trim: true, default: null },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'UserLoyalty' }],
    managerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Manager' }],
    staffIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Staff' }],
    /** When true, this notification is for admin only (e.g. new redemption request). */
    forAdmin: { type: Boolean, default: false },
    /** For redemption-related notifications: redeemer user name, loyalty ID, phone (in API response). */
    redeemerFullName: { type: String, default: null },
    redeemerLoyaltyId: { type: String, default: null },
    redeemerMobile: { type: String, default: null },
  },
  { timestamps: true }
);

// Indexes
notificationSchema.index({ users: 1 });
notificationSchema.index({ managerIds: 1 });
notificationSchema.index({ staffIds: 1 });
notificationSchema.index({ forAdmin: 1 });
notificationSchema.index({ notificationTime: -1 });
notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
export default Notification;

