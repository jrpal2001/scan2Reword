import { pumpRepository } from '../repositories/pump.repository.js';
import { managerRepository } from '../repositories/manager.repository.js';
import ApiError from '../utils/ApiError.js';
import { haversineDistanceKm } from '../utils/geoUtils.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import { PUMP_STATUS } from '../constants/status.js';

/** Prefix for auto-generated pump codes (e.g. PUMP00001) */
const PUMP_CODE_PREFIX = 'PUMP';
/** Number of digits for the numeric part (4–6 digit padded) */
const PUMP_CODE_DIGITS = 5;

/**
 * Generate next pump code: PREFIX + padded number (e.g. PUMP00001, PUMP00002).
 * Uses the highest existing code number with this prefix and increments.
 */
async function generateNextPumpCode() {
  const pumps = await pumpRepository.findCodesByPrefix(PUMP_CODE_PREFIX);
  let maxNum = 0;
  for (const p of pumps) {
    const numPart = p.code.slice(PUMP_CODE_PREFIX.length);
    const n = parseInt(numPart, 10);
    if (!Number.isNaN(n) && n > maxNum) maxNum = n;
  }
  const nextNum = maxNum + 1;
  const maxAllowed = Math.pow(10, PUMP_CODE_DIGITS) - 1;
  if (nextNum > maxAllowed) {
    throw new Error(`Pump code range exhausted (max ${maxAllowed} for ${PUMP_CODE_DIGITS} digits)`);
  }
  return PUMP_CODE_PREFIX + String(nextNum).padStart(PUMP_CODE_DIGITS, '0');
}

export const pumpService = {
  async createPump(data, adminId) {
    // Auto-generate code on create (ignore client-sent code)
    const code = await generateNextPumpCode();
    const existing = await pumpRepository.findByCode(code);
    if (existing) {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'Pump code already exists');
    }

    // Convert empty string managerId to null
    if (data.managerId === '' || data.managerId === undefined) {
      data.managerId = null;
    }

    // Validate managerId if provided (Manager model, not User). A manager can be assigned to multiple pumps.
    if (data.managerId) {
      const manager = await managerRepository.findById(data.managerId);
      if (!manager) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Manager not found');
      }
    }

    const pump = await pumpRepository.create({
      ...data,
      code,
      managerId: data.managerId || null, // Ensure null if empty
      status: data.status || PUMP_STATUS.ACTIVE,
    });
    return pump;
  },

  async updatePump(pumpId, data, adminId) {
    const existing = await pumpRepository.findById(pumpId);
    if (!existing) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Pump not found');
    }

    // Check code uniqueness if code is being updated
    if (data.code && data.code !== existing.code) {
      const codeExists = await pumpRepository.findByCode(data.code);
      if (codeExists) {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'Pump code already exists');
      }
    }

    // Convert empty string managerId to null
    if (data.managerId === '' || data.managerId === undefined) {
      data.managerId = null;
    }

    // Validate managerId if provided (Manager model, not User). A manager can be assigned to multiple pumps.
    if (data.managerId !== undefined && data.managerId !== null) {
      const manager = await managerRepository.findById(data.managerId);
      if (!manager) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Manager not found');
      }
    }

    // Ensure managerId is explicitly set to null if empty
    const updateData = {
      ...data,
      managerId: data.managerId !== undefined ? (data.managerId || null) : undefined,
    };

    const pump = await pumpRepository.update(pumpId, updateData);
    return pump;
  },

  async deletePump(pumpId) {
    const existing = await pumpRepository.findById(pumpId);
    if (!existing) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Pump not found');
    }
    await pumpRepository.delete(pumpId);
    return { success: true };
  },

  async getPumpById(pumpId) {
    const pump = await pumpRepository.findById(pumpId);
    if (!pump) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Pump not found');
    }
    return pump;
  },

  async listPumps(filter = {}, options = {}) {
    return pumpRepository.list(filter, options);
  },

  /**
   * Public pump list: all active pumps. When lat/lng provided, adds distanceKm and sorts by distance.
   * @param {number|null} lat - Optional user latitude
   * @param {number|null} lng - Optional user longitude
   */
  async getPublicPumpList(lat, lng, search = '') {
    const pumps = await pumpRepository.listActiveForPublic();
    const term = typeof search === 'string' ? search.trim() : '';
    const regex = term ? new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
    const hasCoords =
      typeof lat === 'number' &&
      !Number.isNaN(lat) &&
      typeof lng === 'number' &&
      !Number.isNaN(lng);
    let list = pumps.map((p) => {
      const pump = { _id: p._id, name: p.name, code: p.code, location: p.location, status: p.status, pumpImages: p.pumpImages ?? [] };
      if (hasCoords && p.location?.lat != null && p.location?.lng != null) {
        pump.distanceKm = Math.round(haversineDistanceKm(lat, lng, p.location.lat, p.location.lng) * 100) / 100;
      }
      return pump;
    });
    if (regex) {
      list = list.filter((p) => {
        const addr = p.location?.address || '';
        const city = p.location?.city || '';
        const state = p.location?.state || '';
        return regex.test(p.name || '') || regex.test(p.code || '') || regex.test(addr) || regex.test(city) || regex.test(state);
      });
    }
    if (hasCoords) {
      list.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    }
    return { list };
  },
};
