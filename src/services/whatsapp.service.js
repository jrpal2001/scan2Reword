import axios from 'axios';
import { config } from '../config/index.js';

const DEFAULT_USER_NAME = 'Customer';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTemplateParams(templateParams = []) {
  if (!Array.isArray(templateParams)) return [];
  return templateParams.map((value) => (value == null ? '' : String(value)));
}

function normalizeDestination(mobile, defaultCountryCode = '91') {
  if (mobile == null) return null;

  let value = String(mobile).trim();
  if (!value) return null;

  value = value.replace(/\s+/g, '');
  if (value.startsWith('00')) value = `+${value.slice(2)}`;

  if (value.startsWith('+')) {
    const digits = value.slice(1).replace(/\D/g, '');
    return digits.length >= 10 ? `+${digits}` : null;
  }

  const digitsOnly = value.replace(/\D/g, '');
  if (digitsOnly.length === 10) return `+${defaultCountryCode}${digitsOnly}`;
  if (digitsOnly.length > 10) return `+${digitsOnly}`;
  return null;
}

function shouldRetry(error) {
  const status = error?.response?.status;
  if (!status) return true;
  return status === 429 || status >= 500;
}

export const whatsappService = {
  isConfigured() {
    return Boolean(
      config.whatsapp?.enabled &&
      config.whatsapp?.apiKey &&
      config.whatsapp?.campaignName &&
      config.whatsapp?.baseUrl
    );
  },

  async _sendWithRetry({ destination, userName, templateParams }) {
    const maxRetries = Math.max(1, config.whatsapp?.maxRetries || 3);
    let attempt = 0;
    let lastError = null;

    while (attempt < maxRetries) {
      attempt += 1;
      try {
        const payload = {
          apiKey: config.whatsapp.apiKey,
          campaignName: config.whatsapp.campaignName,
          destination,
          userName: userName || DEFAULT_USER_NAME,
          templateParams: normalizeTemplateParams(templateParams),
        };

        const response = await axios.post(config.whatsapp.baseUrl, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
        });

        return {
          success: true,
          status: response.status,
          attempts: attempt,
          data: response.data,
        };
      } catch (error) {
        lastError = error;
        if (attempt >= maxRetries || !shouldRetry(error)) break;
        await sleep(500 * (2 ** (attempt - 1)));
      }
    }

    const status = lastError?.response?.status || null;
    const responseData = lastError?.response?.data;
    const providerMessage = responseData?.errorMessage
      || responseData?.message
      || responseData?.error
      || (typeof responseData === 'string' ? responseData : null);
    const errorMessage = providerMessage || lastError?.message || 'Failed to send WhatsApp campaign message';
    return {
      success: false,
      status,
      attempts: attempt,
      error: errorMessage,
    };
  },

  /**
   * Send WhatsApp campaign message to multiple users.
   * Expects users as [{ _id, fullName, mobile }].
   */
  async sendCampaignBroadcast(users = [], templateParams = []) {
    const normalizedParams = normalizeTemplateParams(templateParams);
    const summary = {
      attempted: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      results: [],
    };

    if (!Array.isArray(users) || users.length === 0) return summary;

    if (!this.isConfigured()) {
      console.warn('[WhatsApp] Not configured. Skipping campaign broadcast.');
      summary.skipped = users.length;
      return summary;
    }

    const seenDestinations = new Set();
    const queue = [];

    for (const user of users) {
      const destination = normalizeDestination(user?.mobile, config.whatsapp.defaultCountryCode || '91');
      if (!destination) {
        summary.skipped += 1;
        summary.results.push({
          userId: user?._id ? String(user._id) : null,
          success: false,
          skipped: true,
          error: 'Invalid mobile number',
        });
        continue;
      }
      if (seenDestinations.has(destination)) {
        summary.skipped += 1;
        summary.results.push({
          userId: user?._id ? String(user._id) : null,
          destination,
          success: false,
          skipped: true,
          error: 'Duplicate destination',
        });
        continue;
      }
      seenDestinations.add(destination);
      queue.push({
        userId: user?._id ? String(user._id) : null,
        destination,
        userName: user?.fullName ? String(user.fullName) : DEFAULT_USER_NAME,
      });
    }

    summary.attempted = queue.length;
    if (queue.length === 0) return summary;

    const concurrency = Math.min(
      queue.length,
      Math.max(1, config.whatsapp?.sendConcurrency || 10)
    );
    let cursor = 0;
    let hardStop = false;
    let hardStopLogged = false;

    const getNext = () => {
      if (hardStop) return null;
      if (cursor >= queue.length) return null;
      const item = queue[cursor];
      cursor += 1;
      return item;
    };

    const runWorker = async () => {
      while (true) {
        const target = getNext();
        if (!target) return;

        const result = await this._sendWithRetry({
          destination: target.destination,
          userName: target.userName,
          templateParams: normalizedParams,
        });

        if (result.success) summary.sent += 1;
        else {
          summary.failed += 1;
          if (result.status === 401 || result.status === 402) {
            hardStop = true;
            if (!hardStopLogged) {
              hardStopLogged = true;
              if (result.status === 402) {
                console.warn('[WhatsApp] Provider returned 402: Insufficient WhatsApp Conversation Credits (WCC). Stopping remaining campaign sends.');
              } else {
                console.warn('[WhatsApp] Unauthorized (401). Stopping remaining campaign sends. Check WHATSAPP_API_KEY and campaign access.');
              }
            }
          }
        }

        summary.results.push({
          userId: target.userId,
          destination: target.destination,
          ...result,
        });
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => runWorker()));
    if (hardStop) {
      const processedCount = summary.sent + summary.failed;
      const remaining = Math.max(0, queue.length - processedCount);
      summary.skipped += remaining;
    }
    return summary;
  },
};
