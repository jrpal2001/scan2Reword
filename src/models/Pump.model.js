import mongoose from 'mongoose';
import { PUMP_STATUS } from '../constants/status.js';

const pumpSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Manager', default: null },
    location: {
      address: String,
      city: String,
      state: String,
      pincode: String,
      lat: Number,
      lng: Number,
    },
    status: { type: String, enum: Object.values(PUMP_STATUS), default: PUMP_STATUS.ACTIVE },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    timezone: { type: String, default: 'Asia/Kolkata' },
    currency: { type: String, default: 'INR' },
    pumpImages: [{ type: String, default: '' }],
  },
  { timestamps: true }
);

pumpSchema.index({ managerId: 1 });
pumpSchema.index({ status: 1 });

const Pump = mongoose.models.Pump || mongoose.model('Pump', pumpSchema);
export default Pump;
