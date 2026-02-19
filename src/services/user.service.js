import { userRepository } from '../repositories/user.repository.js';
import { vehicleService } from './vehicle.service.js';
import { authService } from './auth.service.js';
import { pointsService } from './points.service.js';
import { systemConfigService } from './systemConfig.service.js';
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
   * Supports Individual and Organization (Fleet) registration
   * Creates user + vehicle, returns userId, vehicleId, loyaltyId
   */
  async register(registrationData) {
    const {
      accountType,
      mobile,
      fullName,
      email,
      referralCode,
      vehicle,
      ownerType,
      ownerIdentifier,
      owner,
      profilePhoto,
      driverPhoto,
      ownerPhoto,
      rcPhoto,
    } = registrationData;

    // Check if mobile already exists
    const existing = await userRepository.findByMobile(mobile);
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

    let ownerId = null;

    // Handle Organization (Fleet) registration
    if (accountType === 'organization') {
      if (ownerType === 'registered') {
        // Search for existing owner by ID or phone
        const foundOwner = await userRepository.findByIdentifier(ownerIdentifier);
        if (!foundOwner) {
          throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Owner not found with the provided identifier');
        }
        // Verify owner is actually an owner (has role USER and no ownerId, or is a fleet owner)
        if (foundOwner.ownerId) {
          throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'The provided identifier belongs to a driver, not an owner');
        }
        ownerId = foundOwner._id;
      } else if (ownerType === 'non-registered') {
        // Create new owner
        const ownerMobile = owner.mobile;
        const existingOwner = await userRepository.findByMobile(ownerMobile);
        if (existingOwner) {
          throw new ApiError(HTTP_STATUS.CONFLICT, 'Owner with this mobile number already exists');
        }

        const newOwner = await userRepository.create({
          fullName: owner.fullName,
          mobile: ownerMobile,
          email: owner.email || null,
          role: ROLES.USER,
          walletSummary: { totalEarned: 0, availablePoints: 0, redeemedPoints: 0, expiredPoints: 0 },
          status: 'active',
          mobileVerified: true,
          address: owner.address || null,
          ownerId: null, // Owner has no owner
        });
        ownerId = newOwner._id;
      }
    }

    // Create user (driver)
    const user = await userRepository.create({
      fullName,
      mobile,
      email: email || null,
      role: ROLES.USER,
      walletSummary: { totalEarned: 0, availablePoints: 0, redeemedPoints: 0, expiredPoints: 0 },
      status: 'active',
      mobileVerified: true,
      profilePhoto: profilePhoto || null,
      driverPhoto: driverPhoto || null,
      ownerPhoto: ownerPhoto || null,
      ownerId: ownerId, // Link to owner if organization
    });

    // Create vehicle with loyaltyId
    const vehicleData = {
      ...vehicle,
      userId: user._id,
      rcPhoto: rcPhoto || null,
    };
    const vehicleCreated = await vehicleService.createVehicle(vehicleData);

    // Credit referral points to referrer if referralCode provided
    if (referrer && referrer._id) {
      try {
        const systemConfig = await systemConfigService.getConfig();
        const referralPoints = systemConfig.points?.referral || 0;
        
        if (referralPoints > 0) {
          await pointsService.creditPoints({
            userId: referrer._id,
            points: referralPoints,
            type: 'credit',
            reason: `Referral bonus - User ${user._id} registered with referral code`,
            createdBy: user._id,
          });
        }
      } catch (error) {
        console.error('Failed to credit referral points:', error.message);
        // Don't fail registration if referral points credit fails
      }
    }

    return {
      userId: user._id,
      vehicleId: vehicleCreated._id,
      loyaltyId: vehicleCreated.loyaltyId,
      user: await userRepository.findById(user._id),
      vehicle: vehicleCreated,
      ownerId: ownerId, // Return ownerId if organization
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

    // Auto-generate referral code for manager/staff roles
    let referralCode = userData.referralCode || null;
    if ([ROLES.MANAGER, ROLES.STAFF].includes(userData.role?.toLowerCase())) {
      if (!referralCode) {
        // Generate unique referral code
        let code;
        let exists = true;
        while (exists) {
          code = generateReferralCode();
          const existing = await userRepository.findByReferralCode(code);
          exists = !!existing;
        }
        referralCode = code;
      }
    }

    const user = await userRepository.create({
      ...userData,
      referralCode,
      walletSummary: { totalEarned: 0, availablePoints: 0, redeemedPoints: 0, expiredPoints: 0 },
      status: 'active',
      createdBy: adminId,
      profilePhoto: userData.profilePhoto || null,
      driverPhoto: userData.driverPhoto || null,
      ownerPhoto: userData.ownerPhoto || null,
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
      profilePhoto: userData.profilePhoto || null,
      driverPhoto: userData.driverPhoto || null,
      ownerPhoto: userData.ownerPhoto || null,
    });

    let vehicle = null;
    if (vehicleData) {
      vehicle = await vehicleService.createVehicle({
        ...vehicleData,
        userId: user._id,
      });
    }

    // Credit registration points to operator (manager/staff)
    try {
      const systemConfig = await systemConfigService.getConfig();
      const registrationPoints = systemConfig.points?.registration || 0;
      
      if (registrationPoints > 0) {
        await pointsService.creditPoints({
          userId: operatorId,
          points: registrationPoints,
          type: 'credit',
          reason: `Registration bonus - Created user ${user._id} (${user.fullName})`,
          createdBy: operatorId,
        });
      }
    } catch (error) {
      console.error('Failed to credit registration points:', error.message);
      // Don't fail user creation if registration points credit fails
    }

    return { user: await userRepository.findById(user._id), vehicle };
  },

  /**
   * Generate referral code for manager/staff
   */
  async generateReferralCode(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
    }
    
    if (![ROLES.MANAGER, ROLES.STAFF].includes(user.role?.toLowerCase())) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Referral codes are only available for managers and staff');
    }

    // If already has referral code, return it
    if (user.referralCode) {
      return user.referralCode;
    }

    // Generate unique referral code
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

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
    }
    return user;
  },

  /**
   * List users with filters (admin)
   */
  async listUsers(filter = {}, options = {}) {
    return userRepository.list(filter, options);
  },

  /**
   * Update user (admin)
   */
  async updateUser(userId, updateData, adminId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
    }

    // Don't allow updating passwordHash directly
    const { passwordHash, ...safeUpdateData } = updateData;
    
    const updated = await userRepository.update(userId, safeUpdateData);
    return updated;
  },

  /**
   * Block/unblock user (admin)
   */
  async updateUserStatus(userId, status, adminId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
    }

    const updated = await userRepository.update(userId, { status });
    return updated;
  },
};
