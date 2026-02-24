import cron from 'node-cron';
import { pointsExpiryService } from '../services/pointsExpiry.service.js';

/**
 * Points Expiry Cron Job
 * Runs daily at 12:00 AM to expire points and send notifications
 */
let expiryJob = null;
let notificationJob = null;

/**
 * Start the points expiry cron jobs.
 * DISABLED: Points do not expire in this system.
 */
export function startPointsExpiryJobs() {
  // Points expiry is disabled - no cron jobs started
  console.log('[Cron Job] Points expiry is disabled (no expiry system)');
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
