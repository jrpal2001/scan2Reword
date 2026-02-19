import { pointsLedgerRepository } from '../repositories/pointsLedger.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { pointsService } from './points.service.js';
import { systemConfigService } from './systemConfig.service.js';
import { notificationService } from './notification.service.js';
import User from '../models/User.model.js';

/**
 * Points Expiry Service
 * Handles expiry of points using FIFO logic and sends notifications
 */
export const pointsExpiryService = {
  /**
   * Process expired points for all users
   * Runs daily to expire points that have passed their expiry date
   */
  async processExpiredPoints() {
    console.log('[Points Expiry] Starting daily expiry process...');
    
    try {
      const config = await systemConfigService.getConfig();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Find all active users
      const users = await User.find({ status: 'active' }).select('_id').lean();
      let totalExpired = 0;
      let usersProcessed = 0;
      let errors = 0;

      for (const user of users) {
        try {
          const expired = await this.expirePointsForUser(user._id.toString(), today);
          if (expired > 0) {
            totalExpired += expired;
            usersProcessed++;
          }
        } catch (error) {
          console.error(`[Points Expiry] Error processing user ${user._id}:`, error.message);
          errors++;
        }
      }

      console.log(`[Points Expiry] Completed. Processed ${usersProcessed} users, expired ${totalExpired} points, ${errors} errors`);
      return { usersProcessed, totalExpired, errors };
    } catch (error) {
      console.error('[Points Expiry] Fatal error in processExpiredPoints:', error);
      throw error;
    }
  },

  /**
   * Expire points for a specific user using FIFO logic
   * @param {string} userId - User ID
   * @param {Date} expiryDate - Date to expire points (typically today)
   * @returns {number} Total points expired
   */
  async expirePointsForUser(userId, expiryDate) {
    // Find all credit entries that have expired (FIFO: oldest expiry first)
    const expiringEntries = await pointsLedgerRepository.findExpiringPoints(userId, expiryDate);

    if (expiringEntries.length === 0) {
      return 0;
    }

    let totalExpired = 0;

    // Process each expired entry (FIFO order)
    for (const entry of expiringEntries) {
      const pointsToExpire = entry.points;
      
      if (pointsToExpire > 0) {
        // Mark entry as expired by setting points to 0 (or we could add a flag)
        // For now, we'll create an expiry ledger entry and update the wallet
        await pointsService.debitPoints({
          userId,
          points: pointsToExpire,
          type: 'expiry',
          reason: `Points expired on ${expiryDate.toISOString().split('T')[0]}`,
          createdBy: null,
        });

        // Note: We don't modify the original credit entry
        // The expiry ledger entry created by debitPoints records the expiry
        // The original credit entry remains for audit purposes
        // However, we need to track which entries have been expired
        // We'll use a different approach: mark entries as expired by updating points to 0
        // But actually, the debitPoints already handles wallet update, so we just need to mark the entry
        
        // Mark entry as processed by setting points to 0
        // This prevents re-processing the same entry
        await pointsLedgerRepository.update(entry._id, { points: 0 });

        totalExpired += pointsToExpire;
      }
    }

    return totalExpired;
  },

  /**
   * Send expiry notifications to users whose points are expiring soon
   * Checks notificationDays from SystemConfig (e.g., [30, 7, 1])
   */
  async sendExpiryNotifications() {
    console.log('[Points Expiry] Starting expiry notification process...');
    
    try {
      const config = await systemConfigService.getConfig();
      const notificationDays = config.pointsExpiry?.notificationDays || [];

      if (notificationDays.length === 0) {
        console.log('[Points Expiry] No notification days configured, skipping notifications');
        return { notificationsSent: 0 };
      }

      const users = await User.find({ status: 'active' }).select('_id fullName mobile FcmTokens').lean();
      let notificationsSent = 0;

      for (const user of users) {
        try {
          // Check each notification day
          for (const daysBefore of notificationDays) {
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + daysBefore);
            targetDate.setHours(23, 59, 59, 999); // End of day

            // Find points expiring on this date
            const expiringEntries = await pointsLedgerRepository.findExpiringPoints(
              user._id.toString(),
              targetDate
            );

            if (expiringEntries.length > 0) {
              const totalExpiring = expiringEntries.reduce((sum, e) => sum + e.points, 0);
              
              // Send notification
              await this.sendExpiryNotificationToUser(
                user,
                totalExpiring,
                daysBefore,
                targetDate
              );
              notificationsSent++;
              break; // Only send one notification per user per day
            }
          }
        } catch (error) {
          console.error(`[Points Expiry] Error sending notification to user ${user._id}:`, error.message);
        }
      }

      console.log(`[Points Expiry] Sent ${notificationsSent} expiry notifications`);
      return { notificationsSent };
    } catch (error) {
      console.error('[Points Expiry] Fatal error in sendExpiryNotifications:', error);
      throw error;
    }
  },

  /**
   * Send expiry notification to a specific user
   * @param {Object} user - User object with _id, fullName, mobile, FcmTokens
   * @param {number} pointsExpiring - Total points expiring
   * @param {number} daysBefore - Days before expiry (30, 7, or 1)
   * @param {Date} expiryDate - Date when points expire
   */
  async sendExpiryNotificationToUser(user, pointsExpiring, daysBefore, expiryDate) {
    const title = `Points Expiring Soon!`;
    const body = `You have ${pointsExpiring} points expiring in ${daysBefore} day${daysBefore > 1 ? 's' : ''}. Use them before ${expiryDate.toLocaleDateString()}!`;

    try {
      // Send push notification if user has FCM tokens
      if (user.FcmTokens && user.FcmTokens.length > 0) {
        await notificationService.sendToUsers({
          userIds: [user._id.toString()],
          title,
          body,
          link: '/wallet',
        });
      }

      // Optionally send SMS notification
      // await smsService.sendSMS(user.mobile, body);

      console.log(`[Points Expiry] Notification sent to user ${user._id} (${pointsExpiring} points expiring in ${daysBefore} days)`);
    } catch (error) {
      console.error(`[Points Expiry] Failed to send notification to user ${user._id}:`, error.message);
      throw error;
    }
  },
};
