import { userRepository } from '../repositories/user.repository.js';
import { managerRepository } from '../repositories/manager.repository.js';
import { staffRepository } from '../repositories/staff.repository.js';
import { vehicleService } from './vehicle.service.js';
import { authService } from './auth.service.js';
import { pointsService } from './points.service.js';
import { systemConfigService } from './systemConfig.service.js';
import { staffAssignmentService } from './staffAssignment.service.js';
import { pumpRepository } from '../repositories/pump.repository.js';
import { staffAssignmentRepository } from '../repositories/staffAssignment.repository.js';
import { vehicleRepository } from '../repositories/vehicle.repository.js';
import { ROLES } from '../constants/roles.js';
import { USER_TYPES } from '../models/User.model.js';
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
    const existing = await managerRepository.findByManagerCode(code);
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
    const existing = await staffRepository.findByStaffCode(code);
    exists = !!existing;
    n++;
  }
  return code;
}

/** Check referral code uniqueness across Manager, Staff, and User */
async function isReferralCodeTaken(code) {
  if (!code) return false;
  const [m, s, u] = await Promise.all([
    managerRepository.findByReferralCode(code),
    staffRepository.findByReferralCode(code),
    userRepository.findByReferralCode(code),
  ]);
  return !!(m || s || u);
}

/** Resolve referrer by referral code (Manager, Staff, or User). Returns { _id, _ownerType } plus doc. */
async function findReferrerByCode(referralCode) {
  if (!referralCode) return null;
  const manager = await managerRepository.findByReferralCode(referralCode);
  if (manager) return { ...manager, _ownerType: 'Manager' };
  const staff = await staffRepository.findByReferralCode(referralCode);
  if (staff) return { ...staff, _ownerType: 'Staff' };
  const user = await userRepository.findByReferralCode(referralCode);
  if (user) return { ...user, _ownerType: 'UserLoyalty' };
  return null;
}

/** Generate unique loyalty ID for fleet owner (LOY + 8 digits). Must be unique across Vehicle and User. */
async function generateOwnerLoyaltyId() {
  let loyaltyId;
  let exists = true;
  while (exists) {
    loyaltyId = `LOY${Math.floor(10000000 + Math.random() * 90000000).toString()}`;
    const [inVehicle, inUser] = await Promise.all([
      vehicleRepository.findByLoyaltyId(loyaltyId),
      userRepository.findByLoyaltyId(loyaltyId),
    ]);
    exists = !!(inVehicle || inUser);
  }
  return loyaltyId;
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
      registeredPumpId: registeredPumpIdInput,
      registeredPumpCode,
      address,
      vehicle,
      ownerType,
      ownerIdentifier,
      owner,
      profilePhoto,
      driverPhoto,
      ownerPhoto,
      rcPhoto,
      insurancePhoto,
      fitnessPhoto,
      pollutionPhoto,
      vehiclePhoto,
    } = registrationData;

    // Resolve pump to Mongo _id (store as registeredPumpId on user); keep pump doc for thank-you message
    let resolvedRegisteredPumpId = null;
    let resolvedPump = null;
    if (registeredPumpIdInput && String(registeredPumpIdInput).trim()) {
      const pump = await pumpRepository.findById(registeredPumpIdInput);
      if (!pump) throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid registeredPumpId');
      resolvedRegisteredPumpId = pump._id;
      resolvedPump = pump;
    } else if (registeredPumpCode && String(registeredPumpCode).trim()) {
      const pump = await pumpRepository.findByCode(registeredPumpCode);
      if (!pump) throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid pump code');
      resolvedRegisteredPumpId = pump._id;
      resolvedPump = pump;
    }

    // Check if mobile already exists
    const existing = await userRepository.findByMobile(mobile);
    if (existing) {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'User with this mobile number already exists');
    }

    // Validate referral code if provided (referrer must be Manager or Staff)
    let referrer = null;
    if (referralCode) {
      referrer = await findReferrerByCode(referralCode);
      if (!referrer) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid referral code');
      }
      if (referrer._ownerType !== 'Manager' && referrer._ownerType !== 'Staff') {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Referral code is not valid for manager/staff');
      }
    }

    let ownerId = null;

    // Owner-only registration: create only fleet owner (no driver, no vehicle)
    if (registrationData.ownerOnly && accountType === 'organization' && ownerType === 'non-registered' && owner) {
      const ownerMobile = owner.mobile;
      const existingOwner = await userRepository.findByMobile(ownerMobile);
      if (existingOwner) {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'Owner with this mobile number already exists');
      }
      const newOwner = await userRepository.create({
        fullName: owner.fullName,
        mobile: ownerMobile,
        email: owner.email || null,
        userType: USER_TYPES.OWNER,
        walletSummary: { totalEarned: 0, availablePoints: 0, redeemedPoints: 0, expiredPoints: 0 },
        status: 'active',
        mobileVerified: true,
        address: owner.address || null,
        ownerId: null,
        loyaltyId: await generateOwnerLoyaltyId(),
        profilePhoto: ownerPhoto || profilePhoto || null,
        registeredPumpId: resolvedRegisteredPumpId,
      });
      const pumpName = resolvedPump?.name || 'our';
      return {
        userId: newOwner._id,
        vehicleId: null,
        loyaltyId: newOwner.loyaltyId,
        user: await userRepository.findById(newOwner._id),
        vehicle: null,
        ownerId: newOwner._id,
        message: `Thank you for registering at ${pumpName} for the loyalty program scheme.`,
        registeredPump: resolvedPump ? { _id: resolvedPump._id, name: resolvedPump.name, code: resolvedPump.code } : null,
      };
    }

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
          userType: USER_TYPES.OWNER,
          walletSummary: { totalEarned: 0, availablePoints: 0, redeemedPoints: 0, expiredPoints: 0 },
          status: 'active',
          mobileVerified: true,
          address: owner.address || null,
          ownerId: null,
          loyaltyId: await generateOwnerLoyaltyId(),
          profilePhoto: ownerPhoto || null,
          registeredPumpId: resolvedRegisteredPumpId,
        });
        ownerId = newOwner._id;
      }
    }

    // Check duplicate vehicleNumber before creating user so we don't leave orphan users on vehicle failure
    if (vehicle?.vehicleNumber) {
      const existingVehicle = await vehicleRepository.findByVehicleNumber(vehicle.vehicleNumber);
      if (existingVehicle) {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'Duplicate value for vehicleNumber');
      }
    }

    // Create user (customer/driver) - owner photo is on owner only, not on driver
    const user = await userRepository.create({
      fullName,
      mobile,
      email: email || null,
      userType: ownerId ? USER_TYPES.DRIVER : USER_TYPES.INDIVIDUAL,
      walletSummary: { totalEarned: 0, availablePoints: 0, redeemedPoints: 0, expiredPoints: 0 },
      status: 'active',
      mobileVerified: true,
      address: address || null,
      profilePhoto: profilePhoto || null,
      driverPhoto: driverPhoto || null,
      ownerPhoto: null,
      ownerId: ownerId,
      registeredPumpId: resolvedRegisteredPumpId,
    });

    let vehicleCreated;
    try {
      const vehicleData = {
        ...vehicle,
        userId: user._id,
        rcPhoto: rcPhoto || null,
        insurancePhoto: registrationData.insurancePhoto || null,
        fitnessPhoto: registrationData.fitnessPhoto || null,
        pollutionPhoto: registrationData.pollutionPhoto || null,
        vehiclePhoto: registrationData.vehiclePhoto || [],
      };
      vehicleCreated = await vehicleService.createVehicle(vehicleData);
    } catch (vehicleError) {
      await userRepository.delete(user._id);
      throw vehicleError;
    }

    // Credit referral points to referrer (Manager or Staff) if referralCode provided
    if (referrer && referrer._id && (referrer._ownerType === 'Manager' || referrer._ownerType === 'Staff')) {
      try {
        const systemConfig = await systemConfigService.getConfig();
        const referralPoints = systemConfig.points?.referral || 0;
        if (referralPoints > 0) {
          await pointsService.creditPoints({
            userId: referrer._id,
            ownerType: referrer._ownerType,
            points: referralPoints,
            type: 'credit',
            reason: `Referral bonus - User ${user._id} registered with referral code`,
            createdBy: user._id,
          });
        }
      } catch (error) {
        console.error('Failed to credit referral points:', error.message);
      }
    }

    const pumpName = resolvedPump?.name || 'our';
    return {
      userId: user._id,
      vehicleId: vehicleCreated._id,
      loyaltyId: vehicleCreated.loyaltyId,
      user: await userRepository.findById(user._id),
      vehicle: vehicleCreated,
      message: `Thank you for registering at ${pumpName} for the loyalty program scheme.`,
      registeredPump: resolvedPump ? { _id: resolvedPump._id, name: resolvedPump.name, code: resolvedPump.code } : null,
      ownerId: ownerId, // Return ownerId if organization
    };
  },

  /**
   * Create user by Admin
   * Supports Individual and Organization (Fleet) account types
   */
  async createUserByAdmin(userData, vehicleData, adminId) {
    const role = (userData.role || '').toLowerCase();
    const accountType = role === ROLES.USER ? (userData.accountType || 'individual') : 'individual';

    let resolvedRegisteredPumpId = null;
    if (role === ROLES.USER && (userData.registeredPumpId || userData.registeredPumpCode)) {
      const registeredPumpIdInput = userData.registeredPumpId?.trim();
      const registeredPumpCode = userData.registeredPumpCode?.trim();
      if (registeredPumpIdInput) {
        const pump = await pumpRepository.findById(registeredPumpIdInput);
        if (!pump) throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid registeredPumpId');
        resolvedRegisteredPumpId = pump._id;
      } else if (registeredPumpCode) {
        const pump = await pumpRepository.findByCode(registeredPumpCode);
        if (!pump) throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid registeredPumpCode');
        resolvedRegisteredPumpId = pump._id;
      }
    }

    // Owner-only: create only fleet owner (no driver, no vehicle)
    if (userData.ownerOnly && role === ROLES.USER && accountType === 'organization' && userData.ownerType === 'non-registered' && userData.owner) {
      const ownerMobile = userData.owner.mobile;
      const existingOwner = await userRepository.findByMobile(ownerMobile);
      if (existingOwner) {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'Owner with this mobile number already exists');
      }
      const newOwner = await userRepository.create({
        fullName: userData.owner.fullName,
        mobile: ownerMobile,
        email: userData.owner.email || null,
        userType: USER_TYPES.OWNER,
        walletSummary: { totalEarned: 0, availablePoints: 0, redeemedPoints: 0, expiredPoints: 0 },
        status: 'active',
        mobileVerified: false,
        address: userData.owner.address || null,
        ownerId: null,
        loyaltyId: await generateOwnerLoyaltyId(),
        profilePhoto: userData.profilePhoto || userData.ownerPhoto || null,
        createdBy: adminId,
        createdByModel: 'Admin',
        registeredPumpId: resolvedRegisteredPumpId,
      });
      return {
        user: await userRepository.findById(newOwner._id),
        vehicle: null,
        assignment: null,
        ownerId: newOwner._id,
      };
    }

    const existing = await userRepository.findByMobile(userData.mobile);
    if (existing) {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'User with this mobile number already exists');
    }
    
    // Organization accounts only supported for USER role
    if (accountType === 'organization' && role !== ROLES.USER) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Organization accounts are only supported for regular users');
    }

    let ownerId = null;

    // Handle Organization (Fleet) registration
    if (accountType === 'organization' && role === ROLES.USER) {
      if (userData.ownerType === 'registered') {
        // Search for existing owner by ID or phone
        const foundOwner = await userRepository.findByIdentifier(userData.ownerIdentifier);
        if (!foundOwner) {
          throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Owner not found with the provided identifier');
        }
        // Verify owner is actually an owner (has role USER and no ownerId)
        if (foundOwner.ownerId) {
          throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'The provided identifier belongs to a driver, not an owner');
        }
        ownerId = foundOwner._id;
      } else if (userData.ownerType === 'non-registered') {
        // Create new owner
        const ownerMobile = userData.owner.mobile;
        const existingOwner = await userRepository.findByMobile(ownerMobile);
        if (existingOwner) {
          throw new ApiError(HTTP_STATUS.CONFLICT, 'Owner with this mobile number already exists');
        }

        const newOwner = await userRepository.create({
          fullName: userData.owner.fullName,
          mobile: ownerMobile,
          email: userData.owner.email || null,
          userType: USER_TYPES.OWNER,
          walletSummary: { totalEarned: 0, availablePoints: 0, redeemedPoints: 0, expiredPoints: 0 },
          status: 'active',
          mobileVerified: false,
          address: userData.owner.address || null,
          ownerId: null,
          loyaltyId: await generateOwnerLoyaltyId(),
          profilePhoto: userData.ownerPhoto || null,
          createdBy: adminId,
          createdByModel: 'Admin',
          registeredPumpId: resolvedRegisteredPumpId,
        });
        ownerId = newOwner._id;
      }
    }

    if (role === ROLES.STAFF && userData.assignedManagerId) {
      const manager = await managerRepository.findById(userData.assignedManagerId);
      if (!manager) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'assignedManagerId must be a valid manager');
      }
    }

    let passwordHash = null;
    if (userData.password) {
      passwordHash = await authService.hashPassword(userData.password);
    }

    let referralCode = userData.referralCode || null;
    if ([ROLES.MANAGER, ROLES.STAFF].includes(role)) {
      if (!referralCode) {
        let code;
        while (await isReferralCodeTaken(code = generateReferralCode())) {}
        referralCode = code;
      }
    }

    let managerCode = role === ROLES.MANAGER ? (userData.managerCode?.trim() || null) : null;
    if (role === ROLES.MANAGER && !managerCode) {
      managerCode = await generateUniqueManagerCode();
    }

    let staffCode = role === ROLES.STAFF ? (userData.staffCode?.trim() || null) : null;
    if (role === ROLES.STAFF && !staffCode) {
      staffCode = await generateUniqueStaffCode();
    }

    const { password, ownerType, ownerIdentifier, owner, accountType: _, role: __, ...userDataWithoutPassword } = userData;

    // Resolve referrer for customer (USER) when referral code provided - same as register flow
    let referrer = null;
    if (role === ROLES.USER && referralCode) {
      referrer = await findReferrerByCode(referralCode);
      if (!referrer) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid referral code');
      }
      if (referrer._ownerType !== 'Manager' && referrer._ownerType !== 'Staff') {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Referral code must belong to a manager or staff');
      }
    }

    let created = null;
    let vehicle = null;
    let assignment = null;

    if (role === ROLES.MANAGER) {
      created = await managerRepository.create({
        fullName: userData.fullName,
        mobile: userData.mobile,
        email: userData.email || null,
        passwordHash: passwordHash || null,
        managerCode,
        referralCode,
        walletSummary: { totalEarned: 0, availablePoints: 0, redeemedPoints: 0, expiredPoints: 0 },
        address: userData.address || null,
        profilePhoto: userData.profilePhoto || null,
        status: 'active',
        createdBy: adminId,
        createdByModel: 'Admin',
      });
      return {
        user: { ...(await managerRepository.findById(created._id)), role: ROLES.MANAGER },
        vehicle: null,
        assignment: null,
        ownerId: null,
      };
    }

    if (role === ROLES.STAFF) {
      created = await staffRepository.create({
        fullName: userData.fullName,
        mobile: userData.mobile,
        email: userData.email || null,
        passwordHash: passwordHash || null,
        staffCode,
        referralCode,
        assignedManagerId: userData.assignedManagerId || null,
        walletSummary: { totalEarned: 0, availablePoints: 0, redeemedPoints: 0, expiredPoints: 0 },
        address: userData.address || null,
        profilePhoto: userData.profilePhoto || null,
        status: 'active',
        createdBy: adminId,
        createdByModel: 'Admin',
      });
      if (userData.pumpId) {
        try {
          assignment = await staffAssignmentService.assignStaffToPump(created._id, userData.pumpId, adminId);
        } catch (error) {
          console.error('Failed to assign staff to pump during creation:', error.message);
        }
      }
      return {
        user: { ...(await staffRepository.findById(created._id)), role: ROLES.STAFF },
        vehicle: null,
        assignment: assignment || null,
        ownerId: null,
      };
    }

    // role === ROLES.USER (customer/driver) - check duplicate vehicleNumber before creating user
    if (vehicleData?.vehicleNumber) {
      const existingVehicle = await vehicleRepository.findByVehicleNumber(vehicleData.vehicleNumber);
      if (existingVehicle) {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'Duplicate value for vehicleNumber');
      }
    }

    created = await userRepository.create({
      ...userDataWithoutPassword,
      passwordHash: passwordHash || null,
      referralCode: referrer ? (referralCode || '').trim() || null : null,
      userType: ownerId ? USER_TYPES.DRIVER : USER_TYPES.INDIVIDUAL,
      address: userData.address || null,
      profilePhoto: userData.profilePhoto || null,
      ownerId,
      walletSummary: { totalEarned: 0, availablePoints: 0, redeemedPoints: 0, expiredPoints: 0 },
      status: 'active',
      createdBy: adminId,
      createdByModel: 'Admin',
      driverPhoto: userData.driverPhoto || null,
      ownerPhoto: null,
      mobileVerified: false,
      registeredPumpId: role === ROLES.USER ? resolvedRegisteredPumpId : null,
    });

    if (vehicleData) {
      try {
        vehicle = await vehicleService.createVehicle({
          ...vehicleData,
          userId: created._id,
        });
      } catch (vehicleError) {
        await userRepository.delete(created._id);
        throw vehicleError;
      }
    }

    // Credit referral points to referrer (Manager or Staff) when user created with referral code - same as register
    if (referrer && referrer._id && (referrer._ownerType === 'Manager' || referrer._ownerType === 'Staff')) {
      try {
        const systemConfig = await systemConfigService.getConfig();
        const referralPoints = systemConfig.points?.referral || 0;
        if (referralPoints > 0) {
          await pointsService.creditPoints({
            userId: referrer._id,
            ownerType: referrer._ownerType,
            points: referralPoints,
            type: 'credit',
            reason: `Referral bonus - User ${created._id} registered with referral code (admin)`,
            createdBy: created._id,
          });
        }
      } catch (error) {
        console.error('Failed to credit referral points:', error.message);
      }
    }

    return {
      user: await userRepository.findById(created._id),
      vehicle,
      assignment: null,
      ownerId: ownerId || null,
    };
  },

  /**
   * Create user by Manager/Staff (at pump)
   * Manager can create staff or user, Staff can only create user
   * Supports Individual and Organization (Fleet) account types
   * Credits registration points to operator (only for regular users, not staff)
   * Auto-generates referral code for staff created by manager
   */
  async createUserByManagerOrStaff(userData, vehicleData, operatorId, operatorRole) {
    const userRole = (userData.role || ROLES.USER).toLowerCase();
    const accountType = userRole === ROLES.USER ? (userData.accountType || 'individual') : 'individual';

    // Owner-only: create only fleet owner (no driver, no vehicle)
    if (userData.ownerOnly && userRole === ROLES.USER && accountType === 'organization' && userData.ownerType === 'non-registered' && userData.owner) {
      const ownerMobile = userData.owner.mobile;
      const existingOwner = await userRepository.findByMobile(ownerMobile);
      if (existingOwner) {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'Owner with this mobile number already exists');
      }
      const operatorType = operatorRole === ROLES.MANAGER ? 'Manager' : 'Staff';
      const newOwner = await userRepository.create({
        fullName: userData.owner.fullName,
        mobile: ownerMobile,
        email: userData.owner.email || null,
        userType: USER_TYPES.OWNER,
        walletSummary: { totalEarned: 0, availablePoints: 0, redeemedPoints: 0, expiredPoints: 0 },
        status: 'active',
        mobileVerified: false,
        address: userData.owner.address || null,
        ownerId: null,
        loyaltyId: await generateOwnerLoyaltyId(),
        profilePhoto: userData.ownerPhoto || null,
        createdBy: operatorId,
        createdByModel: operatorType,
      });
      return {
        user: await userRepository.findById(newOwner._id),
        vehicle: null,
        assignment: null,
        ownerId: newOwner._id,
      };
    }

    const existing = await userRepository.findByMobile(userData.mobile);
    if (existing) {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'User with this mobile number already exists');
    }
    
    // Organization accounts only supported for USER role
    if (accountType === 'organization' && userRole !== ROLES.USER) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Organization accounts are only supported for regular users');
    }

    // Validate: Staff cannot create staff, only managers can
    if (userRole === ROLES.STAFF && operatorRole !== ROLES.MANAGER) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Only managers can create staff members');
    }

    let ownerId = null;

    // Handle Organization (Fleet) registration
    if (accountType === 'organization' && userRole === ROLES.USER) {
      if (userData.ownerType === 'registered') {
        // Search for existing owner by ID or phone
        const foundOwner = await userRepository.findByIdentifier(userData.ownerIdentifier);
        if (!foundOwner) {
          throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Owner not found with the provided identifier');
        }
        // Verify owner is actually an owner (has role USER and no ownerId)
        if (foundOwner.ownerId) {
          throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'The provided identifier belongs to a driver, not an owner');
        }
        ownerId = foundOwner._id;
      } else if (userData.ownerType === 'non-registered') {
        // Create new owner
        const ownerMobile = userData.owner.mobile;
        const existingOwner = await userRepository.findByMobile(ownerMobile);
        if (existingOwner) {
          throw new ApiError(HTTP_STATUS.CONFLICT, 'Owner with this mobile number already exists');
        }

        const newOwner = await userRepository.create({
          fullName: userData.owner.fullName,
          mobile: ownerMobile,
          email: userData.owner.email || null,
          userType: USER_TYPES.OWNER,
          walletSummary: { totalEarned: 0, availablePoints: 0, redeemedPoints: 0, expiredPoints: 0 },
          status: 'active',
          mobileVerified: false,
          address: userData.owner.address || null,
          ownerId: null,
          loyaltyId: await generateOwnerLoyaltyId(),
          profilePhoto: userData.ownerPhoto || null,
          createdBy: operatorId,
          createdByModel: operatorRole === ROLES.MANAGER ? 'Manager' : 'Staff',
        });
        ownerId = newOwner._id;
      }
    }

    if (userRole === ROLES.STAFF && userData.assignedManagerId) {
      const manager = await managerRepository.findById(userData.assignedManagerId);
      if (!manager) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'assignedManagerId must be a valid manager');
      }
    }

    let passwordHash = null;
    if (userData.password) {
      passwordHash = await authService.hashPassword(userData.password);
    }

    let referralCode = userData.referralCode || null;
    if (userRole === ROLES.STAFF) {
      let code;
      while (await isReferralCodeTaken(code = generateReferralCode())) {}
      referralCode = code;
    }

    let staffCode = userRole === ROLES.STAFF ? (userData.staffCode?.trim() || null) : null;
    if (userRole === ROLES.STAFF && !staffCode) {
      staffCode = await generateUniqueStaffCode();
    }

    const { password, ownerType, ownerIdentifier, owner, accountType: _, role: __, ...userDataWithoutPassword } = userData;

    let finalAssignedManagerId = userRole === ROLES.STAFF ? (userData.assignedManagerId || null) : null;
    if (userRole === ROLES.STAFF && operatorRole === ROLES.MANAGER && !finalAssignedManagerId) {
      finalAssignedManagerId = operatorId;
    }

    const operatorType = operatorRole === ROLES.MANAGER ? 'Manager' : 'Staff';

    let created = null;
    let vehicle = null;
    let assignment = null;

    if (userRole === ROLES.STAFF) {
      created = await staffRepository.create({
        fullName: userData.fullName,
        mobile: userData.mobile,
        email: userData.email || null,
        passwordHash: passwordHash || null,
        staffCode,
        referralCode,
        assignedManagerId: finalAssignedManagerId,
        walletSummary: { totalEarned: 0, availablePoints: 0, redeemedPoints: 0, expiredPoints: 0 },
        address: userData.address || null,
        profilePhoto: userData.profilePhoto || null,
        status: 'active',
        createdBy: operatorId,
        createdByModel: operatorRole === ROLES.MANAGER ? 'Manager' : 'Admin',
      });

      if (operatorRole === ROLES.MANAGER) {
        if (userData.pumpId) {
          const pump = await pumpRepository.findById(userData.pumpId);
          if (!pump) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Pump not found');
          if (pump.managerId?.toString() !== operatorId.toString()) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'You can only assign staff to pumps you manage');
          }
          try {
            assignment = await staffAssignmentService.assignStaffToPump(created._id, userData.pumpId, operatorId);
          } catch (error) {
            console.error('Failed to assign staff to pump during creation:', error.message);
          }
        } else {
          try {
            const managerPumpIds = await pumpRepository.findPumpIdsByManagerId(operatorId);
            if (managerPumpIds.length > 0) {
              try {
                assignment = await staffAssignmentService.assignStaffToPump(created._id, managerPumpIds[0], operatorId);
              } catch (error) {
                console.error('Failed to auto-assign staff to manager pump:', error.message);
              }
            }
          } catch (error) {
            console.error('Failed to auto-assign staff to manager pump during creation:', error.message);
          }
        }
      } else if (userData.pumpId) {
        try {
          assignment = await staffAssignmentService.assignStaffToPump(created._id, userData.pumpId, operatorId);
        } catch (error) {
          console.error('Failed to assign staff to pump during creation:', error.message);
        }
      }

      return {
        user: { ...(await staffRepository.findById(created._id)), role: ROLES.STAFF },
        vehicle: null,
        assignment: assignment || null,
        ownerId: null,
      };
    }

    // userRole === ROLES.USER (customer) - check duplicate vehicleNumber before creating user
    if (vehicleData?.vehicleNumber) {
      const existingVehicle = await vehicleRepository.findByVehicleNumber(vehicleData.vehicleNumber);
      if (existingVehicle) {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'Duplicate value for vehicleNumber');
      }
    }

    created = await userRepository.create({
      ...userDataWithoutPassword,
      passwordHash: passwordHash || null,
      referralCode: null,
      userType: ownerId ? USER_TYPES.DRIVER : USER_TYPES.INDIVIDUAL,
      address: userData.address || null,
      profilePhoto: userData.profilePhoto || null,
      ownerId,
      walletSummary: { totalEarned: 0, availablePoints: 0, redeemedPoints: 0, expiredPoints: 0 },
      status: 'active',
      createdBy: operatorId,
      createdByModel: operatorType,
      driverPhoto: userData.driverPhoto || null,
      ownerPhoto: null,
      mobileVerified: false,
    });

    if (vehicleData) {
      try {
        vehicle = await vehicleService.createVehicle({
          ...vehicleData,
          userId: created._id,
        });
      } catch (vehicleError) {
        await userRepository.delete(created._id);
        throw vehicleError;
      }
    }

    if (userRole === ROLES.USER) {
      try {
        const systemConfig = await systemConfigService.getConfig();
        const registrationPoints = systemConfig.points?.registration || 0;
        if (registrationPoints > 0) {
          await pointsService.creditPoints({
            userId: operatorId,
            ownerType: operatorType,
            points: registrationPoints,
            type: 'credit',
            reason: `Registration bonus - Created user ${created._id} (${created.fullName})`,
            createdBy: operatorId,
          });
        }
      } catch (error) {
        console.error('Failed to credit registration points:', error.message);
      }
    }

    return {
      user: await userRepository.findById(created._id),
      vehicle,
      assignment: null,
      ownerId: ownerId || null,
    };
  },

  /**
   * Generate referral code for manager/staff. userId + userType identify the entity (Manager or Staff).
   */
  async generateReferralCode(userId, userType = null) {
    let entity = null;
    let ownerType = userType;
    if (!ownerType) {
      if (await managerRepository.findById(userId)) ownerType = 'Manager';
      else if (await staffRepository.findById(userId)) ownerType = 'Staff';
    }
    if (ownerType === 'Manager') {
      entity = await managerRepository.findById(userId);
      if (!entity) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Manager not found');
      if (entity.referralCode) return entity.referralCode;
      let code;
      while (await isReferralCodeTaken(code = generateReferralCode())) {}
      await managerRepository.update(userId, { referralCode: code });
      return code;
    }
    if (ownerType === 'Staff') {
      entity = await staffRepository.findById(userId);
      if (!entity) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Staff not found');
      if (entity.referralCode) return entity.referralCode;
      let code;
      while (await isReferralCodeTaken(code = generateReferralCode())) {}
      await staffRepository.update(userId, { referralCode: code });
      return code;
    }
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Referral codes are only available for managers and staff');
  },

  /**
   * Get user by ID. Attaches registeredPump { _id, name, code } when user has registeredPumpId.
   */
  async getUserById(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
    }
    if (user.registeredPumpId) {
      const pump = await pumpRepository.findById(user.registeredPumpId);
      user.registeredPump = pump ? { _id: pump._id, name: pump.name, code: pump.code } : null;
    } else {
      user.registeredPump = null;
    }
    return user;
  },

  /**
   * Get staff by ID
   */
  async getStaffById(staffId) {
    return staffRepository.findById(staffId);
  },

  /**
   * Get manager by ID
   */
  async getManagerById(managerId) {
    return managerRepository.findById(managerId);
  },

  /**
   * List users with filters. When allowedPumpIds is provided (manager), only users who registered at those pumps are returned.
   * Each user is enriched with registeredPump { _id, name, code } when they have registeredPumpId.
   */
  async listUsers(filter = {}, options = {}, allowedPumpIds = null) {
    if (allowedPumpIds && Array.isArray(allowedPumpIds) && allowedPumpIds.length > 0) {
      filter.registeredPumpId = { $in: allowedPumpIds.map((id) => String(id)) };
    }
    const result = await userRepository.list(filter, options);
    if (!result.list || result.list.length === 0) {
      return result;
    }
    const pumpIds = [...new Set(result.list.map((u) => u.registeredPumpId).filter(Boolean))];
    const pumps = pumpIds.length
      ? await Promise.all(pumpIds.map((id) => pumpRepository.findById(id)))
      : [];
    const pumpMap = Object.fromEntries(pumps.filter(Boolean).map((p) => [String(p._id), { _id: p._id, name: p.name, code: p.code }]));
    result.list = result.list.map((u) => ({
      ...u,
      registeredPump: u.registeredPumpId ? pumpMap[String(u.registeredPumpId)] || null : null,
    }));
    return result;
  },

  /**
   * Update user (admin) - for customers (User model) only.
   */
  async updateUser(userId, updateData, adminId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
    }
    const { passwordHash, assignedManagerId, managerCode, staffCode, role, ...safeUpdateData } = updateData;
    const updated = await userRepository.update(userId, safeUpdateData);
    return updated;
  },

  /**
   * Update staff (admin) - set assignedManagerId, fullName, email, address.
   */
  async updateStaff(staffId, updateData, adminId) {
    const staff = await staffRepository.findById(staffId);
    if (!staff) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Staff not found');
    }
    const allowed = ['fullName', 'email', 'address', 'assignedManagerId'];
    const safe = {};
    for (const key of allowed) {
      if (updateData[key] !== undefined) safe[key] = updateData[key];
    }
    if (safe.assignedManagerId === '') safe.assignedManagerId = null;
    if (Object.keys(safe).length === 0) return staff;
    if (safe.assignedManagerId) {
      const manager = await managerRepository.findById(safe.assignedManagerId);
      if (!manager) throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'assignedManagerId must be a valid manager');
    }
    const updated = await staffRepository.update(staffId, safe);
    return { ...updated, role: ROLES.STAFF };
  },

  /**
   * Update manager (admin) - fullName, email, address.
   */
  async updateManager(managerId, updateData, adminId) {
    const manager = await managerRepository.findById(managerId);
    if (!manager) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Manager not found');
    }
    const allowed = ['fullName', 'email', 'address'];
    const safe = {};
    for (const key of allowed) {
      if (updateData[key] !== undefined) safe[key] = updateData[key];
    }
    if (Object.keys(safe).length === 0) return manager;
    const updated = await managerRepository.update(managerId, safe);
    return { ...updated, role: ROLES.MANAGER };
  },

  /**
   * Block/unblock user (admin) - customers only
   */
  async updateUserStatus(userId, status, adminId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
    }

    const updated = await userRepository.update(userId, { status });
    return updated;
  },

  /**
   * Delete any user (manager, staff, or customer) by ID. Admin only.
   * @param {string} userId - ID of the entity to delete
   * @param {string} type - Optional: 'manager' | 'staff' | 'user'. If omitted, resolves by checking Manager, then Staff, then User.
   * @returns {{ deleted: true, type: string }}
   */
  async deleteUser(userId, type = null) {
    let ownerType = type;
    if (!ownerType) {
      if (await managerRepository.findById(userId)) ownerType = 'Manager';
      else if (await staffRepository.findById(userId)) ownerType = 'Staff';
      else if (await userRepository.findById(userId)) ownerType = 'User';
    }

    if (ownerType === 'Manager') {
      const manager = await managerRepository.findById(userId);
      if (!manager) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Manager not found');
      await pumpRepository.unsetManagerId(userId);
      await managerRepository.delete(userId);
      return { deleted: true, type: 'manager' };
    }

    if (ownerType === 'Staff') {
      const staff = await staffRepository.findById(userId);
      if (!staff) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Staff not found');
      await staffAssignmentRepository.deleteByStaffId(userId);
      await staffRepository.delete(userId);
      return { deleted: true, type: 'staff' };
    }

    if (ownerType === 'User') {
      const user = await userRepository.findById(userId);
      if (!user) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
      await userRepository.delete(userId);
      return { deleted: true, type: 'user' };
    }

    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
  },
};
