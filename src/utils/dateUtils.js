/**
 * Date/time utilities for IST (Indian Standard Time, UTC+5:30).
 * MongoDB stores dates in UTC; use these helpers to filter by IST time and to show dates in IST when reading.
 */

export const IST_OFFSET_MINUTES = 5 * 60 + 30; // 330 minutes
export const MINUTES_PER_DAY = 24 * 60; // 1440

/**
 * Convert a UTC Date (or ISO string) to IST and return as ISO-style string with +05:30.
 * @param {Date|string} date - UTC date or ISO string
 * @returns {string} e.g. "2026-02-27T16:07:00+05:30"
 */
export function toIST(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const str = d.toLocaleString('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  // en-CA can give "2026-02-27 16:07:00" or "2026-02-27, 16:07:00" depending on locale
  const iso = str.replace(/,\s*/, 'T').replace(/\s+/, 'T') + '+05:30';
  return iso;
}

/** Detect Mongoose ObjectId so we don't spread it (which would expose internal buffer). */
function isObjectId(obj) {
  return obj != null && typeof obj === 'object' && (obj.constructor?.name === 'ObjectId' || obj.constructor?.name === 'ObjectID');
}

/**
 * Add IST date fields to a document for API response.
 * Adds createdAtIST and updatedAtIST when those fields exist on the doc.
 * Converts ObjectId values to string so JSON serialization doesn't expose buffer.
 */
export function addISTToDocument(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  if (isObjectId(doc)) return doc.toString();
  const out = { ...doc };
  for (const key of Object.keys(out)) {
    if (isObjectId(out[key])) out[key] = out[key].toString();
  }
  if (doc.createdAt != null) {
    out.createdAtIST = toIST(doc.createdAt);
  }
  if (doc.updatedAt != null) {
    out.updatedAtIST = toIST(doc.updatedAt);
  }
  return out;
}

/**
 * Add IST to every item in a list and to the list itself if it has date fields.
 * Use for paginated list responses.
 */
export function addISTToList(list) {
  if (!Array.isArray(list)) return list;
  return list.map((item) => addISTToDocument(item));
}

/**
 * Recursively add IST to a payload: top-level and nested objects that have createdAt/updatedAt.
 * Converts ObjectId to string so response serializes as hex string, not { buffer: ... }.
 */
export function addISTToPayload(payload) {
  if (payload == null) return payload;
  if (Array.isArray(payload)) return payload.map((item) => addISTToPayload(item));
  if (typeof payload !== 'object') return payload;
  if (isObjectId(payload)) return payload.toString();
  if (payload instanceof Date) return payload;
  let out = addISTToDocument(payload);
  for (const key of Object.keys(out)) {
    if (key === 'createdAt' || key === 'updatedAt' || key === 'createdAtIST' || key === 'updatedAtIST') continue;
    const val = out[key];
    if (isObjectId(val)) out = { ...out, [key]: val.toString() };
    else if (Array.isArray(val)) out = { ...out, [key]: val.map((item) => addISTToPayload(item)) };
    else if (val && typeof val === 'object' && !(val instanceof Date)) out = { ...out, [key]: addISTToPayload(val) };
  }
  return out;
}

/**
 * Parse time string "HH:mm" or "HH:mm:ss" to minutes since midnight (0–1439).
 * Used when building filters; input is assumed to be in IST.
 * @param {string} timeStr - e.g. "20:20" or "23:30:00"
 * @returns {number} Minutes since midnight
 */
export function timeStringToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.trim().split(':').map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  return Math.min(1439, Math.max(0, h * 60 + m));
}

/**
 * Build createdAt filter from startDate, endDate, month, year, startTime, endTime.
 * startTime/endTime are interpreted as IST. Returns { createdAt: { $gte, $lte } } or
 * { $and: [ { createdAt }, { $expr: time-of-day in IST } ] } when startTime/endTime are used.
 * @param {Object} validated - Query params with optional startDate, endDate, month, year, startTime, endTime
 * @returns {Object|undefined} Filter for MongoDB query
 */
export function buildCreatedAtFilter(validated) {
  const { startDate, endDate, month, year, startTime, endTime } = validated || {};
  let rangeStart = null;
  let rangeEnd = null;

  if (startDate || endDate) {
    if (startDate) rangeStart = new Date(startDate);
    if (endDate) rangeEnd = new Date(endDate);
  } else if (year !== undefined && year !== null) {
    if (month !== undefined && month !== null) {
      rangeStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
      rangeEnd = new Date(year, month, 0, 23, 59, 59, 999);
    } else {
      rangeStart = new Date(year, 0, 1, 0, 0, 0, 0);
      rangeEnd = new Date(year, 11, 31, 23, 59, 59, 999);
    }
  }

  const hasTimeOfDay = startTime || endTime;
  if (!hasTimeOfDay) {
    if (rangeStart && startTime) {
      const [h, m, s = 0] = startTime.split(':').map(Number);
      rangeStart.setHours(h, m, s, 0);
    }
    if (rangeEnd && endTime) {
      const [h, m, s = 0] = endTime.split(':').map(Number);
      rangeEnd.setHours(h, m, s, 999);
    } else if (rangeEnd && !endTime) {
      rangeEnd.setHours(23, 59, 59, 999);
    }
  } else if (rangeEnd && !endTime) {
    rangeEnd.setHours(23, 59, 59, 999);
  }

  if (!rangeStart && !rangeEnd && !hasTimeOfDay) return undefined;

  const dateRange = {};
  if (rangeStart) dateRange.$gte = rangeStart;
  if (rangeEnd) dateRange.$lte = rangeEnd;
  const createdAtClause = Object.keys(dateRange).length ? { createdAt: dateRange } : null;

  if (hasTimeOfDay && (createdAtClause || rangeStart || rangeEnd)) {
    const startMinutes = timeStringToMinutes(startTime || '00:00');
    const endMinutes = timeStringToMinutes(endTime || '23:59');
    const utcToIstMinutesOfDay = {
      $mod: [
        {
          $add: [
            { $add: [{ $multiply: [{ $hour: '$createdAt' }, 60] }, { $minute: '$createdAt' }] },
            IST_OFFSET_MINUTES,
          ],
        },
        MINUTES_PER_DAY,
      ],
    };
    const timeOfDayExpr = {
      $and: [
        { $gte: [utcToIstMinutesOfDay, startMinutes] },
        { $lte: [utcToIstMinutesOfDay, endMinutes] },
      ],
    };
    const clauses = [];
    if (createdAtClause) clauses.push(createdAtClause);
    clauses.push({ $expr: timeOfDayExpr });
    return { $and: clauses };
  }

  return createdAtClause || undefined;
}

/** IST offset in milliseconds (UTC+5:30). */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/**
 * Get start and end of current month in IST, as UTC Date objects (for MongoDB createdAt filter).
 * @returns {{ start: Date, end: Date }}
 */
export function getCurrentMonthRangeIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth(); // 0–11
  // Start of month in IST: year, month, 1, 0, 0, 0 → convert to UTC
  const startIST = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const start = new Date(startIST.getTime() - IST_OFFSET_MS);
  // End of month in IST: last day 23:59:59.999
  const lastDay = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
  const end = new Date(lastDay.getTime() - IST_OFFSET_MS);
  return { start, end };
}
