import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Otp from '../models/Otp.model.js';
import Admin from '../models/Admin.js';
import { userRepository } from '../repositories/user.repository.js';
import { managerRepository } from '../repositories/manager.repository.js';
import { staffRepository } from '../repositories/staff.repository.js';
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
    const otpTrimmed = String(otp).trim();

    // Static OTP for testing: 123456 always passes (no DB OTP record required)
    const isStaticTestOtp = otpTrimmed === '123456';
    if (!isStaticTestOtp) {
      const record = await Otp.findOne({ mobile: trimmed, purpose, used: false }).sort({ createdAt: -1 });
      if (!record) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'OTP not found or expired', null, ERROR_CODES.OTP_INVALID);
      }
      if (new Date() > record.expiresAt) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'OTP expired', null, ERROR_CODES.OTP_EXPIRED);
      }
      if (record.otp !== otpTrimmed) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid OTP', null, ERROR_CODES.OTP_INVALID);
      }
      await Otp.findByIdAndUpdate(record._id, { used: true });
    }

    const user = await userRepository.findByMobile(trimmed);
    if (user) {
      const userType = 'UserLoyalty';
      const accessToken = this.issueJwt(user, userType);
      const refreshToken = this.issueRefreshToken(user, userType);
      await this.storeRefreshToken(user._id, userType, refreshToken, fcmToken, deviceInfo, ipAddress, userAgent);
      return {
        user: {
          _id: user._id,
          fullName: user.fullName,
          mobile: user.mobile,
          role: ROLES.USER,
          userType: user.userType || 'individual',
          ownerId: user.ownerId || null,
        },
        token: accessToken,
        refreshToken,
        requiresPasswordSet: false,
        isManager: false,
        isStaff: false,
        isIndividualUser: user.userType === 'individual',
        isFleetOwner: user.userType === 'owner',
        isFleetDriver: user.userType === 'driver',
      };
    }

    // Manager/Staff: first-time login via OTP (no password set); later they use password
    const manager = await managerRepository.findByMobile(trimmed);
    if (manager) {
      const userType = 'Manager';
      const accessToken = this.issueJwt(manager, userType);
      const refreshToken = this.issueRefreshToken(manager, userType);
      await this.storeRefreshToken(manager._id, userType, refreshToken, fcmToken, deviceInfo, ipAddress, userAgent);
      const userSafe = await managerRepository.findById(manager._id);
      return {
        user: { ...userSafe, role: ROLES.MANAGER },
        token: accessToken,
        refreshToken,
        requiresPasswordSet: !manager.passwordHash,
        isManager: true,
        isStaff: false,
        isIndividualUser: false,
        isFleetOwner: false,
        isFleetDriver: false,
      };
    }

    const staff = await staffRepository.findByMobile(trimmed);
    if (staff) {
      const userType = 'Staff';
      const accessToken = this.issueJwt(staff, userType);
      const refreshToken = this.issueRefreshToken(staff, userType);
      await this.storeRefreshToken(staff._id, userType, refreshToken, fcmToken, deviceInfo, ipAddress, userAgent);
      const userSafe = await staffRepository.findById(staff._id);
      return {
        user: { ...userSafe, role: ROLES.STAFF },
        token: accessToken,
        refreshToken,
        requiresPasswordSet: !staff.passwordHash,
        isManager: false,
        isStaff: true,
        isIndividualUser: false,
        isFleetOwner: false,
        isFleetDriver: false,
      };
    }

    return {
      user: null,
      token: null,
      refreshToken: null,
      requiresPasswordSet: false,
      isManager: false,
      isStaff: false,
      isIndividualUser: false,
      isFleetOwner: false,
      isFleetDriver: false,
    };
  },

  /**
   * Check login by identifier only (no password). Used for first step of login flow.
   * Returns isAdmin (true => frontend calls verify-password every time), or
   * isAdmin: false with isManager, isStaff, isIndividualUser, isFleetOwner, isFleetDriver, requiresPasswordSet.
   */
  async checkLogin(identifier) {
    if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Identifier is required', null, ERROR_CODES.BAD_REQUEST);
    }
    const trimmed = identifier.trim();

    const admin = await Admin.findOne({
      $or: [{ email: trimmed.toLowerCase() }, { phone: trimmed }],
    });
    if (admin) {
      return { isAdmin: true };
    }

    const manager = await managerRepository.findByIdentifier(identifier);
    if (manager) {
      return {
        isAdmin: false,
        isManager: true,
        isStaff: false,
        isIndividualUser: false,
        isFleetOwner: false,
        isFleetDriver: false,
        requiresPasswordSet: !manager.passwordHash,
      };
    }

    const staff = await staffRepository.findByIdentifier(identifier);
    if (staff) {
      return {
        isAdmin: false,
        isManager: false,
        isStaff: true,
        isIndividualUser: false,
        isFleetOwner: false,
        isFleetDriver: false,
        requiresPasswordSet: !staff.passwordHash,
      };
    }

    const user = await userRepository.findByIdentifier(identifier);
    if (user) {
      return {
        isAdmin: false,
        isManager: false,
        isStaff: false,
        isIndividualUser: user.userType === 'individual',
        isFleetOwner: user.userType === 'owner',
        isFleetDriver: user.userType === 'driver',
        requiresPasswordSet: false,
      };
    }

    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Identifier not found', null, ERROR_CODES.NOT_FOUND);
  },

  async loginWithPassword(identifier, password, fcmToken = null, deviceInfo = null, ipAddress = null, userAgent = null) {
    if (!identifier || !password) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Identifier and password are required', null, ERROR_CODES.BAD_REQUEST);
    }

    // Try in order: Manager, Staff, Admin, User (UserLoyalty)
    let entity = await managerRepository.findByIdentifier(identifier);
    let userType = 'Manager';

    if (!entity) {
      entity = await staffRepository.findByIdentifier(identifier);
      userType = 'Staff';
    }
    if (!entity) {
      const trimmed = identifier.trim();
      const admin = await Admin.findOne({
        $or: [{ email: trimmed.toLowerCase() }, { phone: trimmed }],
      });
      if (admin) {
        const isMatch = await admin.comparePassword(password);
        if (!isMatch) {
          throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid identifier or password', null, ERROR_CODES.INVALID_CREDENTIALS);
        }
        entity = {
          _id: admin._id,
          fullName: admin.name,
          mobile: admin.phone,
          email: admin.email,
          role: ROLES.ADMIN,
          status: 'active',
        };
        userType = 'Admin';
      }
    }
    if (!entity) {
      entity = await userRepository.findByIdentifier(identifier);
      userType = 'UserLoyalty';
    }

    if (!entity) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid identifier or password', null, ERROR_CODES.INVALID_CREDENTIALS);
    }

    // Password check (Admin already checked above)
    if (userType !== 'Admin') {
      if (!entity.passwordHash) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Password not set. Please login with OTP first and set your password.', null, ERROR_CODES.INVALID_CREDENTIALS);
      }
      const match = await bcrypt.compare(password, entity.passwordHash);
      if (!match) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid identifier or password', null, ERROR_CODES.INVALID_CREDENTIALS);
      }
    }

    const role = userType === 'Admin' ? ROLES.ADMIN : userType === 'Manager' ? ROLES.MANAGER : userType === 'Staff' ? ROLES.STAFF : ROLES.USER;
    if (!STAFF_ROLES.includes(role)) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Use OTP login for customer accounts', null, ERROR_CODES.FORBIDDEN);
    }

    const accessToken = this.issueJwt(entity, userType);
    const refreshToken = this.issueRefreshToken(entity, userType);
    await this.storeRefreshToken(entity._id, userType, refreshToken, fcmToken, deviceInfo, ipAddress, userAgent);

    let userSafe;
    if (userType === 'Admin') {
      userSafe = { _id: entity._id, fullName: entity.fullName, mobile: entity.mobile, email: entity.email, role: entity.role, status: entity.status };
    } else if (userType === 'Manager') {
      userSafe = await managerRepository.findById(entity._id);
      userSafe = { ...userSafe, role: ROLES.MANAGER };
    } else if (userType === 'Staff') {
      userSafe = await staffRepository.findById(entity._id);
      userSafe = { ...userSafe, role: ROLES.STAFF };
    } else {
      userSafe = await userRepository.findById(entity._id);
      userSafe = { ...userSafe, role: ROLES.USER };
    }

    return { user: userSafe, token: accessToken, refreshToken };
  },

  issueJwt(user, userType = 'UserLoyalty') {
    const role = userType === 'Admin' ? ROLES.ADMIN : userType === 'Manager' ? ROLES.MANAGER : userType === 'Staff' ? ROLES.STAFF : ROLES.USER;
    const payload = {
      _id: user._id,
      userType,
      role: (user.role || role).toLowerCase(),
      mobile: user.mobile,
    };
    const secret = config.jwt.accessSecret;
    const expiresIn = config.jwt.accessExpiry;
    return jwt.sign(payload, secret, { expiresIn });
  },

  issueRefreshToken(user, userType = 'UserLoyalty') {
    const payload = {
      _id: user._id,
      type: 'refresh',
      userType: userType || 'UserLoyalty',
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
        if (storedToken.fcmToken) {
          await this.logout(storedToken.userId, null, storedToken.fcmToken, storedToken.userType);
        } else {
          // If no FCM token, just revoke this specific token (already revoked)
          await refreshTokenRepository.revokeByToken(refreshTokenString);
        }
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Refresh token has been revoked. Device logged out.', null, ERROR_CODES.INVALID_CREDENTIALS);
      }

      // Check if token is expired (MongoDB TTL should handle this, but double-check)
      if (new Date() > new Date(storedToken.expiresAt)) {
        if (storedToken.fcmToken) {
          await this.logout(storedToken.userId, null, storedToken.fcmToken, storedToken.userType);
        }
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Refresh token expired. Device logged out.', null, ERROR_CODES.INVALID_CREDENTIALS);
      }

      const userType = storedToken.userType || decoded.userType || 'UserLoyalty';
      let user = null;
      if (userType === 'Admin') {
        const admin = await Admin.findById(decoded._id);
        if (admin) user = { _id: admin._id, fullName: admin.name, mobile: admin.phone, email: admin.email, role: ROLES.ADMIN, status: 'active' };
      } else if (userType === 'Manager') {
        user = await managerRepository.findById(decoded._id);
      } else if (userType === 'Staff') {
        user = await staffRepository.findById(decoded._id);
      } else {
        user = await userRepository.findById(decoded._id);
      }

      if (!user) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'User not found', null, ERROR_CODES.INVALID_CREDENTIALS);
      }
      if (user.status && user.status !== 'active') {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'User account is not active', null, ERROR_CODES.FORBIDDEN);
      }

      await refreshTokenRepository.revokeByToken(refreshTokenString);

      const newAccessToken = this.issueJwt(user, userType);
      const newRefreshToken = this.issueRefreshToken(user, userType);
      await this.storeRefreshToken(
        user._id,
        userType,
        newRefreshToken,
        storedToken.fcmToken,
        storedToken.deviceInfo,
        storedToken.ipAddress,
        storedToken.userAgent
      );

      let userSafe;
      if (userType === 'Admin') {
        userSafe = { _id: user._id, fullName: user.fullName, mobile: user.mobile, email: user.email, role: ROLES.ADMIN };
      } else if (userType === 'Manager') {
        userSafe = { ...(await managerRepository.findById(user._id)), role: ROLES.MANAGER };
      } else if (userType === 'Staff') {
        userSafe = { ...(await staffRepository.findById(user._id)), role: ROLES.STAFF };
      } else {
        userSafe = await userRepository.findById(user._id);
      }

      return { accessToken: newAccessToken, refreshToken: newRefreshToken, user: userSafe };
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
              await this.logout(foundToken.userId, null, foundToken.fcmToken, foundToken.userType);
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
   * Store refresh token in MongoDB. userType: 'UserLoyalty' | 'Manager' | 'Staff' | 'Admin'
   */
  async storeRefreshToken(userId, userType, refreshToken, fcmToken = null, deviceInfo = null, ipAddress = null, userAgent = null) {
    try {
      const decoded = jwt.decode(refreshToken);
      const expiresAt = decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await refreshTokenRepository.create({
        userId,
        userType: userType || 'UserLoyalty',
        token: refreshToken,
        fcmToken: fcmToken || null,
        deviceInfo: deviceInfo || {},
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        expiresAt,
        revoked: false,
      });

      if (fcmToken && userType !== 'Admin') {
        let current = null;
        if (userType === 'UserLoyalty') current = await userRepository.findById(userId);
        else if (userType === 'Manager') current = await managerRepository.findById(userId);
        else if (userType === 'Staff') current = await staffRepository.findById(userId);
        if (current) {
          const tokens = current.FcmTokens || [];
          if (!tokens.includes(fcmToken)) {
            const update = { FcmTokens: [...tokens, fcmToken] };
            if (userType === 'UserLoyalty') await userRepository.update(userId, update);
            else if (userType === 'Manager') await managerRepository.update(userId, update);
            else if (userType === 'Staff') await staffRepository.update(userId, update);
          }
        }
      }
    } catch (error) {
      console.error('Failed to store refresh token:', error.message);
    }
  },

  /**
   * Logout - revoke refresh token and remove FCM token.
   * userType: 'UserLoyalty' | 'Manager' | 'Staff' | 'Admin' (optional; used when revoking by fcmToken or all devices)
   */
  async logout(userId, refreshTokenString = null, fcmToken = null, userType = null) {
    if (fcmToken) {
      await refreshTokenRepository.revokeByFcmToken(userId, fcmToken, userType);
      if (userType && userType !== 'Admin') {
        let current = null;
        if (userType === 'UserLoyalty') current = await userRepository.findById(userId);
        else if (userType === 'Manager') current = await managerRepository.findById(userId);
        else if (userType === 'Staff') current = await staffRepository.findById(userId);
        if (current && current.FcmTokens) {
          const tokens = current.FcmTokens.filter(t => t !== fcmToken);
          if (userType === 'UserLoyalty') await userRepository.update(userId, { FcmTokens: tokens });
          else if (userType === 'Manager') await managerRepository.update(userId, { FcmTokens: tokens });
          else if (userType === 'Staff') await staffRepository.update(userId, { FcmTokens: tokens });
        }
      }
    } else if (refreshTokenString) {
      await refreshTokenRepository.revokeByToken(refreshTokenString);
    } else {
      await refreshTokenRepository.revokeAllUserTokens(userId, userType);
      if (userType && userType !== 'Admin') {
        if (userType === 'UserLoyalty') await userRepository.update(userId, { FcmTokens: [] });
        else if (userType === 'Manager') await managerRepository.update(userId, { FcmTokens: [] });
        else if (userType === 'Staff') await staffRepository.update(userId, { FcmTokens: [] });
      }
    }
    return { message: 'Logged out successfully' };
  },

  async hashPassword(plain) {
    return bcrypt.hash(plain, SALT_ROUNDS);
  },

  /**
   * Set password for Manager/Staff (e.g. after first-time OTP login).
   * Allowed only when user is Manager or Staff.
   */
  async setPassword(userId, userType, newPassword) {
    if (!userId || !newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Password must be at least 6 characters', null, ERROR_CODES.BAD_REQUEST);
    }
    if (userType !== 'Manager' && userType !== 'Staff') {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Only Manager or Staff can set password via this endpoint', null, ERROR_CODES.FORBIDDEN);
    }
    const passwordHash = await this.hashPassword(newPassword);
    if (userType === 'Manager') {
      const manager = await managerRepository.findByIdWithPassword(userId);
      if (!manager) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Manager not found', null, ERROR_CODES.NOT_FOUND);
      await managerRepository.update(userId, { passwordHash });
    } else {
      const staff = await staffRepository.findByIdWithPassword(userId);
      if (!staff) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Staff not found', null, ERROR_CODES.NOT_FOUND);
      await staffRepository.update(userId, { passwordHash });
    }
    return { message: 'Password set successfully' };
  },
};
