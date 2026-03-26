import { redemptionRepository } from '../repositories/redemption.repository.js';
import { rewardRepository } from '../repositories/reward.repository.js';
import { pumpRepository } from '../repositories/pump.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { vehicleRepository } from '../repositories/vehicle.repository.js';
import { managerRepository } from '../repositories/manager.repository.js';
import { pointsService } from './points.service.js';
import { scanService } from './scan.service.js';
import { notificationService } from './notification.service.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import { REDEMPTION_STATUS } from '../constants/status.js';

/**
 * Generate unique redemption code (e.g. RED + 8 digits)
 */
function generateRedemptionCode() {
  const prefix = 'RED';
  const randomDigits = Math.floor(10000000 + Math.random() * 90000000).toString();
  return `${prefix}${randomDigits}`;
}

/**
 * Get user IDs to notify for a redemption: the user (redeemer) and, if they are a driver (organization), the owner.
 */
async function getRedemptionNotificationUserIds(userId) {
  if (!userId) return [];
  const user = await userRepository.findById(userId);
  if (!user) return [userId];
  const ids = [userId];
  if (user.ownerId) ids.push(user.ownerId);
  return [...new Set(ids.map((id) => String(id)))];
}

/**
 * Get display info for a user (name, loyaltyId, mobile) for notifications and list responses.
 * loyaltyId: from User.loyaltyId if set, else from first vehicle.
 */
async function getUserDisplayInfo(userId) {
  if (!userId) return { fullName: null, loyaltyId: null, mobile: null };
  const user = await userRepository.findById(userId);
  if (!user) return { fullName: null, loyaltyId: null, mobile: null };
  let loyaltyId = user.loyaltyId || null;
  if (!loyaltyId) {
    const vehicles = await vehicleRepository.findByUserId(userId);
    loyaltyId = vehicles?.[0]?.loyaltyId || null;
  }
  return {
    fullName: user.fullName || null,
    loyaltyId,
    mobile: user.mobile || null,
  };
}

async function sendRedemptionNotification(redemption, title, body) {
  try {
    const userIds = await getRedemptionNotificationUserIds(redemption.userId);
    if (userIds.length === 0) return;
    await notificationService.sendToUsers(userIds, title, body);
  } catch (err) {
    console.warn('[Redemption] Notification failed:', err?.message);
  }
}

export const redemptionService = {
  /**
   * Create redemption (user-initiated)
   * @param {Object} params
   * @param {string} params.userId - User ID
   * @param {string} params.rewardId - Reward ID
   * @returns {Object} Redemption record
   */
  async createRedemption({ userId, rewardId }) {
    // Get reward
    const reward = await rewardRepository.findById(rewardId);
    if (!reward) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Reward not found');
    }

    // Check reward availability
    const now = new Date();
    if (reward.status !== 'active') {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Reward is not active');
    }
    if (new Date(reward.validFrom) > now || new Date(reward.validUntil) < now) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Reward is not valid at this time');
    }
    if (reward.availability === 'limited' && reward.redeemedQuantity >= reward.totalQuantity) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Reward is out of stock');
    }

    // Check user balance
    const user = await pointsService.getWallet(userId, { page: 1, limit: 1 });
    const availablePoints = user.walletSummary.availablePoints;
    if (availablePoints < reward.pointsRequired) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Insufficient points balance');
    }

    // Generate unique redemption code
    let redemptionCode;
    let exists = true;
    while (exists) {
      redemptionCode = generateRedemptionCode();
      const existing = await redemptionRepository.findByRedemptionCode(redemptionCode);
      exists = !!existing;
    }

    // Calculate expiry date (30 days from now)
    const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Create redemption record
    const redemption = await redemptionRepository.create({
      userId,
      rewardId,
      pointsUsed: reward.pointsRequired,
      redemptionCode,
      status: REDEMPTION_STATUS.PENDING,
      expiryDate,
    });

    // Deduct points from user
    await pointsService.debitPoints({
      userId,
      points: reward.pointsRequired,
      type: 'debit',
      reason: `Redeemed reward: ${reward.name}`,
      redemptionId: redemption._id,
    });

    // Update reward redeemed quantity
    await rewardRepository.update(rewardId, {
      redeemedQuantity: (reward.redeemedQuantity || 0) + 1,
    });

    await sendRedemptionNotification(
      redemption,
      'Points redeemed',
      `You redeemed ${reward.pointsRequired} points successfully.`
    );

    return redemption;
  },

  /**
   * At-pump redemption (manager/staff initiated)
   * @param {Object} params
   * @param {string} params.identifier - loyaltyId, owner ID, or mobile
   * @param {number} params.pointsToDeduct - Points to deduct
   * @param {string} params.operatorId - Manager/Staff ID
   * @param {string} params.operatorType - 'Manager' | 'Staff'
   * @param {string} params.pumpId - Pump ID
   * @returns {Object} Redemption record
   */
  async createAtPumpRedemption({ identifier, pointsToDeduct, operatorId, operatorType, pumpId }) {
    const { user } = await scanService.validateIdentifier(identifier);

    const wallet = await pointsService.getWallet(user._id, { page: 1, limit: 1 });
    const availablePoints = wallet.walletSummary.availablePoints;
    if (availablePoints < pointsToDeduct) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Insufficient points balance');
    }

    let redemptionCode;
    let exists = true;
    while (exists) {
      redemptionCode = generateRedemptionCode();
      const existing = await redemptionRepository.findByRedemptionCode(redemptionCode);
      exists = !!existing;
    }

    const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const redemption = await redemptionRepository.create({
      userId: user._id,
      rewardId: null,
      pointsUsed: pointsToDeduct,
      redemptionCode,
      status: REDEMPTION_STATUS.PENDING,
      approvedBy: null,
      createdBy: operatorType ? operatorId : null,
      createdByModel: operatorType === 'Manager' || operatorType === 'Staff' ? operatorType : null,
      usedAtPump: pumpId,
      expiryDate,
    });

    // Notify admin: new redemption request (include redeemer name, loyaltyId, phone)
    try {
      const userDisplay = await getUserDisplayInfo(user._id);
      const userPart = [userDisplay.fullName && `Name: ${userDisplay.fullName}`, userDisplay.loyaltyId && `Loyalty ID: ${userDisplay.loyaltyId}`, userDisplay.mobile && `Phone: ${userDisplay.mobile}`].filter(Boolean).join(', ');
      const bodyText = userPart
        ? `Redemption of ${pointsToDeduct} points (code: ${redemptionCode}) is pending approval. ${userPart}.`
        : `Redemption of ${pointsToDeduct} points (code: ${redemptionCode}) is pending approval.`;
      await notificationService.createForAdmin('New redemption request', bodyText, null, {
        redeemerFullName: userDisplay.fullName || null,
        redeemerLoyaltyId: userDisplay.loyaltyId || null,
        redeemerMobile: userDisplay.mobile || null,
      });
    } catch (err) {
      console.warn('[Redemption] Admin notification failed:', err?.message);
    }

    return {
      redemption,
      wallet: wallet.walletSummary,
      user: {
        _id: user._id,
        fullName: user.fullName,
        mobile: user.mobile,
      },
    };
  },

  /**
   * Approve redemption (admin). Deducts points from user when approving.
   */
  async approveRedemption(redemptionId, approverId) {
    const redemption = await redemptionRepository.findById(redemptionId);
    if (!redemption) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Redemption not found');
    }

    if (redemption.status !== REDEMPTION_STATUS.PENDING) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Redemption is not pending');
    }

    // Deduct points on approval (manager/staff create PENDING; admin approves and points are deducted here)
    await pointsService.debitPoints({
      userId: redemption.userId,
      ownerType: 'UserLoyalty',
      points: redemption.pointsUsed,
      type: 'debit',
      reason: `Redemption approved (was pending)`,
      redemptionId: redemption._id,
      createdBy: approverId,
    });

    const updated = await redemptionRepository.update(redemptionId, {
      status: REDEMPTION_STATUS.APPROVED,
      approvedBy: approverId,
    });

    // Notify user (and owner if driver)
    await sendRedemptionNotification(
      updated,
      'Redemption approved',
      `Your redemption of ${updated.pointsUsed} points has been approved.`
    );

    // Notify creator (Manager or Staff) and user/owner via in-app notification (body includes user name, loyaltyId, phone)
    const userIds = await getRedemptionNotificationUserIds(updated.userId);
    const managerIds = updated.createdByModel === 'Manager' && updated.createdBy ? [updated.createdBy] : [];
    const staffIds = updated.createdByModel === 'Staff' && updated.createdBy ? [updated.createdBy] : [];
    const userDisplay = await getUserDisplayInfo(updated.userId);
    const userPart = [userDisplay.fullName && `Name: ${userDisplay.fullName}`, userDisplay.loyaltyId && `Loyalty ID: ${userDisplay.loyaltyId}`, userDisplay.mobile && `Phone: ${userDisplay.mobile}`].filter(Boolean).join(', ');
    const bodyText = userPart
      ? `Redemption of ${updated.pointsUsed} points (code: ${updated.redemptionCode}) has been approved. ${userPart}.`
      : `Redemption of ${updated.pointsUsed} points (code: ${updated.redemptionCode}) has been approved.`;
    try {
      await notificationService.createForRecipients({
        title: 'Redemption approved',
        body: bodyText,
        userIds,
        managerIds,
        staffIds,
        redeemerFullName: userDisplay.fullName || null,
        redeemerLoyaltyId: userDisplay.loyaltyId || null,
        redeemerMobile: userDisplay.mobile || null,
      });
    } catch (err) {
      console.warn('[Redemption] Approval notification failed:', err?.message);
    }

    return updated;
  },

  /**
   * Admin direct redeem: create redemption and deduct points immediately (no approval needed).
   * pumpId required so we can track at which pump the redemption was done.
   */
  async createDirectRedemption({ userId, pointsToDeduct, pumpId, adminId }) {
    const user = await pointsService.getWallet(userId, { page: 1, limit: 1 });
    const availablePoints = user.walletSummary?.availablePoints || 0;
    if (availablePoints < pointsToDeduct) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Insufficient points balance');
    }

    let redemptionCode;
    let exists = true;
    while (exists) {
      redemptionCode = generateRedemptionCode();
      const existing = await redemptionRepository.findByRedemptionCode(redemptionCode);
      exists = !!existing;
    }

    const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const redemption = await redemptionRepository.create({
      userId,
      rewardId: null,
      pointsUsed: pointsToDeduct,
      redemptionCode,
      status: REDEMPTION_STATUS.APPROVED,
      approvedBy: adminId,
      usedAtPump: pumpId || null,
      expiryDate,
    });

    await pointsService.debitPoints({
      userId,
      ownerType: 'UserLoyalty',
      points: pointsToDeduct,
      type: 'debit',
      reason: 'Direct redemption by admin',
      redemptionId: redemption._id,
      createdBy: adminId,
    });

    const pump = pumpId ? await pumpRepository.findById(pumpId) : null;
    const pumpName = pump?.name || 'Petrol pump';

    await sendRedemptionNotification(
      redemption,
      'Points redeemed',
      `${pointsToDeduct} points were redeemed from your account.`
    );

    return { redemption, pumpName };
  },

  /**
   * Reject redemption (manager)
   */
  async rejectRedemption(redemptionId, managerId, reason = null) {
    const redemption = await redemptionRepository.findById(redemptionId);
    if (!redemption) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Redemption not found');
    }

    if (redemption.status !== REDEMPTION_STATUS.PENDING) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Redemption is not pending');
    }

    // Refund points to user
    await pointsService.creditPoints({
      userId: redemption.userId,
      points: redemption.pointsUsed,
      type: 'refund',
      reason: `Redemption rejected: ${reason || 'No reason provided'}`,
      redemptionId: redemption._id,
      createdBy: managerId,
    });

    // Update redemption status
    const updated = await redemptionRepository.update(redemptionId, {
      status: REDEMPTION_STATUS.REJECTED,
      rejectedReason: reason,
    });

    // Update reward redeemed quantity (decrement)
    if (redemption.rewardId) {
      const reward = await rewardRepository.findById(redemption.rewardId);
      if (reward) {
        await rewardRepository.update(redemption.rewardId, {
          redeemedQuantity: Math.max(0, (reward.redeemedQuantity || 0) - 1),
        });
      }
    }

    return updated;
  },

  /**
   * Verify redemption code
   */
  async verifyRedemptionCode(code) {
    const redemption = await redemptionRepository.findByRedemptionCode(code);
    if (!redemption) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Invalid redemption code');
    }

    const now = new Date();
    if (new Date(redemption.expiryDate) < now) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Redemption code has expired');
    }

    if (redemption.status !== REDEMPTION_STATUS.APPROVED && redemption.status !== REDEMPTION_STATUS.ACTIVE) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, `Redemption code is ${redemption.status}`);
    }

    return redemption;
  },

  /**
   * Mark redemption as used
   */
  async markAsUsed(redemptionId, pumpId) {
    const redemption = await redemptionRepository.findById(redemptionId);
    if (!redemption) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Redemption not found');
    }

    if (redemption.status === REDEMPTION_STATUS.USED) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Redemption code already used');
    }

    const updated = await redemptionRepository.update(redemptionId, {
      status: REDEMPTION_STATUS.USED,
      usedAtPump: pumpId,
      usedAt: new Date(),
    });

    return updated;
  },

  /**
   * Get redemption by ID. Enriches with userDisplay: { fullName, loyaltyId, mobile } for the redeemer.
   */
  async getRedemptionById(redemptionId) {
    const redemption = await redemptionRepository.findById(redemptionId);
    if (!redemption) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Redemption not found');
    }
    const userDisplay = await getUserDisplayInfo(redemption.userId);
    return { ...redemption, userDisplay };
  },

  /**
   * List redemptions. Optionally enriches each item with userDisplay: { fullName, loyaltyId, mobile } for the redeemer (userId).
   * Also enriches each item with:
   * - pump: { pumpId, name, code } from usedAtPump
   * - manager: { managerId, name, managerCode } (prefers pump.managerId; fallback to createdBy when createdByModel='Manager')
   */
  async listRedemptions(filter = {}, options = {}, enrichWithUserDisplay = true) {
    const result = await redemptionRepository.list(filter, options);
    if (!result?.list?.length) return result;

    const userDisplayMap = {};
    if (enrichWithUserDisplay) {
      const userIds = [...new Set(result.list.map((r) => r.userId).filter(Boolean))];
      await Promise.all(
        userIds.map(async (uid) => {
          userDisplayMap[String(uid)] = await getUserDisplayInfo(uid);
        })
      );
    }

    const pumpIds = [...new Set(result.list.map((r) => r.usedAtPump).filter(Boolean).map(String))];
    const pumps = await Promise.all(pumpIds.map((pid) => pumpRepository.findById(pid)));
    const pumpMap = new Map(
      pumps
        .filter(Boolean)
        .map((p) => [String(p._id), { pumpId: p._id, name: p.name ?? null, code: p.code ?? null, managerId: p.managerId ?? null }])
    );

    const managerIdsFromPumps = pumps
      .filter(Boolean)
      .map((p) => p.managerId)
      .filter(Boolean)
      .map(String);
    const managerIdsFromCreator = result.list
      .filter((r) => r.createdByModel === 'Manager' && r.createdBy)
      .map((r) => String(r.createdBy));
    const managerIds = [...new Set([...managerIdsFromPumps, ...managerIdsFromCreator])];
    const managerList = managerIds.length ? await managerRepository.listByIds(managerIds) : [];
    const managerMap = new Map(
      managerList.map((m) => [String(m._id), { managerId: m._id, name: m.fullName ?? null, managerCode: m.managerCode ?? null }])
    );

    result.list = result.list.map((r) => ({
      ...r,
      ...(enrichWithUserDisplay && {
        userDisplay: r.userId
          ? userDisplayMap[String(r.userId)] || { fullName: null, loyaltyId: null, mobile: null }
          : { fullName: null, loyaltyId: null, mobile: null },
      }),
      pump: (() => {
        const pump = r.usedAtPump ? pumpMap.get(String(r.usedAtPump)) : null;
        return pump ? { pumpId: pump.pumpId, name: pump.name, code: pump.code } : null;
      })(),
      manager: (() => {
        const pump = r.usedAtPump ? pumpMap.get(String(r.usedAtPump)) : null;
        const managerId = pump?.managerId
          ? String(pump.managerId)
          : r.createdByModel === 'Manager' && r.createdBy
            ? String(r.createdBy)
            : null;
        return managerId ? (managerMap.get(managerId) ?? null) : null;
      })(),
    }));
    return result;
  },
};
