import axios from "axios";
import { config } from "../config/index.js";

// SMS_MODE: 'demo' to skip actual SMS sending & log to console, 'dlt' to send actual DLT SMS
const SMS_MODE = "dlt";

const SMS_BASE_URL = config.sms.baseUrl;
const SMS_API_KEY = config.sms.apiKey;
const SENDER_ID = config.sms.senderId;
const TEMPLATE_ID = config.sms.templateId;

/**
 * Send SMS via DLT provider (e.g. Edumarc). Used by sendOtp.
 * Message must match your DLT-approved template; OTP is inserted in the message.
 */
export const sendSMS = async ({ number, message, senderId = SENDER_ID, templateId = TEMPLATE_ID }) => {
  if (!number || !message) {
    throw new Error("Number and message are required for SMS");
  }
  if (!SMS_API_KEY) {
    console.warn("SMS_API_KEY is not set in .env – SMS will not be sent");
    return { ok: false, reason: "SMS not configured" };
  }

  // API expects number as array of strings (per Combirds/Edumarc doc)
  const numberList = Array.isArray(number)
    ? number.map((n) => String(n).trim())
    : [String(number).trim()];

  //for local mode we are bypassing the sms
  if (SMS_MODE === "demo") {
    console.log(
      `[SMS-DEMO] (Bypassed in demo mode) Simulated SMS to ${numberList.join(
        ", "
      )}: "${message}"`
    );
    return {
      success: true,
      data: {
        msg: "SMS Simulated in Demo Mode",
        transactionId: `simulated-${Date.now()}`,
      },
    };
  }

  const payload = {
    message,
    senderId: senderId || SENDER_ID,
    number: numberList,
    templateId: templateId || TEMPLATE_ID,
  };

  try {
    const response = await axios.post(SMS_BASE_URL, payload, {
      headers: {
        "Content-Type": "application/json",
        apikey: SMS_API_KEY,
      },
    });
    return response.data;
  } catch (error) {
    console.error(
      "SMS Provider Error:",
      error.response?.data || error.message
    );
    throw new Error("Failed to send SMS");
  }
};

/**
 * Default OTP message (Edumarc default OTP template ).
 * Override with SMS_OTP_MESSAGE in .env. Use {{otp}} or {#var#} for OTP placeholder.
 */
const DEFAULT_OTP_MESSAGE =
  "Your login OTP for Yashas Shreya Petroleum is {#var#}. Please do not share it with anyone.";

/**
 * Send OTP SMS. Builds DLT-compliant message and calls sendSMS.
 * Replaces {{otp}}, ${otp}, and {#var#} with the actual OTP.
 */
export const sendOtpSMS = async ({ number, otp }) => {
  const template = config.sms.otpMessage || DEFAULT_OTP_MESSAGE;
  const message = template
    .replace(/\{\{otp\}\}/g, otp)
    .replace(/\$\{otp\}/g, otp)
    .replace(/\{\#var\#\}/g, otp);
  return sendSMS({ number, message });
};
