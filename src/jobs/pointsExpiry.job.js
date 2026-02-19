import cron from 'node-cron';
import { pointsExpiryService } from '../services/pointsExpiry.service.js';

/**
 * Points Expiry Cron Job
 * Runs daily at 12:00 AM to expire points and send notifications
 */
let expiryJob = null;
let notificationJob = null;

/**
 * Start the points expiry cron jobs
 */
export function startPointsExpiryJobs() {
  // Daily job to expire points (runs at 12:00 AM)
  expiryJob = cron.schedule('0 0 * * *', async () => {
    console.log('[Cron Job] Starting points expiry process...');
    try {
      await pointsExpiryService.processExpiredPoints();
    } catch (error) {
      console.error('[Cron Job] Error in points expiry job:', error);
    }
  }, {
    scheduled: false, // Don't start automatically
    timezone: 'Asia/Kolkata', // Adjust to your timezone
  });

  // Daily job to send expiry notifications (runs at 9:00 AM)
  notificationJob = cron.schedule('0 9 * * *', async () => {
    console.log('[Cron Job] Starting expiry notification process...');
    try {
      await pointsExpiryService.sendExpiryNotifications();
    } catch (error) {
      console.error('[Cron Job] Error in expiry notification job:', error);
    }
  }, {
    scheduled: false, // Don't start automatically
    timezone: 'Asia/Kolkata', // Adjust to your timezone
  });

  // Start the jobs
  expiryJob.start();
  notificationJob.start();

  console.log('[Cron Job] Points expiry jobs started');
  console.log('[Cron Job] Expiry job: Daily at 12:00 AM');
  console.log('[Cron Job] Notification job: Daily at 9:00 AM');
}

/**
 * Stop the points expiry cron jobs
 */
export function stopPointsExpiryJobs() {
  if (expiryJob) {
    expiryJob.stop();
    expiryJob = null;
  }
  if (notificationJob) {
    notificationJob.stop();
    notificationJob = null;
  }
  console.log('[Cron Job] Points expiry jobs stopped');
}
