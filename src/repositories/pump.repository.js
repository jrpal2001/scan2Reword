import Pump from '../models/Pump.model.js';
import StaffAssignment from '../models/StaffAssignment.model.js';

/**
 * Pump repository - data access only.
 */
export const pumpRepository = {
  /** Get distinct manager IDs that are assigned to at least one pump */
  async getAssignedManagerIds() {
    const docs = await Pump.distinct('managerId', { managerId: { $ne: null } });
    return docs;
  },

  async findPumpIdsByManagerId(managerId) {
    const pumps = await Pump.find({ managerId, status: 'active' }).select('_id').lean();
    return pumps.map((p) => p._id);
  },

  async findPumpIdsByStaffId(staffId) {
    const assignments = await StaffAssignment.find({ staffId, status: 'active' })
      .select('pumpId')
      .lean();
    return assignments.map((a) => a.pumpId);
  },

  async findById(id) {
    return Pump.findById(id).lean();
  },

  async listByIds(ids) {
    if (!ids?.length) return [];
    return Pump.find({ _id: { $in: ids } }).select('name code').lean();
  },

  async create(data) {
    // Ensure managerId is null if empty string
    const pumpData = {
      ...data,
      managerId: data.managerId === '' || data.managerId === undefined ? null : data.managerId,
    };
    const pump = await Pump.create(pumpData);
    return pump;
  },

  async update(id, data) {
    // Ensure managerId is null if empty string
    const updateData = {
      ...data,
      managerId: data.managerId === '' || data.managerId === undefined ? null : data.managerId,
    };
    const pump = await Pump.findByIdAndUpdate(id, { $set: updateData }, { new: true }).lean();
    return pump;
  },

  async delete(id) {
    await Pump.findByIdAndDelete(id);
    return true;
  },

  async unsetManagerId(managerId) {
    const result = await Pump.updateMany({ managerId }, { $set: { managerId: null } });
    return result.modifiedCount;
  },

  async findByCode(code) {
    return Pump.findOne({ code: code?.trim() }).lean();
  },

  /**
   * Find all pumps whose code matches prefix + digits (e.g. PUMP00001).
   * Used to compute the next auto-generated code number.
   * @param {string} prefix - e.g. 'PUMP'
   * @returns {{ code: string }[]}
   */
  async findCodesByPrefix(prefix) {
    const safePrefix = String(prefix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pumps = await Pump.find({ code: new RegExp(`^${safePrefix}\\d+$`) })
      .select('code')
      .lean();
    return pumps;
  },

  async list(filter = {}, options = {}) {
    const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      Pump.find(filter)
        .populate('managerId', 'fullName profilePhoto managerCode')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Pump.countDocuments(filter),
    ]);
    // Attach manager details: { managerId, name, profilePhoto, managerCode }; keep managerId as id on pump
    const listWithManager = list.map((pump) => {
      const managerId = pump.managerId?._id ?? pump.managerId;
      const manager = pump.managerId
        ? {
            managerId: pump.managerId._id,
            name: pump.managerId.fullName,
            profilePhoto: pump.managerId.profilePhoto ?? null,
            managerCode: pump.managerId.managerCode ?? null,
          }
        : null;
      return { ...pump, managerId, manager };
    });
    return { list: listWithManager, total, page, limit, totalPages: Math.ceil(total / limit) };
  },
};
