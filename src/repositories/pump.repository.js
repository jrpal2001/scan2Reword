import Pump from '../models/Pump.model.js';
import StaffAssignment from '../models/StaffAssignment.model.js';

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

function uniqueIds(ids = []) {
  const out = [];
  const seen = new Set();
  for (const id of ids) {
    if (id == null || id === '') continue;
    const key = String(id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
  }
  return out;
}

function normalizeManagerIdsFromPumpDoc(pump = {}) {
  const fromArray = Array.isArray(pump.managerIds) ? pump.managerIds.filter(Boolean) : [];
  if (fromArray.length > 0) {
    return uniqueIds(fromArray.map((m) => m?._id ?? m));
  }
  if (pump.managerId) {
    return [pump.managerId?._id ?? pump.managerId];
  }
  return [];
}

function normalizeManagerAssignmentsInput(data = {}) {
  const out = { ...data };
  const hasManagerIds = hasOwn(out, 'managerIds');
  const hasManagerId = hasOwn(out, 'managerId');

  if (hasManagerIds) {
    if (out.managerIds == null || out.managerIds === '') {
      out.managerIds = [];
    } else if (!Array.isArray(out.managerIds)) {
      out.managerIds = [out.managerIds];
    }
    out.managerIds = uniqueIds(out.managerIds);
    out.managerId = out.managerIds[0] ?? null; // Legacy sync
    return out;
  }

  if (hasManagerId) {
    if (out.managerId == null || out.managerId === '') {
      out.managerIds = [];
      out.managerId = null;
    } else {
      out.managerIds = [out.managerId];
      out.managerId = out.managerId;
    }
    return out;
  }

  // Keep legacy field synced when callers only pass managerIds indirectly.
  if (Array.isArray(out.managerIds)) {
    out.managerIds = uniqueIds(out.managerIds);
    out.managerId = out.managerIds[0] ?? null;
  }
  return out;
}

function managerBrief(ref) {
  if (!ref || typeof ref !== 'object') return null;
  if (!('fullName' in ref) && !('_id' in ref)) return null;
  return {
    managerId: ref._id,
    name: ref.fullName ?? null,
    profilePhoto: ref.profilePhoto ?? null,
    managerCode: ref.managerCode ?? null,
  };
}

function withManagerFilter(filter = {}) {
  const query = { ...filter };
  const managerId = query.managerId;
  const managerIds = query.managerIds;
  delete query.managerId;
  delete query.managerIds;

  const wanted = uniqueIds([
    ...(managerId != null && managerId !== '' ? [managerId] : []),
    ...(Array.isArray(managerIds) ? managerIds : managerIds ? [managerIds] : []),
  ]);

  if (wanted.length === 0) return query;

  const condition = wanted.length === 1
    ? { $or: [{ managerIds: wanted[0] }, { managerId: wanted[0] }] }
    : { $or: [{ managerIds: { $in: wanted } }, { managerId: { $in: wanted } }] };

  if (Object.keys(query).length === 0) return condition;
  if (Array.isArray(query.$and)) {
    return { ...query, $and: [...query.$and, condition] };
  }
  return { $and: [query, condition] };
}

/**
 * Pump repository - data access only.
 */
export const pumpRepository = {
  /** Get distinct manager IDs that are assigned to at least one pump */
  async getAssignedManagerIds() {
    const [fromManagerIds, fromManagerId] = await Promise.all([
      Pump.distinct('managerIds', { managerIds: { $exists: true, $ne: [] } }),
      Pump.distinct('managerId', { managerId: { $ne: null } }),
    ]);
    return uniqueIds([...(fromManagerIds || []), ...(fromManagerId || [])]);
  },

  async findPumpIdsByManagerId(managerId) {
    const pumps = await Pump.find({
      status: 'active',
      $or: [{ managerIds: managerId }, { managerId }],
    }).select('_id').lean();
    return pumps.map((p) => p._id);
  },

  async findByManagerId(managerId) {
    return Pump.find({ $or: [{ managerIds: managerId }, { managerId }] })
      .select('name code status location managerId managerIds')
      .sort({ createdAt: -1 })
      .lean();
  },

  async findByManagerIds(managerIds) {
    if (!managerIds?.length) return [];
    return Pump.find({
      $or: [{ managerIds: { $in: managerIds } }, { managerId: { $in: managerIds } }],
    })
      .select('name code status location managerId managerIds')
      .sort({ createdAt: -1 })
      .lean();
  },

  async findPumpIdsByStaffId(staffId) {
    const assignments = await StaffAssignment.find({ staffId, status: 'active' })
      .select('pumpId')
      .lean();
    return assignments.map((a) => a.pumpId);
  },

  async findById(id) {
    const pump = await Pump.findById(id).lean();
    if (!pump) return null;
    const managerIds = normalizeManagerIdsFromPumpDoc(pump);
    return {
      ...pump,
      managerIds,
      managerId: managerIds[0] ?? null,
    };
  },

  async listByIds(ids) {
    if (!ids?.length) return [];
    return Pump.find({ _id: { $in: ids } }).select('name code').lean();
  },

  async create(data) {
    const pumpData = normalizeManagerAssignmentsInput(data);
    if (!hasOwn(pumpData, 'managerIds')) {
      pumpData.managerIds = [];
      pumpData.managerId = null;
    }
    const pump = await Pump.create(pumpData);
    return pump;
  },

  async update(id, data) {
    const updateData = normalizeManagerAssignmentsInput(data);
    if (hasOwn(updateData, 'managerIds') && updateData.managerIds == null) {
      delete updateData.managerIds;
    }
    if (hasOwn(updateData, 'managerId') && updateData.managerId === undefined) {
      delete updateData.managerId;
    }
    const pump = await Pump.findByIdAndUpdate(id, { $set: updateData }, { new: true }).lean();
    return pump;
  },

  async delete(id) {
    await Pump.findByIdAndDelete(id);
    return true;
  },

  async unsetManagerId(managerId) {
    const docs = await Pump.find({
      $or: [{ managerId }, { managerIds: managerId }],
    }).select('_id managerId managerIds').lean();
    if (!docs.length) return 0;

    const ops = docs.map((doc) => {
      const remaining = normalizeManagerIdsFromPumpDoc(doc)
        .filter((id) => String(id) !== String(managerId));
      return {
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { managerIds: remaining, managerId: remaining[0] ?? null } },
        },
      };
    });
    const result = await Pump.bulkWrite(ops);
    return result.modifiedCount || 0;
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

  /**
   * List all active pumps for public API (no auth). Returns id, name, code, location, status, pumpImages.
   * Used with optional lat/lng to compute distance.
   */
  async listActiveForPublic(limit = 500) {
    return Pump.find({ status: 'active' })
      .select('name code location status pumpImages')
      .limit(limit)
      .lean();
  },

  async list(filter = {}, options = {}) {
    const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const query = withManagerFilter(filter);
    const [list, total] = await Promise.all([
      Pump.find(query)
        .populate('managerIds', 'fullName profilePhoto managerCode')
        .populate('managerId', 'fullName profilePhoto managerCode')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Pump.countDocuments(query),
    ]);
    // Attach manager details:
    // - managers: array of all assigned managers
    // - manager: first manager (legacy compatibility)
    const listWithManager = list.map((pump) => {
      const managerRefs = [];
      if (Array.isArray(pump.managerIds) && pump.managerIds.length > 0) {
        managerRefs.push(...pump.managerIds);
      } else if (pump.managerId) {
        managerRefs.push(pump.managerId);
      }
      const seen = new Set();
      const uniqueRefs = managerRefs.filter((ref) => {
        const id = ref?._id ?? ref;
        if (!id) return false;
        const key = String(id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const managers = uniqueRefs.map(managerBrief).filter(Boolean);
      const managerIds = uniqueRefs.map((ref) => ref?._id ?? ref);
      return {
        ...pump,
        managerIds,
        managers,
        managerId: managerIds[0] ?? null,
      };
    });
    return { list: listWithManager, total, page, limit, totalPages: Math.ceil(total / limit) };
  },
};
