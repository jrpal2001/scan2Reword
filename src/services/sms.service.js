import { sendSMS as sendSMSUtil, sendOtpSMS } from '../utils/smsUtils.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * SMS Service - Uses DLT provider (Edumarc/Combirds)
 * Wraps the SMS utils with retry logic and error handling
 */
class SMSService {
  constructor() {
    this.maxRetries = 3;
  }

  /**
   * Send SMS using DLT provider
   * @param {string|string[]} to - Phone number(s) (with country code)
   * @param {string} message - SMS message (must match DLT template)
   * @param {Object} options - Additional options (senderId, templateId)
   * @returns {Promise<Object>} Result object
   */
  async sendSMS(to, message, options = {}) {
    const { retryCount = 0, senderId, templateId } = options;

    try {
      const result = await sendSMSUtil({
        number: to,
        message,
        senderId,
        templateId,
      });

      // Check if SMS was not configured
      if (result.ok === false && result.reason === 'SMS not configured') {
        console.warn('SMS not configured - skipping send');
        return result;
      }

      return {
        success: true,
        data: result,
        provider: 'dlt',
      };
    } catch (error) {
      console.error(`SMS send failed (attempt ${retryCount + 1}/${this.maxRetries}):`, error.message);

      // Retry logic
      if (retryCount < this.maxRetries - 1) {
        await this.delay(1000 * (retryCount + 1)); // Exponential backoff
        return this.sendSMS(to, message, { ...options, retryCount: retryCount + 1 });
      }

      // Log failure after max retries
      await this.logFailure(to, message, error);
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to send SMS after retries', error.message);
    }
  }

  /**
   * Send OTP SMS using DLT-compliant template
   * @param {string|string[]} to - Phone number(s)
   * @param {string} otp - OTP code
   * @returns {Promise<Object>}
   */
  async sendOTP(to, otp) {
    const { retryCount = 0 } = {};

    try {
      const result = await sendOtpSMS({ number: to, otp });

      // Check if SMS was not configured
      if (result.ok === false && result.reason === 'SMS not configured') {
        console.warn('SMS not configured - skipping OTP send');
        return result;
      }

      return {
        success: true,
        data: result,
        provider: 'dlt',
      };
    } catch (error) {
      console.error(`OTP SMS send failed (attempt ${retryCount + 1}/${this.maxRetries}):`, error.message);

      // Retry logic
      if (retryCount < this.maxRetries - 1) {
        await this.delay(1000 * (retryCount + 1));
        return this.sendOTP(to, otp);
      }

      await this.logFailure(to, `OTP: ${otp}`, error);
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to send OTP SMS after retries', error.message);
    }
  }

  /**
   * Log SMS failure
   */
  async logFailure(to, message, error) {
    // TODO: Store in database or logging service
    console.error('SMS Failure Log:', {
      to: Array.isArray(to) ? to.join(', ') : to,
      message: message.substring(0, 50) + '...',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Delay helper for retries
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const smsService = new SMSService();
