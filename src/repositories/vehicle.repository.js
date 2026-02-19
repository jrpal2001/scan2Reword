import Vehicle from '../models/Vehicle.model.js';

/**
 * Vehicle repository - data access only. No business logic.
 */
export const vehicleRepository = {
  async create(data) {
    const vehicle = await Vehicle.create(data);
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
    const vehicle = await Vehicle.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
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
