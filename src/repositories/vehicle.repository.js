import Vehicle from '../models/Vehicle.model.js';

const VEHICLE_TYPES = ['Two-Wheeler', 'Three-Wheeler', 'Four-Wheeler', 'Commercial'];
const FUEL_TYPES = ['Petrol', 'Diesel', 'CNG', 'Electric'];

/** Omit vehicleType/fuelType if empty or invalid so Mongoose optional enum does not reject. */
function sanitizeVehicleForCreate(data) {
  const out = { ...data };
  if (out.vehicleType == null || out.vehicleType === '' || !VEHICLE_TYPES.includes(out.vehicleType)) {
    delete out.vehicleType;
  }
  if (out.fuelType == null || out.fuelType === '' || !FUEL_TYPES.includes(out.fuelType)) {
    delete out.fuelType;
  }
  return out;
}

/**
 * Vehicle repository - data access only. No business logic.
 */
export const vehicleRepository = {
  async create(data) {
    const sanitized = sanitizeVehicleForCreate(data);
    const vehicle = await Vehicle.create(sanitized);
    return vehicle;
  },

  async findById(id) {
    return Vehicle.findById(id).lean();
  },

  async findByUserId(userId) {
    return Vehicle.find({ userId }).lean();
  },

  async findByLoyaltyId(loyaltyId) {
    return Vehicle.findOne({ loyaltyId: loyaltyId?.trim() }).lean();
  },

  async findByVehicleNumber(vehicleNumber) {
    return Vehicle.findOne({ vehicleNumber: vehicleNumber?.trim().toUpperCase() }).lean();
  },

  async update(id, data) {
    const sanitized = sanitizeVehicleForCreate(data);
    const vehicle = await Vehicle.findByIdAndUpdate(id, { $set: sanitized }, { new: true }).lean();
    return vehicle;
  },

  async list(filter = {}, options = {}) {
    const { page = 1, limit = 20, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      Vehicle.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Vehicle.countDocuments(filter),
    ]);
    return { list, total, page, limit, totalPages: Math.ceil(total / limit) };
  },
};
