import Transaction from '../models/Transaction.model.js';
import Redemption from '../models/Redemption.model.js';
import User from '../models/User.model.js';
import PointsLedger from '../models/PointsLedger.model.js';
import { REDEMPTION_STATUS } from '../constants/status.js';

/** Statuses that count as "redeemed" (points actually used). */
const REDEEMED_STATUSES = [
  REDEMPTION_STATUS.APPROVED,
  REDEMPTION_STATUS.ACTIVE,
  REDEMPTION_STATUS.USED,
];

/**
 * Aggregate transaction totals: totalAmount, totalLiters, totalPointsGenerated.
 * @param {Object} matchFilter - MongoDB match (e.g. { createdAt: {...}, pumpId?, userId? })
 */
export async function getTransactionAggregates(matchFilter) {
  const result = await Transaction.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        totalLiters: { $sum: { $ifNull: ['$liters', 0] } },
        totalPointsGenerated: { $sum: '$pointsEarned' },
      },
    },
    { $project: { _id: 0 } },
  ]);
  return result[0] || { totalAmount: 0, totalLiters: 0, totalPointsGenerated: 0 };
}

/**
 * Aggregate redemption totals: totalPointsRedeemed (only approved/active/used).
 * @param {Object} matchFilter - MongoDB match (e.g. { createdAt: {...}, userId? }, plus status)
 */
export async function getRedemptionAggregates(matchFilter) {
  const match = { ...matchFilter, status: { $in: REDEEMED_STATUSES } };
  const result = await Redemption.aggregate([
    { $match: match },
    { $group: { _id: null, totalPointsRedeemed: { $sum: '$pointsUsed' } } },
    { $project: { _id: 0 } },
  ]);
  return result[0] || { totalPointsRedeemed: 0 };
}

/**
 * Transaction aggregates grouped by period (for charts). IST timezone.
 * @param {Object} matchFilter - Same as getTransactionAggregates
 * @param {string} groupBy - 'day' | 'month'
 * @returns {Array<{ period: string, totalAmount: number, totalLiters: number, totalPointsGenerated: number }>}
 */
export async function getTransactionAggregatesByPeriod(matchFilter, groupBy = 'month') {
  const dateFormat = groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';
  const result = await Transaction.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: {
          $dateToString: {
            format: dateFormat,
            date: '$createdAt',
            timezone: 'Asia/Kolkata',
          },
        },
        totalAmount: { $sum: '$amount' },
        totalLiters: { $sum: { $ifNull: ['$liters', 0] } },
        totalPointsGenerated: { $sum: '$pointsEarned' },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { period: '$_id', totalAmount: 1, totalLiters: 1, totalPointsGenerated: 1, _id: 0 } },
  ]);
  return result;
}

/**
 * Redemption aggregates grouped by period (for charts). IST timezone.
 * @param {Object} matchFilter - Same as getRedemptionAggregates (status added in repo)
 * @param {string} groupBy - 'day' | 'month'
 * @returns {Array<{ period: string, totalPointsRedeemed: number }>}
 */
export async function getRedemptionAggregatesByPeriod(matchFilter, groupBy = 'month') {
  const dateFormat = groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';
  const match = { ...matchFilter, status: { $in: REDEEMED_STATUSES } };
  const result = await Redemption.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: {
            format: dateFormat,
            date: '$createdAt',
            timezone: 'Asia/Kolkata',
          },
        },
        totalPointsRedeemed: { $sum: '$pointsUsed' },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { period: '$_id', totalPointsRedeemed: 1, _id: 0 } },
  ]);
  return result;
}

/**
 * Get user IDs that were registered by Staff or Manager (createdByModel in ['Manager','Staff']).
 */
export async function getStaffManagerRegisteredUserIds() {
  return User.distinct('_id', {
    createdByModel: { $in: ['Manager', 'Staff'] },
  });
}

/**
 * Referral earned stats: points credited to referrers (Manager/Staff) for referrals in period.
 * PointsLedger entries with type='credit' and reason containing "Referral".
 * @param {Object} matchFilter - { createdAt: {...}, userId?: { $in: referrerIds } }
 * @returns {{ totalReferralPointsEarned: number, totalReferralSignups: number }}
 */
export async function getReferralEarnedStats(matchFilter) {
  const match = {
    ...matchFilter,
    type: 'credit',
    ownerType: { $in: ['Manager', 'Staff'] },
    reason: { $regex: /Referral/i },
  };
  const result = await PointsLedger.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalReferralPointsEarned: { $sum: '$points' },
        totalReferralSignups: { $sum: 1 },
      },
    },
    { $project: { _id: 0 } },
  ]);
  return result[0] || { totalReferralPointsEarned: 0, totalReferralSignups: 0 };
}

/**
 * User registration counts grouped by date (IST date string YYYY-MM-DD) for graph.
 * @param {Object} matchFilter - e.g. { createdAt: {...}, registeredPumpId? }
 * @param {string} groupBy - 'day' | 'month'
 */
export async function getRegistrationGraph(matchFilter, groupBy = 'day') {
  const dateFormat = groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';
  const result = await User.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: {
          $dateToString: {
            format: dateFormat,
            date: '$createdAt',
            timezone: 'Asia/Kolkata',
          },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { date: '$_id', count: 1, _id: 0 } },
  ]);
  return result;
}
