import { userRepository } from '../repositories/user.repository.js';
import { vehicleService } from './vehicle.service.js';
import { authService } from './auth.service.js';
import { pointsService } from './points.service.js';
import { systemConfigService } from './systemConfig.service.js';
import { staffAssignmentService } from './staffAssignment.service.js';
import { pumpRepository } from '../repositories/pump.repository.js';
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

/**
 * Generate unique manager code (e.g. MGR001, MGR002, ...)
 */
async function generateUniqueManagerCode() {
  let code;
  let exists = true;
  let n = 1;
  while (exists) {
    code = `MGR${String(n).padStart(4, '0')}`;
    const existing = await userRepository.findByManagerCode(code);
    exists = !!existing;
    n++;
  }
  return code;
}

/**
 * Generate unique staff code (e.g. STF001, STF002, ...)
 */
async function generateUniqueStaffCode() {
  let code;
  let exists = true;
  let n = 1;
  while (exists) {
    code = `STF${String(n).padStart(4, '0')}`;
    const existing = await userRepository.findByStaffCode(code);
    exists = !!existing;
    n++;
  }
  return code;
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
      address,
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
      address: address || null,
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

    // When role is staff, validate assignedManagerId is a manager
    const role = (userData.role || '').toLowerCase();
    if (role === ROLES.STAFF && userData.assignedManagerId) {
      const manager = await userRepository.findById(userData.assignedManagerId);
      if (!manager || (manager.role || '').toLowerCase() !== ROLES.MANAGER) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'assignedManagerId must be a valid manager');
      }
    }

    // Hash password if provided (required for manager/staff)
    let passwordHash = null;
    if (userData.password) {
      passwordHash = await authService.hashPassword(userData.password);
    }

    // Auto-generate referral code for manager/staff roles
    let referralCode = userData.referralCode || null;
    if ([ROLES.MANAGER, ROLES.STAFF].includes(role)) {
      if (!referralCode) {
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

    // Auto-generate managerCode for managers (if not provided)
    let managerCode = role === ROLES.MANAGER ? (userData.managerCode?.trim() || null) : null;
    if (role === ROLES.MANAGER && !managerCode) {
      managerCode = await generateUniqueManagerCode();
    }

    // Auto-generate staffCode for staff (if not provided)
    let staffCode = role === ROLES.STAFF ? (userData.staffCode?.trim() || null) : null;
    if (role === ROLES.STAFF && !staffCode) {
      staffCode = await generateUniqueStaffCode();
    }

    // Remove password from userData (we use passwordHash instead)
    const { password, ...userDataWithoutPassword } = userData;

    const user = await userRepository.create({
      ...userDataWithoutPassword,
      passwordHash,
      referralCode,
      address: userData.address || null,
      profilePhoto: userData.profilePhoto || null,
      managerCode: role === ROLES.MANAGER ? managerCode : null,
      staffCode: role === ROLES.STAFF ? staffCode : null,
      assignedManagerId: role === ROLES.STAFF ? (userData.assignedManagerId || null) : null,
      walletSummary: { totalEarned: 0, availablePoints: 0, redeemedPoints: 0, expiredPoints: 0 },
      status: 'active',
      createdBy: adminId,
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

    // If staff and pumpId provided, assign staff to pump (admin can assign to any pump)
    let assignment = null;
    if (role === ROLES.STAFF && userData.pumpId) {
      try {
        assignment = await staffAssignmentService.assignStaffToPump(user._id, userData.pumpId, adminId);
      } catch (error) {
        console.error('Failed to assign staff to pump during creation:', error.message);
        // Don't fail user creation if assignment fails - they can be assigned later
      }
    }

    return { 
      user: await userRepository.findById(user._id), 
      vehicle,
      assignment: assignment || null,
    };
  },

  /**
   * Create user by Manager/Staff (at pump)
   * Manager can create staff or user, Staff can only create user
   * Credits registration points to operator (only for regular users, not staff)
   * Auto-generates referral code for staff created by manager
   */
  async createUserByManagerOrStaff(userData, vehicleData, operatorId, operatorRole) {
    const existing = await userRepository.findByMobile(userData.mobile);
    if (existing) {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'User with this mobile number already exists');
    }

    // Validate: Staff cannot create staff, only managers can
    const userRole = (userData.role || ROLES.USER).toLowerCase();
    if (userRole === ROLES.STAFF && operatorRole !== ROLES.MANAGER) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Only managers can create staff members');
    }

    // When creating staff, validate assignedManagerId is a manager (if provided)
    if (userRole === ROLES.STAFF && userData.assignedManagerId) {
      const manager = await userRepository.findById(userData.assignedManagerId);
      if (!manager || (manager.role || '').toLowerCase() !== ROLES.MANAGER) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'assignedManagerId must be a valid manager');
      }
    }

    // Hash password if provided (required for staff)
    let passwordHash = null;
    if (userData.password) {
      passwordHash = await authService.hashPassword(userData.password);
    }

    // Auto-generate referral code for staff created by manager
    let referralCode = userData.referralCode || null;
    if (userRole === ROLES.STAFF) {
      let code;
      let exists = true;
      while (exists) {
        code = generateReferralCode();
        const existing = await userRepository.findByReferralCode(code);
        exists = !!existing;
      }
      referralCode = code;
    }

    // Auto-generate staffCode for staff (if not provided)
    let staffCode = userRole === ROLES.STAFF ? (userData.staffCode?.trim() || null) : null;
    if (userRole === ROLES.STAFF && !staffCode) {
      staffCode = await generateUniqueStaffCode();
    }

    // Remove password from userData (we use passwordHash instead)
    const { password, ...userDataWithoutPassword } = userData;

    // When manager creates staff, automatically set assignedManagerId to manager's ID
    let finalAssignedManagerId = userRole === ROLES.STAFF ? (userData.assignedManagerId || null) : null;
    if (userRole === ROLES.STAFF && operatorRole === ROLES.MANAGER && !finalAssignedManagerId) {
      finalAssignedManagerId = operatorId; // Auto-assign to creating manager
    }

    const user = await userRepository.create({
      ...userDataWithoutPassword,
      role: userRole,
      passwordHash,
      referralCode,
      address: userData.address || null,
      profilePhoto: userData.profilePhoto || null,
      staffCode: userRole === ROLES.STAFF ? staffCode : null,
      assignedManagerId: finalAssignedManagerId,
      walletSummary: { totalEarned: 0, availablePoints: 0, redeemedPoints: 0, expiredPoints: 0 },
      status: 'active',
      createdBy: operatorId,
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

    // Credit registration points to operator (manager/staff) - only for regular users, not staff
    if (userRole === ROLES.USER) {
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
    }

    // If manager creates staff, automatically assign to manager's pump (ONE pump only)
    let assignment = null;
    if (userRole === ROLES.STAFF && operatorRole === ROLES.MANAGER) {
      if (userData.pumpId) {
        // If specific pumpId provided, validate it belongs to manager and assign
        const pump = await pumpRepository.findById(userData.pumpId);
        if (!pump) {
          throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Pump not found');
        }
        if (pump.managerId?.toString() !== operatorId.toString()) {
          throw new ApiError(HTTP_STATUS.FORBIDDEN, 'You can only assign staff to pumps you manage');
        }
        
        try {
          assignment = await staffAssignmentService.assignStaffToPump(user._id, userData.pumpId, operatorId);
        } catch (error) {
          console.error('Failed to assign staff to specified pump during creation:', error.message);
          // Don't fail user creation if assignment fails - they can be assigned later
        }
      } else {
        // No pumpId provided - automatically assign to manager's pump (only ONE pump)
        try {
          const managerPumpIds = await pumpRepository.findPumpIdsByManagerId(operatorId);
          if (managerPumpIds.length > 0) {
            // RESTRICTION: Assign to only the first pump (manager should have only one)
            const pumpId = managerPumpIds[0];
            try {
              assignment = await staffAssignmentService.assignStaffToPump(user._id, pumpId, operatorId);
            } catch (error) {
              console.error(`Failed to assign staff to pump ${pumpId} during creation:`, error.message);
              // Don't fail user creation if assignment fails - they can be assigned later
            }
          }
        } catch (error) {
          console.error('Failed to auto-assign staff to manager pump during creation:', error.message);
          // Don't fail user creation if assignment fails - they can be assigned later
        }
      }
    } else if (userRole === ROLES.STAFF && userData.pumpId) {
      // Admin creating staff with pumpId (no auto-assignment)
      try {
        assignment = await staffAssignmentService.assignStaffToPump(user._id, userData.pumpId, operatorId);
      } catch (error) {
        console.error('Failed to assign staff to pump during creation:', error.message);
        // Don't fail user creation if assignment fails - they can be assigned later
      }
    }

    return { 
      user: await userRepository.findById(user._id), 
      vehicle,
      assignment: assignment || null,
    };
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
    // Convert empty string assignedManagerId to null (so Mongoose doesn't cast error)
    if (safeUpdateData.assignedManagerId === '') {
      safeUpdateData.assignedManagerId = null;
    }
    
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
