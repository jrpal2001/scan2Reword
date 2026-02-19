import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Otp from '../models/Otp.model.js';
import { userRepository } from '../repositories/user.repository.js';
import { config } from '../config/index.js';
import { ROLES, STAFF_ROLES } from '../constants/roles.js';
import ApiError from '../utils/ApiError.js';
import { ERROR_CODES, HTTP_STATUS } from '../constants/errorCodes.js';
import { smsService } from './sms.service.js';

const SALT_ROUNDS = 10;

/** Generate numeric OTP of given length */
function generateOtp(length = config.otp?.length || 6) {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

/** Send OTP via SMS using DLT provider */
async function sendOtpSms(mobile, otp) {
  try {
    await smsService.sendOTP(mobile, otp);
    if (config.nodeEnv !== 'production') {
      console.log(`[SMS] OTP sent to ${mobile}: ${otp}`);
    }
    return true;
  } catch (error) {
    // Log error but don't fail the request if SMS fails
    console.error(`Failed to send OTP SMS to ${mobile}:`, error.message);
    // In production, you might want to still throw or handle differently
    if (config.nodeEnv === 'production') {
      throw error;
    }
    return false;
  }
}

export const authService = {
  async sendOtp(mobile, purpose = 'register') {
    if (!mobile || !String(mobile).trim()) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Mobile number is required', null, ERROR_CODES.BAD_REQUEST);
    }
    const trimmed = String(mobile).trim();
    const otp = generateOtp();
    const expiryMinutes = config.otp?.expiryMinutes || 10;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
    await Otp.create({ mobile: trimmed, otp, purpose, expiresAt });
    await sendOtpSms(trimmed, otp);
    return { message: 'OTP sent successfully' };
  },

  async verifyOtp(mobile, otp, purpose = 'register') {
    if (!mobile || !otp) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Mobile and OTP are required', null, ERROR_CODES.BAD_REQUEST);
    }
    const trimmed = String(mobile).trim();
    const record = await Otp.findOne({ mobile: trimmed, purpose, used: false }).sort({ createdAt: -1 });
    if (!record) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'OTP not found or expired', null, ERROR_CODES.OTP_INVALID);
    }
    if (new Date() > record.expiresAt) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'OTP expired', null, ERROR_CODES.OTP_EXPIRED);
    }
    if (record.otp !== String(otp).trim()) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid OTP', null, ERROR_CODES.OTP_INVALID);
    }
    await Otp.findByIdAndUpdate(record._id, { used: true });
    const user = await userRepository.findByMobile(trimmed);
    if (user) {
      const accessToken = this.issueJwt(user);
      const refreshToken = this.issueRefreshToken(user);
      return { 
        user: { _id: user._id, fullName: user.fullName, mobile: user.mobile, role: user.role }, 
        token: accessToken,
        refreshToken 
      };
    }
    return { user: null, token: null, refreshToken: null };
  },

  async loginWithPassword(identifier, password) {
    if (!identifier || !password) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Identifier and password are required', null, ERROR_CODES.BAD_REQUEST);
    }
    const user = await userRepository.findByIdentifier(identifier);
    if (!user) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid identifier or password', null, ERROR_CODES.INVALID_CREDENTIALS);
    }
    if (!user.passwordHash) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Password not set for this account', null, ERROR_CODES.INVALID_CREDENTIALS);
    }
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid identifier or password', null, ERROR_CODES.INVALID_CREDENTIALS);
    }
    const role = (user.role || '').toLowerCase();
    if (!STAFF_ROLES.includes(role)) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Use OTP login for customer accounts', null, ERROR_CODES.FORBIDDEN);
    }
    const accessToken = this.issueJwt(user);
    const refreshToken = this.issueRefreshToken(user);
    const userSafe = await userRepository.findById(user._id);
    return { user: userSafe, token: accessToken, refreshToken };
  },

  issueJwt(user) {
    const payload = {
      _id: user._id,
      role: (user.role || ROLES.USER).toLowerCase(),
      mobile: user.mobile,
    };
    const secret = config.jwt.accessSecret;
    const expiresIn = config.jwt.accessExpiry;
    return jwt.sign(payload, secret, { expiresIn });
  },

  issueRefreshToken(user) {
    const payload = {
      _id: user._id,
      type: 'refresh',
    };
    const secret = config.jwt.refreshSecret;
    const expiresIn = config.jwt.refreshExpiry;
    return jwt.sign(payload, secret, { expiresIn });
  },

  async refreshToken(refreshToken) {
    if (!refreshToken) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Refresh token is required', null, ERROR_CODES.BAD_REQUEST);
    }

    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
      
      if (decoded.type !== 'refresh') {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid token type', null, ERROR_CODES.INVALID_CREDENTIALS);
      }

      const user = await userRepository.findById(decoded._id);
      if (!user) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'User not found', null, ERROR_CODES.INVALID_CREDENTIALS);
      }

      if (user.status !== 'active') {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'User account is not active', null, ERROR_CODES.FORBIDDEN);
      }

      // Issue new access token
      const newAccessToken = this.issueJwt(user);
      const newRefreshToken = this.issueRefreshToken(user);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: await userRepository.findById(user._id),
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error.name === 'TokenExpiredError') {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Refresh token expired', null, ERROR_CODES.INVALID_CREDENTIALS);
      }
      if (error.name === 'JsonWebTokenError') {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid refresh token', null, ERROR_CODES.INVALID_CREDENTIALS);
      }
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Token refresh failed', null, ERROR_CODES.INTERNAL_ERROR);
    }
  },

  async hashPassword(plain) {
    return bcrypt.hash(plain, SALT_ROUNDS);
  },
};
