import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Otp from '../models/Otp.model.js';
import Admin from '../models/Admin.js';
import { userRepository } from '../repositories/user.repository.js';
import { refreshTokenRepository } from '../repositories/refreshToken.repository.js';
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

  async verifyOtp(mobile, otp, purpose = 'register', fcmToken = null, deviceInfo = null, ipAddress = null, userAgent = null) {
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
      
      // Store refresh token in MongoDB and handle FCM token
      await this.storeRefreshToken(user._id, refreshToken, fcmToken, deviceInfo, ipAddress, userAgent);
      
      return { 
        user: { _id: user._id, fullName: user.fullName, mobile: user.mobile, role: user.role }, 
        token: accessToken,
        refreshToken 
      };
    }
    return { user: null, token: null, refreshToken: null };
  },

  async loginWithPassword(identifier, password, fcmToken = null, deviceInfo = null, ipAddress = null, userAgent = null) {
    if (!identifier || !password) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Identifier and password are required', null, ERROR_CODES.BAD_REQUEST);
    }
    
    // First try UserLoyalty model (new system)
    let user = await userRepository.findByIdentifier(identifier);
    let isLegacyAdmin = false;
    
    // If not found, try legacy Admin model
    if (!user) {
      const trimmed = identifier.trim();
      const admin = await Admin.findOne({
        $or: [
          { email: trimmed.toLowerCase() },
          { phone: trimmed },
        ]
      });
      
      if (admin) {
        // Check password for legacy admin
        const isMatch = await admin.comparePassword(password);
        if (!isMatch) {
          throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid identifier or password', null, ERROR_CODES.INVALID_CREDENTIALS);
        }
        
        // Convert legacy Admin to user-like object for compatibility
        user = {
          _id: admin._id,
          fullName: admin.name,
          mobile: admin.phone,
          email: admin.email,
          role: ROLES.ADMIN,
          passwordHash: admin.password, // For compatibility
          status: 'active',
        };
        isLegacyAdmin = true;
      }
    }
    
    if (!user) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid identifier or password', null, ERROR_CODES.INVALID_CREDENTIALS);
    }
    
    // For UserLoyalty model, check password
    if (!isLegacyAdmin) {
      if (!user.passwordHash) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Password not set for this account', null, ERROR_CODES.INVALID_CREDENTIALS);
      }
      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid identifier or password', null, ERROR_CODES.INVALID_CREDENTIALS);
      }
    }
    
    const role = (user.role || '').toLowerCase();
    if (!STAFF_ROLES.includes(role)) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Use OTP login for customer accounts', null, ERROR_CODES.FORBIDDEN);
    }
    
    // Issue JWT - for legacy admin, include userType for backward compatibility
    const accessToken = isLegacyAdmin 
      ? this.issueJwtForLegacyAdmin(user)
      : this.issueJwt(user);
    const refreshToken = this.issueRefreshToken(user);
    
    // Store refresh token in MongoDB and handle FCM token
    await this.storeRefreshToken(user._id, refreshToken, fcmToken, deviceInfo, ipAddress, userAgent);
    
    // Return user data
    let userSafe;
    if (isLegacyAdmin) {
      // Return legacy admin data
      userSafe = {
        _id: user._id,
        fullName: user.fullName,
        mobile: user.mobile,
        email: user.email,
        role: user.role,
        status: user.status,
      };
    } else {
      userSafe = await userRepository.findById(user._id);
    }
    
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

  issueJwtForLegacyAdmin(admin) {
    // Legacy admin token format (for backward compatibility with verifyJWT middleware)
    const payload = {
      _id: admin._id,
      userType: 'Admin', // Legacy format
      role: ROLES.ADMIN, // Also include role for new system compatibility
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

  async refreshToken(refreshTokenString) {
    if (!refreshTokenString) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Refresh token is required', null, ERROR_CODES.BAD_REQUEST);
    }

    let decoded;
    let storedToken = null;

    try {
      // First verify JWT signature
      decoded = jwt.verify(refreshTokenString, config.jwt.refreshSecret);
      
      if (decoded.type !== 'refresh') {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid token type', null, ERROR_CODES.INVALID_CREDENTIALS);
      }

      // Check if token exists in MongoDB (including revoked ones to identify device)
      storedToken = await refreshTokenRepository.findByTokenIncludeRevoked(refreshTokenString);
      
      if (!storedToken) {
        // Token not found in MongoDB - logout from that device if we can identify it
        // Try to decode to get userId, then logout from all devices for that user
        // But wait - we can't identify which device without the token in DB
        // So we'll just throw error - can't logout from unknown device
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Refresh token not found. Please login again.', null, ERROR_CODES.INVALID_CREDENTIALS);
      }

      // If token is revoked, logout from that device
      if (storedToken.revoked) {
        // Logout from the device associated with this token
        if (storedToken.fcmToken) {
          await this.logout(storedToken.userId, null, storedToken.fcmToken);
        } else {
          // If no FCM token, just revoke this specific token (already revoked)
          await refreshTokenRepository.revokeByToken(refreshTokenString);
        }
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Refresh token has been revoked. Device logged out.', null, ERROR_CODES.INVALID_CREDENTIALS);
      }

      // Check if token is expired (MongoDB TTL should handle this, but double-check)
      if (new Date() > new Date(storedToken.expiresAt)) {
        // Token expired - logout from that device
        if (storedToken.fcmToken) {
          await this.logout(storedToken.userId, null, storedToken.fcmToken);
        }
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Refresh token expired. Device logged out.', null, ERROR_CODES.INVALID_CREDENTIALS);
      }

      const user = await userRepository.findById(decoded._id);
      if (!user) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'User not found', null, ERROR_CODES.INVALID_CREDENTIALS);
      }

      if (user.status !== 'active') {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'User account is not active', null, ERROR_CODES.FORBIDDEN);
      }

      // Revoke old refresh token
      await refreshTokenRepository.revokeByToken(refreshTokenString);

      // Issue new tokens
      const newAccessToken = this.issueJwt(user);
      const newRefreshToken = this.issueRefreshToken(user);

      // Store new refresh token in MongoDB
      await this.storeRefreshToken(
        user._id,
        newRefreshToken,
        storedToken.fcmToken, // Preserve FCM token
        storedToken.deviceInfo, // Preserve device info
        storedToken.ipAddress, // Preserve IP
        storedToken.userAgent // Preserve user agent
      );

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
        // JWT expired - try to find token in DB to logout from device
        try {
          if (!storedToken && decoded?._id) {
            // Try to find any token with this signature pattern (unlikely but try)
            const foundToken = await refreshTokenRepository.findByTokenIncludeRevoked(refreshTokenString);
            if (foundToken && foundToken.fcmToken) {
              await this.logout(foundToken.userId, null, foundToken.fcmToken);
            }
          }
        } catch (logoutError) {
          console.error('Failed to logout device on token expiry:', logoutError.message);
        }
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Refresh token expired. Device logged out.', null, ERROR_CODES.INVALID_CREDENTIALS);
      }
      if (error.name === 'JsonWebTokenError') {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid refresh token', null, ERROR_CODES.INVALID_CREDENTIALS);
      }
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Token refresh failed', null, ERROR_CODES.INTERNAL_ERROR);
    }
  },

  /**
   * Store refresh token in MongoDB
   */
  async storeRefreshToken(userId, refreshToken, fcmToken = null, deviceInfo = null, ipAddress = null, userAgent = null) {
    try {
      // Decode token to get expiry
      const decoded = jwt.decode(refreshToken);
      const expiresAt = decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days

      // Store refresh token
      await refreshTokenRepository.create({
        userId,
        token: refreshToken,
        fcmToken: fcmToken || null,
        deviceInfo: deviceInfo || {},
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        expiresAt,
        revoked: false,
      });

      // Update user's FCM tokens array if FCM token provided
      if (fcmToken) {
        const user = await userRepository.findById(userId);
        if (user) {
          const tokens = user.FcmTokens || [];
          if (!tokens.includes(fcmToken)) {
            await userRepository.update(userId, {
              FcmTokens: [...tokens, fcmToken],
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to store refresh token:', error.message);
      // Don't throw - token generation should still succeed
    }
  },

  /**
   * Logout - revoke refresh token and remove FCM token
   * 
   * Priority:
   * 1. If fcmToken provided: Revoke all tokens for that device and remove FCM token (device-specific logout)
   * 2. If refreshToken provided (but no fcmToken): Revoke that specific token
   * 3. If neither provided: Revoke all tokens for the user (logout from all devices)
   */
  async logout(userId, refreshTokenString = null, fcmToken = null) {
    if (fcmToken) {
      // Device-specific logout: Revoke all refresh tokens for this FCM token
      await refreshTokenRepository.revokeByFcmToken(userId, fcmToken);
      
      // Remove FCM token from user's array
      const user = await userRepository.findById(userId);
      if (user && user.FcmTokens) {
        const tokens = user.FcmTokens.filter(t => t !== fcmToken);
        await userRepository.update(userId, { FcmTokens: tokens });
      }
    } else if (refreshTokenString) {
      // Revoke the specific refresh token (if no FCM token provided)
      await refreshTokenRepository.revokeByToken(refreshTokenString);
    } else {
      // Logout from all devices: Revoke all active refresh tokens for the user
      await refreshTokenRepository.revokeAllUserTokens(userId);
      
      // Clear all FCM tokens
      await userRepository.update(userId, { FcmTokens: [] });
    }

    return { message: 'Logged out successfully' };
  },

  async hashPassword(plain) {
    return bcrypt.hash(plain, SALT_ROUNDS);
  },
};
