import mongoose from 'mongoose';
import { buildCreatedAtFilter, getCurrentMonthRangeIST } from '../utils/dateUtils.js';
import {
  getTransactionAggregates,
  getRedemptionAggregates,
  getStaffManagerRegisteredUserIds,
  getRegistrationGraph,
  getReferralEarnedStats,
} from '../repositories/stats.repository.js';
import { transactionService } from './transaction.service.js';
import { userRepository } from '../repositories/user.repository.js';

/** Ensure value is an ObjectId for use in aggregate $match (MongoDB does not cast strings to ObjectId in aggregation). */
function toObjectId(value) {
  if (value == null) return value;
  if (mongoose.Types.ObjectId.isValid(value)) return new mongoose.Types.ObjectId(value);
  return value;
}

/**
 * If validated has no date range (startDate, endDate, month, year), apply current month IST.
 * @param {Object} validated - Query params (may be mutated)
 * @returns {Object} validated with date range (current month if none)
 */
function applyDefaultCurrentMonth(validated) {
  const hasDate =
    validated?.startDate != null ||
    validated?.endDate != null ||
    (validated?.month != null && validated?.year != null) ||
    validated?.year != null;
  if (hasDate) return validated;
  const { start, end } = getCurrentMonthRangeIST();
  return { ...validated, startDate: start, endDate: end };
}

/**
 * Build base filter from validated query (date range, pumpId, userId).
 * Merges createdAt from buildCreatedAtFilter and optional pumpId/userId.
 * Applies allowedPumpIds when provided (manager scope).
 */
function buildStatsFilter(validated, allowedPumpIds) {
  const createdAt = buildCreatedAtFilter(validated);
  const filter = {};
  if (createdAt) {
    if (createdAt.$and) {
      filter.$and = createdAt.$and;
    } else if (createdAt.createdAt) {
      filter.createdAt = createdAt.createdAt;
    }
  }
  if (validated?.pumpId) filter.pumpId = toObjectId(validated.pumpId);
  if (validated?.userId) filter.userId = toObjectId(validated.userId);
  if (allowedPumpIds != null && Array.isArray(allowedPumpIds) && allowedPumpIds.length > 0) {
    const pumpFilter = { pumpId: { $in: allowedPumpIds.map(toObjectId) } };
    if (filter.$and) {
      filter.$and.push(pumpFilter);
    } else {
      Object.assign(filter, pumpFilter);
    }
  }
  return filter;
}

const STATS_LIST_LIMIT = 10000;

/**
 * Get review statistics: list of enriched transactions + totals (no byPeriod, no attachments in list).
 * When no date filter is provided, uses current month (IST).
 * Query: startDate?, endDate?, month?, year?, startTime?, endTime?, pumpId?, userId?
 * @param {Object} validated - Validated query params
 * @param {string[]|null} allowedPumpIds - Admin: null (all pumps). Manager/Staff: allowed pump IDs.
 */
export async function getReviewStats(validated, allowedPumpIds = null) {
  const withDefault = applyDefaultCurrentMonth(validated || {});
  const baseFilter = buildStatsFilter(withDefault, allowedPumpIds);

  const [txAgg, redemptionAgg, staffManagerUserIds, txListResult] = await Promise.all([
    getTransactionAggregates(baseFilter),
    getRedemptionAggregates(baseFilter),
    getStaffManagerRegisteredUserIds(),
    transactionService.listTransactions(
      baseFilter,
      { page: 1, limit: STATS_LIST_LIMIT, sort: { createdAt: -1 } },
      allowedPumpIds
    ),
  ]);

  let totalPointsGeneratedByStaffManager = 0;
  let totalPointsRedeemedByStaffManager = 0;

  if (staffManagerUserIds && staffManagerUserIds.length > 0) {
    const txFilter = { ...baseFilter, userId: { $in: staffManagerUserIds } };
    const redemptionFilter = { ...baseFilter, userId: { $in: staffManagerUserIds } };
    const [txStaff, redStaff] = await Promise.all([
      getTransactionAggregates(txFilter),
      getRedemptionAggregates(redemptionFilter),
    ]);
    totalPointsGeneratedByStaffManager = txStaff.totalPointsGenerated ?? 0;
    totalPointsRedeemedByStaffManager = redStaff.totalPointsRedeemed ?? 0;
  }

  const list = txListResult?.list ?? [];

  return {
    list,
    totalAmount: txAgg.totalAmount ?? 0,
    totalLiters: txAgg.totalLiters ?? 0,
    totalPointsGenerated: txAgg.totalPointsGenerated ?? 0,
    totalPointsRedeemed: redemptionAgg.totalPointsRedeemed ?? 0,
    totalPointsGeneratedByStaffManager,
    totalPointsRedeemedByStaffManager,
  };
}

/**
 * Fleet review statistics for a fleet owner: transactions (and redemptions) of owner + all their drivers.
 * Same filters as getReviewStats (startDate, endDate, month, year, startTime, endTime, pumpId?, userId?).
 * userId when provided must be in the owner's fleet (owner or one of their drivers).
 * @param {Object} validated - Validated query params
 * @param {string} ownerId - Fleet owner's user _id
 */
export async function getFleetReviewStats(validated, ownerId) {
  const fleetUserIds = await userRepository.getFleetUserIds(ownerId);
  const fleetObjectIds = fleetUserIds.map((id) => toObjectId(id));

  const withDefault = applyDefaultCurrentMonth(validated || {});
  const createdAt = buildCreatedAtFilter(withDefault);
  const filter = {};
  if (createdAt) {
    if (createdAt.$and) {
      filter.$and = [...createdAt.$and];
    } else if (createdAt.createdAt) {
      filter.createdAt = createdAt.createdAt;
    }
  }
  if (withDefault?.userId) {
    const requestedStr = String(withDefault.userId);
    if (!fleetUserIds.includes(requestedStr)) {
      return {
        list: [],
        totalAmount: 0,
        totalLiters: 0,
        totalPointsGenerated: 0,
        totalPointsRedeemed: 0,
        totalPointsGeneratedByStaffManager: 0,
        totalPointsRedeemedByStaffManager: 0,
      };
    }
    filter.userId = toObjectId(withDefault.userId);
  } else {
    filter.userId = { $in: fleetObjectIds };
  }
  if (withDefault?.pumpId) filter.pumpId = toObjectId(withDefault.pumpId);

  const baseFilter = filter;
  const [txAgg, redemptionAgg, txListResult] = await Promise.all([
    getTransactionAggregates(baseFilter),
    getRedemptionAggregates(baseFilter),
    transactionService.listTransactions(
      baseFilter,
      { page: 1, limit: STATS_LIST_LIMIT, sort: { createdAt: -1 } },
      null
    ),
  ]);
  const list = txListResult?.list ?? [];

  return {
    list,
    totalAmount: txAgg.totalAmount ?? 0,
    totalLiters: txAgg.totalLiters ?? 0,
    totalPointsGenerated: txAgg.totalPointsGenerated ?? 0,
    totalPointsRedeemed: redemptionAgg.totalPointsRedeemed ?? 0,
    totalPointsGeneratedByStaffManager: 0,
    totalPointsRedeemedByStaffManager: 0,
  };
}

/**
 * Get user registrations: list + totalRegistrations + byPeriod + referral earned statistics.
 * When no date filter is provided, uses current month (IST).
 * referrerIds: when set (manager), only referral points earned by these referrers (Manager + their Staff) are counted.
 * @param {Object} validated - Query params
 * @param {string[]|null} allowedPumpIds - For user filter (registeredPumpId) and manager scope
 * @param {string[]|null} referrerIds - For referral stats: referrer user IDs (Manager + Staff). Null = all (admin).
 * @param {string} groupBy - 'day' | 'month'
 */
export async function getUserRegistrationGraph(validated, allowedPumpIds = null, referrerIds = null, groupBy = 'day') {
  const withDefault = applyDefaultCurrentMonth(validated || {});
  const createdAt = buildCreatedAtFilter(withDefault);
  const filter = {};
  if (createdAt) {
    if (createdAt.$and) {
      filter.$and = createdAt.$and;
    } else if (createdAt.createdAt) {
      filter.createdAt = createdAt.createdAt;
    }
  }
  if (allowedPumpIds != null && Array.isArray(allowedPumpIds) && allowedPumpIds.length > 0) {
    filter.registeredPumpId = { $in: allowedPumpIds };
  }

  const referralMatch = {};
  if (createdAt) {
    if (createdAt.$and) {
      referralMatch.$and = createdAt.$and;
    } else if (createdAt.createdAt) {
      referralMatch.createdAt = createdAt.createdAt;
    }
  }
  if (referrerIds != null && referrerIds.length > 0) {
    referralMatch.userId = { $in: referrerIds };
  }

  const [byPeriodResult, userListResult, referralStats] = await Promise.all([
    getRegistrationGraph(filter, groupBy),
    userRepository.list(filter, { page: 1, limit: STATS_LIST_LIMIT, sort: { createdAt: -1 } }),
    getReferralEarnedStats(referralMatch),
  ]);
  const list = userListResult?.list ?? [];
  const totalRegistrations = userListResult?.total ?? list.length;

  return {
    list,
    totalRegistrations,
    byPeriod: byPeriodResult ?? [],
    totalReferralPointsEarned: referralStats.totalReferralPointsEarned ?? 0,
    totalReferralSignups: referralStats.totalReferralSignups ?? 0,
  };
}
