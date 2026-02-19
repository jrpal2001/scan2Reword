import mongoose from 'mongoose';
import { VEHICLE_STATUS } from '../constants/status.js';

const vehicleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserLoyalty', required: true },
    vehicleNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
    loyaltyId: { type: String, required: true, unique: true, trim: true },
    vehicleType: {
      type: String,
      enum: ['Two-Wheeler', 'Three-Wheeler', 'Four-Wheeler', 'Commercial'],
      required: true,
    },
    fuelType: {
      type: String,
      enum: ['Petrol', 'Diesel', 'CNG', 'Electric'],
      required: true,
    },
    brand: { type: String, trim: true },
    model: { type: String, trim: true },
    yearOfManufacture: { type: Number },
    rcPhoto: { type: String, default: null },
    status: { type: String, enum: Object.values(VEHICLE_STATUS), default: VEHICLE_STATUS.ACTIVE },
  },
  { timestamps: true }
);

vehicleSchema.index({ userId: 1 });
vehicleSchema.index({ loyaltyId: 1 }, { unique: true });
vehicleSchema.index({ vehicleNumber: 1 }, { unique: true });

const Vehicle = mongoose.models.Vehicle || mongoose.model('Vehicle', vehicleSchema);
export default Vehicle;
