import Pump from '../models/Pump.model.js';
import StaffAssignment from '../models/StaffAssignment.model.js';

/**
 * Pump repository - data access only.
 */
export const pumpRepository = {
  async findPumpIdsByManagerId(managerId) {
    const pumps = await Pump.find({ managerId, status: 'active' }).select('_id').lean();
    return pumps.map((p) => p._id);
  },

  async findPumpIdsByStaffId(staffId) {
    const assignments = await StaffAssignment.find({ userId: staffId, status: 'active' })
      .select('pumpId')
      .lean();
    return assignments.map((a) => a.pumpId);
  },

  async findById(id) {
    return Pump.findById(id).lean();
  },

  async create(data) {
    const pump = await Pump.create(data);
    return pump;
  },

  async update(id, data) {
    const pump = await Pump.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
    return pump;
  },

  async delete(id) {
    await Pump.findByIdAndDelete(id);
    return true;
  },

  async findByCode(code) {
    return Pump.findOne({ code: code?.trim() }).lean();
  },

  async list(filter = {}, options = {}) {
    const { page = 1, limit = 20, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      Pump.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Pump.countDocuments(filter),
    ]);
    return { list, total, page, limit, totalPages: Math.ceil(total / limit) };
  },
};
