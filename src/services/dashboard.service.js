import { userRepository } from '../repositories/user.repository.js';
import { transactionRepository } from '../repositories/transaction.repository.js';
import { redemptionRepository } from '../repositories/redemption.repository.js';
import { pointsLedgerRepository } from '../repositories/pointsLedger.repository.js';
import { pumpRepository } from '../repositories/pump.repository.js';
import User from '../models/User.model.js';
import Transaction from '../models/Transaction.model.js';
import Redemption from '../models/Redemption.model.js';
import PointsLedger from '../models/PointsLedger.model.js';
import Manager from '../models/Manager.model.js';
import Staff from '../models/Staff.model.js';
import StaffAssignment from '../models/StaffAssignment.model.js';
import Pump from '../models/Pump.model.js';
import mongoose from 'mongoose';

const RECENT_TRANSACTIONS_LIMIT = 20;

/**
 * Resolve operator IDs to { _id, fullName, staffCode } from Staff or Manager model (who made the transaction)
 */
async function resolveOperators(operatorIds) {
  const ids = [...new Set(operatorIds.filter(Boolean).map((id) => id.toString()))];
  if (ids.length === 0) return {};
  const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
  const [staffList, managerList] = await Promise.all([
    Staff.find({ _id: { $in: objectIds } }).select('_id fullName staffCode').lean(),
    Manager.find({ _id: { $in: objectIds } }).select('_id fullName managerCode').lean(),
  ]);
  const map = {};
  staffList.forEach((s) => { map[s._id.toString()] = { _id: s._id, fullName: s.fullName, staffCode: s.staffCode ?? null }; });
  managerList.forEach((m) => { map[m._id.toString()] = { _id: m._id, fullName: m.fullName, staffCode: m.managerCode ?? null }; });
  return map;
}

/**
 * Get recent transactions with limited fields: _id, pumpId (_id, name, code), liters, operator (staff/manager who made it: _id, fullName)
 */
async function getRecentTransactionsWithPump(filter, limit = RECENT_TRANSACTIONS_LIMIT) {
  const list = await Transaction.find({ ...filter, status: 'completed' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('_id pumpId liters operatorId')
    .populate('pumpId', 'name code')
    .lean();

  const operatorMap = await resolveOperators(list.map((t) => t.operatorId));

  return list.map((t) => {
    const op = t.operatorId ? operatorMap[t.operatorId.toString()] : null;
    return {
      _id: t._id,
      pumpId: t.pumpId
        ? { _id: t.pumpId._id, name: t.pumpId.name, code: t.pumpId.code }
        : null,
      liters: t.liters ?? null,
      operator: op ? { _id: op._id, fullName: op.fullName, staffCode: op.staffCode } : null,
    };
  });
}

/**
 * Dashboard Service
 * Provides aggregated statistics for admin and manager dashboards
 */
export const dashboardService = {
  /**
   * Get admin dashboard statistics (system-wide)
   */
  async getAdminDashboard() {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Total users
    const totalUsers = await User.countDocuments({ status: 'active' });
    const newUsersToday = await User.countDocuments({
      status: 'active',
      createdAt: { $gte: todayStart },
    });
    const newUsersThisMonth = await User.countDocuments({
      status: 'active',
      createdAt: { $gte: thisMonthStart },
    });

    // Total transactions
    const totalTransactions = await Transaction.countDocuments({ status: 'completed' });
    const transactionsToday = await Transaction.countDocuments({
      status: 'completed',
      createdAt: { $gte: todayStart },
    });
    const transactionsThisMonth = await Transaction.countDocuments({
      status: 'completed',
      createdAt: { $gte: thisMonthStart },
    });

    // Transaction revenue
    const revenueToday = await Transaction.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: todayStart },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);
    const revenueThisMonth = await Transaction.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: thisMonthStart },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);
    const revenueLastMonth = await Transaction.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);

    // Points statistics
    const pointsStats = await PointsLedger.aggregate([
      {
        $match: { type: 'credit' },
      },
      {
        $group: {
          _id: null,
          totalPointsEarned: { $sum: '$points' },
        },
      },
    ]);
    const pointsRedeemed = await PointsLedger.aggregate([
      {
        $match: { type: 'debit' },
      },
      {
        $group: {
          _id: null,
          totalPointsRedeemed: { $sum: { $abs: '$points' } },
        },
      },
    ]);
    const pointsExpired = await PointsLedger.aggregate([
      {
        $match: { type: 'expiry' },
      },
      {
        $group: {
          _id: null,
          totalPointsExpired: { $sum: { $abs: '$points' } },
        },
      },
    ]);

    // Redemptions
    const totalRedemptions = await Redemption.countDocuments({ status: 'approved' });
    const redemptionsToday = await Redemption.countDocuments({
      status: 'approved',
      createdAt: { $gte: todayStart },
    });
    const redemptionsThisMonth = await Redemption.countDocuments({
      status: 'approved',
      createdAt: { $gte: thisMonthStart },
    });

    // Active users (users with transactions in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeUsers = await Transaction.distinct('userId', {
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Manager, Staff, and Pump counts (system-wide)
    const managerCount = await Manager.countDocuments({ status: 'active' });
    const staffCount = await Staff.countDocuments({ status: 'active' });
    const pumpCount = await Pump.countDocuments({ status: 'active' });

    // Recent 20 transactions with pump details
    const recentTransactions = await getRecentTransactionsWithPump({}, RECENT_TRANSACTIONS_LIMIT);

    return {
      users: {
        total: totalUsers,
        newToday: newUsersToday,
        newThisMonth: newUsersThisMonth,
        active: activeUsers.length,
      },
      managers: { total: managerCount },
      staff: { total: staffCount },
      pumps: { total: pumpCount },
      transactions: {
        total: totalTransactions,
        today: transactionsToday,
        thisMonth: transactionsThisMonth,
      },
      revenue: {
        today: revenueToday[0]?.total || 0,
        thisMonth: revenueThisMonth[0]?.total || 0,
        lastMonth: revenueLastMonth[0]?.total || 0,
        growth: revenueLastMonth[0]?.total
          ? ((revenueThisMonth[0]?.total - revenueLastMonth[0]?.total) / revenueLastMonth[0]?.total) * 100
          : 0,
      },
      points: {
        totalEarned: pointsStats[0]?.totalPointsEarned || 0,
        totalRedeemed: pointsRedeemed[0]?.totalPointsRedeemed || 0,
        totalExpired: pointsExpired[0]?.totalPointsExpired || 0,
        available: (pointsStats[0]?.totalPointsEarned || 0) - (pointsRedeemed[0]?.totalPointsRedeemed || 0) - (pointsExpired[0]?.totalPointsExpired || 0),
      },
      redemptions: {
        total: totalRedemptions,
        today: redemptionsToday,
        thisMonth: redemptionsThisMonth,
      },
      recentTransactions,
    };
  },

  /**
   * Get manager dashboard statistics (pump-scoped)
   * @param {Array<string>} pumpIds - Array of pump IDs the manager has access to
   */
  async getManagerDashboard(pumpIds) {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Assigned pump details (pumps this manager manages)
    const pumpIdList = Array.isArray(pumpIds) ? pumpIds : [];
    const pumps = pumpIdList.length
      ? await Promise.all(pumpIdList.map((pid) => pumpRepository.findById(pid)))
      : [];
    const assignedPumps = pumps.filter(Boolean).map((p) => ({
      _id: p._id,
      name: p.name,
      code: p.code,
      location: p.location,
      status: p.status,
    }));

    // Transactions for manager's pumps
    const transactionsToday = await Transaction.countDocuments({
      pumpId: { $in: pumpIds },
      status: 'completed',
      createdAt: { $gte: todayStart },
    });
    const transactionsThisMonth = await Transaction.countDocuments({
      pumpId: { $in: pumpIds },
      status: 'completed',
      createdAt: { $gte: thisMonthStart },
    });

    // Revenue for manager's pumps
    const revenueToday = await Transaction.aggregate([
      {
        $match: {
          pumpId: { $in: pumpIds },
          status: 'completed',
          createdAt: { $gte: todayStart },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);
    const revenueThisMonth = await Transaction.aggregate([
      {
        $match: {
          pumpId: { $in: pumpIds },
          status: 'completed',
          createdAt: { $gte: thisMonthStart },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);

    // Points issued for manager's pumps
    const pointsIssuedToday = await Transaction.aggregate([
      {
        $match: {
          pumpId: { $in: pumpIds },
          status: 'completed',
          createdAt: { $gte: todayStart },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$pointsEarned' },
        },
      },
    ]);
    const pointsIssuedThisMonth = await Transaction.aggregate([
      {
        $match: {
          pumpId: { $in: pumpIds },
          status: 'completed',
          createdAt: { $gte: thisMonthStart },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$pointsEarned' },
        },
      },
    ]);

    // Redemptions at manager's pumps
    const redemptionsToday = await Redemption.countDocuments({
      usedAtPump: { $in: pumpIds },
      status: 'approved',
      createdAt: { $gte: todayStart },
    });
    const redemptionsThisMonth = await Redemption.countDocuments({
      usedAtPump: { $in: pumpIds },
      status: 'approved',
      createdAt: { $gte: thisMonthStart },
    });

    // Staff assigned to manager's pumps (distinct staff count)
    const assignedStaffIds = await StaffAssignment.distinct('staffId', {
      pumpId: { $in: pumpIds },
      status: 'active',
    });
    const staffCount = assignedStaffIds.length;

    // Recent 20 transactions for manager's pumps with pump details
    const recentTransactions = await getRecentTransactionsWithPump(
      { pumpId: { $in: pumpIds } },
      RECENT_TRANSACTIONS_LIMIT
    );

    return {
      assignedPumps,
      staff: { total: staffCount },
      transactions: {
        today: transactionsToday,
        thisMonth: transactionsThisMonth,
      },
      revenue: {
        today: revenueToday[0]?.total || 0,
        thisMonth: revenueThisMonth[0]?.total || 0,
      },
      points: {
        issuedToday: pointsIssuedToday[0]?.total || 0,
        issuedThisMonth: pointsIssuedThisMonth[0]?.total || 0,
      },
      redemptions: {
        today: redemptionsToday,
        thisMonth: redemptionsThisMonth,
      },
      recentTransactions,
    };
  },

  /**
   * Get staff dashboard (pump-scoped: staff's assigned pump(s))
   * @param {Array<string|ObjectId>} pumpIds - Staff's assigned pump IDs (from StaffAssignment)
   * @param {string|ObjectId} staffId - Staff document _id
   */
  async getStaffDashboard(pumpIds, staffId) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const day = now.getDay(); // 0=Sun..6=Sat
    const diffToMonday = (day + 6) % 7; // Mon=0
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0, 0);

    if (!pumpIds || pumpIds.length === 0) {
      return {
        assignedPumps: [],
        manager: null,
        transactions: { today: 0, thisMonth: 0 },
        revenue: { today: 0, thisMonth: 0 },
        pointsIssued: { today: 0, thisMonth: 0 },
        redemptions: { today: 0, thisMonth: 0 },
        recentTransactions: [],
      };
    }

    const pumpIdList = pumpIds.map((id) => (typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id));

    // Assigned pump details
    const pumps = await Promise.all(
      pumpIdList.map((pid) => pumpRepository.findById(pid))
    );
    const assignedPumps = pumps.filter(Boolean).map((p) => ({
      _id: p._id,
      name: p.name,
      code: p.code,
      location: p.location,
      status: p.status,
    }));

    // Manager of this staff: derived from first assigned pump's managerIds (staff → pump → manager)
    let manager = null;
    const firstPumpWithManager = pumps.find(
      (p) => p && ((Array.isArray(p.managerIds) && p.managerIds.length > 0) || p.managerId)
    );
    const primaryManagerId = firstPumpWithManager
      ? (Array.isArray(firstPumpWithManager.managerIds) && firstPumpWithManager.managerIds.length > 0
          ? firstPumpWithManager.managerIds[0]
          : firstPumpWithManager.managerId)
      : null;
    if (primaryManagerId) {
      const managerDoc = await Manager.findById(primaryManagerId)
        .select('_id fullName profilePhoto mobile')
        .lean();
      if (managerDoc) {
        manager = {
          _id: managerDoc._id,
          fullName: managerDoc.fullName,
          profilePhoto: managerDoc.profilePhoto ?? null,
          mobile: managerDoc.mobile,
        };
      }
    }

    // Transactions at staff's pump(s) (where they are operator or any at their pump)
    const transactionsToday = await Transaction.countDocuments({
      pumpId: { $in: pumpIdList },
      status: 'completed',
      createdAt: { $gte: todayStart },
    });
    const transactionsThisMonth = await Transaction.countDocuments({
      pumpId: { $in: pumpIdList },
      status: 'completed',
      createdAt: { $gte: thisMonthStart },
    });

    // Revenue at staff's pump(s)
    const revenueToday = await Transaction.aggregate([
      { $match: { pumpId: { $in: pumpIdList }, status: 'completed', createdAt: { $gte: todayStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const revenueThisMonth = await Transaction.aggregate([
      { $match: { pumpId: { $in: pumpIdList }, status: 'completed', createdAt: { $gte: thisMonthStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    // Points issued at staff's pump(s)
    const pointsToday = await Transaction.aggregate([
      { $match: { pumpId: { $in: pumpIdList }, status: 'completed', createdAt: { $gte: todayStart } } },
      { $group: { _id: null, total: { $sum: '$pointsEarned' } } },
    ]);
    const pointsThisMonth = await Transaction.aggregate([
      { $match: { pumpId: { $in: pumpIdList }, status: 'completed', createdAt: { $gte: thisMonthStart } } },
      { $group: { _id: null, total: { $sum: '$pointsEarned' } } },
    ]);

    // Redemptions at staff's pump(s)
    const redemptionsToday = await Redemption.countDocuments({
      usedAtPump: { $in: pumpIdList },
      status: 'approved',
      createdAt: { $gte: todayStart },
    });
    const redemptionsThisMonth = await Redemption.countDocuments({
      usedAtPump: { $in: pumpIdList },
      status: 'approved',
      createdAt: { $gte: thisMonthStart },
    });

    // Recent 20 transactions that this staff made (operatorId = this staff) at their pump(s)
    const recentTransactions = await getRecentTransactionsWithPump(
      { pumpId: { $in: pumpIdList }, operatorId: staffId },
      RECENT_TRANSACTIONS_LIMIT
    );

    // Transactions created by this staff (as operator)
    const myTransactionsToday = await Transaction.countDocuments({
      pumpId: { $in: pumpIdList },
      operatorId: staffId,
      status: 'completed',
      createdAt: { $gte: todayStart },
    });
    const myTransactionsThisMonth = await Transaction.countDocuments({
      pumpId: { $in: pumpIdList },
      operatorId: staffId,
      status: 'completed',
      createdAt: { $gte: thisMonthStart },
    });

    // My totals (created by this staff): liters (Fuel only), amount, points - today/thisWeek/thisMonth
    const [myTotalsToday, myTotalsThisWeek, myTotalsThisMonth] = await Promise.all([
      Transaction.aggregate([
        { $match: { pumpId: { $in: pumpIdList }, operatorId: staffId, status: 'completed', createdAt: { $gte: todayStart } } },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            totalPoints: { $sum: '$pointsEarned' },
            totalFuelLiters: { $sum: { $cond: [{ $eq: ['$category', 'Fuel'] }, { $ifNull: ['$liters', 0] }, 0] } },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: { pumpId: { $in: pumpIdList }, operatorId: staffId, status: 'completed', createdAt: { $gte: weekStart } } },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            totalPoints: { $sum: '$pointsEarned' },
            totalFuelLiters: { $sum: { $cond: [{ $eq: ['$category', 'Fuel'] }, { $ifNull: ['$liters', 0] }, 0] } },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: { pumpId: { $in: pumpIdList }, operatorId: staffId, status: 'completed', createdAt: { $gte: thisMonthStart } } },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            totalPoints: { $sum: '$pointsEarned' },
            totalFuelLiters: { $sum: { $cond: [{ $eq: ['$category', 'Fuel'] }, { $ifNull: ['$liters', 0] }, 0] } },
          },
        },
      ]),
    ]);
    const tDay = myTotalsToday?.[0] || {};
    const tWeek = myTotalsThisWeek?.[0] || {};
    const tMonth = myTotalsThisMonth?.[0] || {};

    return {
      assignedPumps,
      manager,
      transactions: {
        today: transactionsToday,
        thisMonth: transactionsThisMonth,
      },
      myTransactions: {
        today: myTransactionsToday,
        thisMonth: myTransactionsThisMonth,
      },
      myTotals: {
        today: {
          fuelLiters: tDay.totalFuelLiters || 0,
          amount: tDay.totalAmount || 0,
          points: tDay.totalPoints || 0,
        },
        thisWeek: {
          fuelLiters: tWeek.totalFuelLiters || 0,
          amount: tWeek.totalAmount || 0,
          points: tWeek.totalPoints || 0,
        },
        thisMonth: {
          fuelLiters: tMonth.totalFuelLiters || 0,
          amount: tMonth.totalAmount || 0,
          points: tMonth.totalPoints || 0,
        },
      },
      revenue: {
        today: revenueToday[0]?.total || 0,
        thisMonth: revenueThisMonth[0]?.total || 0,
      },
      pointsIssued: {
        today: pointsToday[0]?.total || 0,
        thisMonth: pointsThisMonth[0]?.total || 0,
      },
      redemptions: {
        today: redemptionsToday,
        thisMonth: redemptionsThisMonth,
      },
      recentTransactions,
    };
  },

  /**
   * Get fleet owner aggregation (all total fleet points and per-vehicle points)
   * @param {string} ownerId - Owner user ID
   */
  async getFleetAggregation(ownerId) {
    // Convert ownerId to ObjectId if it's a string
    const ownerObjectId = typeof ownerId === 'string' ? new mongoose.Types.ObjectId(ownerId) : ownerId;
    
    // Get all drivers/vehicles for this owner
    const fleetUsers = await User.find({ ownerId: ownerObjectId, status: 'active' }).select('_id fullName mobile').lean();

    // Get wallet summaries for all fleet users
    const fleetPoints = await Promise.all(
      fleetUsers.map(async (user) => {
        const wallet = await PointsLedger.aggregate([
          {
            $match: { userId: user._id },
          },
          {
            $group: {
              _id: null,
              totalEarned: {
                $sum: {
                  $cond: [{ $eq: ['$type', 'credit'] }, '$points', 0],
                },
              },
              totalRedeemed: {
                $sum: {
                  $cond: [{ $eq: ['$type', 'debit'] }, { $abs: '$points' }, 0],
                },
              },
              totalExpired: {
                $sum: {
                  $cond: [{ $eq: ['$type', 'expiry'] }, { $abs: '$points' }, 0],
                },
              },
            },
          },
        ]);

        const stats = wallet[0] || { totalEarned: 0, totalRedeemed: 0, totalExpired: 0 };
        const availablePoints = stats.totalEarned - stats.totalRedeemed - stats.totalExpired;

        return {
          userId: user._id.toString(),
          fullName: user.fullName,
          mobile: user.mobile,
          points: {
            totalEarned: stats.totalEarned,
            totalRedeemed: stats.totalRedeemed,
            totalExpired: stats.totalExpired,
            available: availablePoints,
          },
        };
      })
    );

    // Calculate total fleet points
    const totalFleetPoints = fleetPoints.reduce(
      (sum, user) => ({
        totalEarned: sum.totalEarned + user.points.totalEarned,
        totalRedeemed: sum.totalRedeemed + user.points.totalRedeemed,
        totalExpired: sum.totalExpired + user.points.totalExpired,
        available: sum.available + user.points.available,
      }),
      { totalEarned: 0, totalRedeemed: 0, totalExpired: 0, available: 0 }
    );

    return {
      ownerId: typeof ownerId === 'string' ? ownerId : ownerId.toString(),
      totalFleetPoints,
      vehicles: fleetPoints,
      vehicleCount: fleetPoints.length,
    };
  },
};
