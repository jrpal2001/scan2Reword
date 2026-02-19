import { userRepository } from '../repositories/user.repository.js';
import { transactionRepository } from '../repositories/transaction.repository.js';
import { redemptionRepository } from '../repositories/redemption.repository.js';
import { pointsLedgerRepository } from '../repositories/pointsLedger.repository.js';
import User from '../models/User.model.js';
import Transaction from '../models/Transaction.model.js';
import Redemption from '../models/Redemption.model.js';
import PointsLedger from '../models/PointsLedger.model.js';
import mongoose from 'mongoose';

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

    return {
      users: {
        total: totalUsers,
        newToday: newUsersToday,
        newThisMonth: newUsersThisMonth,
        active: activeUsers.length,
      },
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

    return {
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
