import { userRepository } from '../repositories/user.repository.js';
import { vehicleService } from './vehicle.service.js';
import { authService } from './auth.service.js';
import { ROLES } from '../constants/roles.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * Generate unique referral code for manager/staff (e.g. REF + 8 digits)
 */
function generateReferralCode() {
  const prefix = 'REF';
  const randomDigits = Math.floor(10000000 + Math.random() * 90000000).toString();
  return `${prefix}${randomDigits}`;
}

export const userService = {
  /**
   * Register user (self-registration with OTP verified)
   * Creates user + vehicle, returns userId, vehicleId, loyaltyId
   */
  async register(userData, vehicleData, referralCode = null) {
    // Check if mobile already exists
    const existing = await userRepository.findByMobile(userData.mobile);
    if (existing) {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'User with this mobile number already exists');
    }

    // Validate referral code if provided
    let referrer = null;
    if (referralCode) {
      referrer = await userRepository.findByReferralCode(referralCode);
      if (!referrer) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid referral code');
      }
      if (![ROLES.MANAGER, ROLES.STAFF].includes(referrer.role?.toLowerCase())) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Referral code is not valid for manager/staff');
      }
    }

    // Create user
    const user = await userRepository.create({
      ...userData,
      role: ROLES.USER,
      walletSummary: { totalEarned: 0, availablePoints: 0, redeemedPoints: 0, expiredPoints: 0 },
      status: 'active',
      mobileVerified: true,
    });

    // Create vehicle with loyaltyId
    const vehicle = await vehicleService.createVehicle({
      ...vehicleData,
      userId: user._id,
    });

    // TODO: Credit referral points to referrer if referralCode provided (via pointsService)

    return {
      userId: user._id,
      vehicleId: vehicle._id,
      loyaltyId: vehicle.loyaltyId,
      user: await userRepository.findById(user._id),
      vehicle,
    };
  },

  /**
   * Create user by Admin
   */
  async createUserByAdmin(userData, vehicleData, adminId) {
    const existing = await userRepository.findByMobile(userData.mobile);
    if (existing) {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'User with this mobile number already exists');
    }

    const user = await userRepository.create({
      ...userData,
      walletSummary: { totalEarned: 0, availablePoints: 0, redeemedPoints: 0, expiredPoints: 0 },
      status: 'active',
      createdBy: adminId,
    });

    let vehicle = null;
    if (vehicleData) {
      vehicle = await vehicleService.createVehicle({
        ...vehicleData,
        userId: user._id,
      });
    }

    return { user: await userRepository.findById(user._id), vehicle };
  },

  /**
   * Create user by Manager/Staff (at pump)
   * Credits registration points to operator
   */
  async createUserByManagerOrStaff(userData, vehicleData, operatorId, operatorRole) {
    const existing = await userRepository.findByMobile(userData.mobile);
    if (existing) {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'User with this mobile number already exists');
    }

    const user = await userRepository.create({
      ...userData,
      walletSummary: { totalEarned: 0, availablePoints: 0, redeemedPoints: 0, expiredPoints: 0 },
      status: 'active',
      createdBy: operatorId,
    });

    let vehicle = null;
    if (vehicleData) {
      vehicle = await vehicleService.createVehicle({
        ...vehicleData,
        userId: user._id,
      });
    }

    // TODO: Credit registration points to operator (via pointsService/SystemConfig)

    return { user: await userRepository.findById(user._id), vehicle };
  },

  /**
   * Generate referral code for manager/staff
   */
  async generateReferralCode(userId) {
    let code;
    let exists = true;
    while (exists) {
      code = generateReferralCode();
      const existing = await userRepository.findByReferralCode(code);
      exists = !!existing;
    }
    await userRepository.update(userId, { referralCode: code });
    return code;
  },
};
