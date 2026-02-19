import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * Email Service - Template-based email sending
 * Supports Nodemailer with SMTP, SendGrid, AWS SES
 */
class EmailService {
  constructor() {
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@scen2reward.com';
    this.fromName = process.env.FROM_NAME || 'Scen2Reward';
    this.maxRetries = 3;
  }

  /**
   * Send email using Nodemailer (SMTP)
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} html - HTML content
   * @param {string} text - Plain text content (optional)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Result object
   */
  async sendEmail(to, subject, html, text = null, options = {}) {
    const { retryCount = 0 } = options;

    try {
      return await this.sendViaNodemailer(to, subject, html, text);
    } catch (error) {
      console.error(`Email send failed (attempt ${retryCount + 1}/${this.maxRetries}):`, error.message);

      // Retry logic
      if (retryCount < this.maxRetries - 1) {
        await this.delay(1000 * (retryCount + 1)); // Exponential backoff
        return this.sendEmail(to, subject, html, text, { ...options, retryCount: retryCount + 1 });
      }

      // Log failure after max retries
      await this.logFailure(to, subject, error);
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to send email after retries', error.message);
    }
  }

  /**
   * Send email via Nodemailer (SMTP)
   */
  async sendViaNodemailer(to, subject, html, text) {
    const nodemailer = await import('nodemailer');

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: `"${this.fromName}" <${this.fromEmail}>`,
      to,
      subject,
      html,
      text: text || this.stripHTML(html),
    });

    return {
      success: true,
      messageId: info.messageId,
      provider: 'nodemailer',
    };
  }


  /**
   * Send welcome email
   */
  async sendWelcomeEmail(to, userName) {
    const subject = 'Welcome to Scen2Reward!';
    const html = this.getWelcomeTemplate(userName);
    return this.sendEmail(to, subject, html);
  }

  /**
   * Send transaction receipt email
   */
  async sendReceiptEmail(to, userName, transaction) {
    const subject = `Transaction Receipt - ${transaction.billNumber}`;
    const html = this.getReceiptTemplate(userName, transaction);
    return this.sendEmail(to, subject, html);
  }

  /**
   * Send redemption confirmation email
   */
  async sendRedemptionConfirmationEmail(to, userName, redemption) {
    const subject = 'Redemption Confirmation - Scen2Reward';
    const html = this.getRedemptionTemplate(userName, redemption);
    return this.sendEmail(to, subject, html);
  }

  /**
   * Email templates
   */
  getWelcomeTemplate(userName) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Scen2Reward!</h1>
          </div>
          <div class="content">
            <p>Hello ${userName},</p>
            <p>Thank you for joining Scen2Reward! Start earning points on every transaction.</p>
            <p>Happy Rewarding!</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Scen2Reward. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getReceiptTemplate(userName, transaction) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .receipt { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4CAF50; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Transaction Receipt</h1>
          </div>
          <div class="content">
            <p>Hello ${userName},</p>
            <div class="receipt">
              <p><strong>Bill Number:</strong> ${transaction.billNumber}</p>
              <p><strong>Amount:</strong> ₹${transaction.amount}</p>
              <p><strong>Category:</strong> ${transaction.category}</p>
              <p><strong>Points Earned:</strong> ${transaction.pointsEarned || 0}</p>
              <p><strong>Date:</strong> ${new Date(transaction.createdAt).toLocaleString()}</p>
            </div>
            <p>Thank you for your transaction!</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Scen2Reward. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getRedemptionTemplate(userName, redemption) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .redemption { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4CAF50; }
          .code { font-size: 24px; font-weight: bold; color: #4CAF50; text-align: center; padding: 10px; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Redemption Confirmation</h1>
          </div>
          <div class="content">
            <p>Hello ${userName},</p>
            <div class="redemption">
              <p><strong>Redemption Code:</strong></p>
              <div class="code">${redemption.redemptionCode}</div>
              <p><strong>Points Used:</strong> ${redemption.pointsUsed}</p>
              <p><strong>Status:</strong> ${redemption.status}</p>
            </div>
            <p>Please present this code at the pump to claim your reward.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Scen2Reward. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Strip HTML tags for plain text fallback
   */
  stripHTML(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Log email failure
   */
  async logFailure(to, subject, error) {
    // TODO: Store in database or logging service
    console.error('Email Failure Log:', {
      to,
      subject,
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

export const emailService = new EmailService();
