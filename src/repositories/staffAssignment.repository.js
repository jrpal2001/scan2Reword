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
    const filter = { userId: staffId };
    if (status) filter.status = status;
    return StaffAssignment.find(filter).populate('pumpId', 'name code').lean();
  },

  async findByPumpId(pumpId, options = {}) {
    const { status } = options;
    const filter = { pumpId };
    if (status) filter.status = status;
    return StaffAssignment.find(filter).populate('userId', 'fullName mobile email role staffCode').lean();
  },

  async findByStaffAndPump(staffId, pumpId) {
    return StaffAssignment.findOne({ userId: staffId, pumpId }).lean();
  },

  async findActiveAssignmentByStaff(staffId) {
    return StaffAssignment.findOne({ userId: staffId, status: 'active' }).lean();
  },

  async update(id, data) {
    return StaffAssignment.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
  },

  async delete(id) {
    await StaffAssignment.findByIdAndDelete(id);
    return true;
  },

  async list(filter = {}, options = {}) {
    const { page = 1, limit = 20, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      StaffAssignment.find(filter)
        .populate('userId', 'fullName mobile email role staffCode')
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
