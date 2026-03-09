import StaffAssignment from '../models/StaffAssignment.model.js';

/**
 * Staff Assignment repository - data access only
 */
export const staffAssignmentRepository = {
  async create(data) {
    const assignment = await StaffAssignment.create(data);
    return assignment;
  },

  async findById(id) {
    return StaffAssignment.findById(id).lean();
  },

  async findByStaffId(staffId, options = {}) {
    const { status } = options;
    const filter = { staffId };
    if (status) filter.status = status;
    return StaffAssignment.find(filter)
      .populate('staffId', 'fullName mobile email staffCode profilePhoto')
      .populate('pumpId', 'name code')
      .lean();
  },

  async findByPumpId(pumpId, options = {}) {
    const { status } = options;
    const filter = { pumpId };
    if (status) filter.status = status;
    return StaffAssignment.find(filter)
      .populate('staffId', 'fullName mobile email staffCode profilePhoto')
      .lean();
  },

  async findByStaffAndPump(staffId, pumpId) {
    return StaffAssignment.findOne({ staffId, pumpId }).lean();
  },

  async findActiveAssignmentByStaff(staffId) {
    return StaffAssignment.findOne({ staffId, status: 'active' }).lean();
  },

  async update(id, data) {
    return StaffAssignment.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
  },

  async delete(id) {
    await StaffAssignment.findByIdAndDelete(id);
    return true;
  },

  async deleteByStaffId(staffId) {
    const result = await StaffAssignment.deleteMany({ staffId });
    return result.deletedCount;
  },

  /** Get distinct staff IDs that have at least one active assignment */
  async getAssignedStaffIds() {
    const docs = await StaffAssignment.distinct('staffId', { status: 'active' });
    return docs;
  },

  /** Get distinct staff IDs assigned to any of the given pump IDs (active assignments). */
  async getStaffIdsByPumpIds(pumpIds) {
    if (!pumpIds?.length) return [];
    return StaffAssignment.distinct('staffId', {
      pumpId: { $in: pumpIds },
      status: 'active',
    });
  },

  async list(filter = {}, options = {}) {
    const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      StaffAssignment.find(filter)
        .populate('staffId', 'fullName mobile email staffCode profilePhoto')
        .populate('pumpId', 'name code managerId')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      StaffAssignment.countDocuments(filter),
    ]);
    return { list, total, page, limit, totalPages: Math.ceil(total / limit) };
  },
};
