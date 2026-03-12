import { transactionRepository } from '../repositories/transaction.repository.js';
import { scanService } from './scan.service.js';
import { pointsService } from './points.service.js';
import { campaignService } from './campaign.service.js';
import { pumpRepository } from '../repositories/pump.repository.js';
import { staffRepository } from '../repositories/staff.repository.js';
import { managerRepository } from '../repositories/manager.repository.js';
import Admin from '../models/Admin.js';
import { notificationService } from './notification.service.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import { TRANSACTION_STATUS } from '../constants/status.js';

export const transactionService = {
  /**
   * Create a transaction
   * @param {Object} data - Transaction data
   * @param {string} data.pumpId - Pump ID
   * @param {string} data.identifier - loyaltyId (vehicle) or owner ID
   * @param {number} data.amount - Transaction amount
   * @param {number} data.liters - Liters (required for Fuel)
   * @param {string} data.category - Fuel, Lubricant, Store, Service
   * @param {string} data.billNumber - Bill number (unique per pump)
   * @param {string} data.paymentMode - Cash, Card, UPI, Wallet, Other
   * @param {string[]} data.attachments - Array of file URLs
   * @param {string} operatorId - Staff/Manager ID who created transaction
   * @param {string[]} allowedPumpIds - Pump IDs allowed for operator (null = all for admin)
   * @returns {Object} Created transaction
   */
  async createTransaction(data, operatorId, allowedPumpIds = null) {
    let { pumpId, identifier, amount, liters, category, fuelType, billNumber, paymentMode, attachments, campaignId } = data;

    amount = amount ?? 0;
    category = category ?? 'Fuel';
    paymentMode = paymentMode ?? 'Other';
    billNumber = (billNumber && String(billNumber).trim()) || `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

    // Validate pump access (compare as strings; allowedPumpIds may be ObjectIds)
    const pumpIdStr = String(pumpId);
    if (allowedPumpIds !== null && !allowedPumpIds.map((id) => String(id)).includes(pumpIdStr)) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied to this pump');
    }

    // Verify pump exists
    const pump = await pumpRepository.findById(pumpId);
    if (!pump) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Pump not found');
    }

    // Check duplicate bill number (only when client provided a bill number; generated ones are unique)
    const existing = await transactionRepository.findByPumpAndBillNumber(pumpId, billNumber);
    if (existing) {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'Bill number already exists for this pump');
    }

    // Validate identifier and get user/vehicle
    const { user, vehicle, isOwner } = await scanService.validateIdentifier(identifier);

    // Validate category-specific requirements
    if (category === 'Fuel') {
      if (!liters || liters <= 0) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Liters is required for Fuel transactions');
      }
      if (!attachments || attachments.length === 0) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Attachments are required for Fuel transactions');
      }
    }

    // Find active campaigns for this transaction (liters used for minliters condition, e.g. Fuel)
    const activeCampaigns = await campaignService.findActiveCampaignsForTransaction(
      pumpId,
      category,
      amount,
      category === 'Fuel' ? liters : null
    );

    // Calculate base points (uses SystemConfig: points.fuel.pointsPerLiter, etc.)
    let basePoints = await pointsService.calculatePoints(category, amount, liters, 1);
    let finalPoints = basePoints;
    const appliedCampaignIds = [];

    // Apply all matching campaigns in sequence (e.g. Admin 2x + Manager 1.5x => base * 2 * 1.5)
    for (const campaign of activeCampaigns) {
      appliedCampaignIds.push(campaign._id);
      if (campaign.type === 'multiplier') {
        finalPoints = Math.floor(finalPoints * campaign.multiplier);
      } else if (campaign.type === 'bonusPoints') {
        finalPoints = finalPoints + campaign.bonusPoints;
      } else if (campaign.type === 'bonusPercentage') {
        finalPoints = finalPoints + Math.floor((finalPoints * campaign.bonusPercentage) / 100);
      }
    }

    const pointsEarned = Math.max(0, finalPoints);

    // Create transaction
    const transaction = await transactionRepository.create({
      pumpId,
      vehicleId: vehicle?._id || null,
      userId: user._id,
      operatorId,
      amount,
      liters: category === 'Fuel' ? liters : null,
      category,
      fuelType: category === 'Fuel' && fuelType && ['Petrol', 'Diesel', 'CNG'].includes(fuelType) ? fuelType : null,
      billNumber: String(billNumber).trim(),
      paymentMode,
      pointsEarned,
      campaignId: campaignId || appliedCampaignIds[0] || null,
      campaignIds: appliedCampaignIds.length > 0 ? appliedCampaignIds : undefined,
      status: TRANSACTION_STATUS.COMPLETED,
      attachments: attachments || [],
    });

    // Credit points to user (create ledger entry and update wallet)
    if (pointsEarned > 0) {
      await pointsService.creditPoints({
        userId: user._id,
        points: pointsEarned,
        type: 'credit',
        reason: `Points earned from ${category} transaction`,
        transactionId: transaction._id,
        createdBy: operatorId,
      });
    }

    // Send push notification to customer (pump name from already-fetched pump)
    const pumpName = pump?.name || 'Petrol pump';
    const n = pointsEarned || 0;
    const pointsText = n === 1 ? '1 point' : `${n} points`;
    const customerMessage = `Thank you for Purchasing fuel at ${pumpName}. You earned ${pointsText}.`;
    try {
      await notificationService.sendToUsers(
        [transaction.userId],
        'Transaction successful',
        customerMessage
      );
    } catch (err) {
      console.warn('[Transaction] Push notification to customer failed:', err?.message);
    }

    return transaction;
  },

  /**
   * List transactions with filters and pagination
   * @param {Object} filter - Filter criteria
   * @param {Object} options - Pagination and sorting options
   * @param {string[]} allowedPumpIds - Pump IDs allowed (null = all for admin)
   * @returns {Object} Paginated transaction list
   */
  async listTransactions(filter = {}, options = {}, allowedPumpIds = null) {
    // Apply pump scope: Admin sees all; Manager/Staff only their assigned pumps. If they request a specific pumpId, allow it only if it's in their scope.
    if (allowedPumpIds !== null) {
      const allowedStr = allowedPumpIds.map((id) => String(id));
      if (filter.pumpId) {
        const requested = String(filter.pumpId);
        if (!allowedStr.includes(requested)) {
          filter.pumpId = { $in: allowedPumpIds };
        }
        // else keep filter.pumpId as the requested pump
      } else {
        filter.pumpId = { $in: allowedPumpIds };
      }
    }

    const result = await transactionRepository.list(filter, options);
    result.list = await this._enrichTransactionList(result.list);
    return result;
  },

  /**
   * Resolve operatorId to { operatorName, staffCode } from Staff, Manager, or Admin.
   */
  async _getOperatorDetails(operatorId) {
    if (!operatorId) return { operatorName: null, staffCode: null };
    const staff = await staffRepository.findById(operatorId);
    if (staff) return { operatorName: staff.fullName ?? null, staffCode: staff.staffCode ?? null };
    const manager = await managerRepository.findById(operatorId);
    if (manager) return { operatorName: manager.fullName ?? null, staffCode: manager.managerCode ?? null };
    const admin = await Admin.findById(operatorId).select('name').lean();
    if (admin) return { operatorName: admin.name ?? null, staffCode: null };
    return { operatorName: null, staffCode: null };
  },

  /**
   * Enrich a single transaction with operator (name, staffCode) and pump (pumpName, pumpCode).
   */
  async _enrichTransaction(transaction) {
    if (!transaction) return transaction;
    const [operator, pump] = await Promise.all([
      this._getOperatorDetails(transaction.operatorId),
      transaction.pumpId ? pumpRepository.findById(transaction.pumpId) : null,
    ]);
    return {
      ...transaction,
      operatorName: operator.operatorName,
      staffCode: operator.staffCode,
      pumpName: pump?.name ?? null,
      pumpCode: pump?.code ?? null,
    };
  },

  /**
   * Enrich a list of transactions with operator and pump details (batch).
   */
  async _enrichTransactionList(list) {
    if (!list || list.length === 0) return list;
    const operatorIds = [...new Set(list.map((t) => t.operatorId).filter(Boolean))];
    const pumpIds = [...new Set(list.map((t) => t.pumpId).filter(Boolean))];
    const [staffList, managerList, adminList, pumpList] = await Promise.all([
      operatorIds.length ? staffRepository.listByIds(operatorIds) : [],
      operatorIds.length ? managerRepository.listByIds(operatorIds) : [],
      operatorIds.length ? Admin.find({ _id: { $in: operatorIds } }).select('name').lean() : [],
      pumpIds.length ? pumpRepository.listByIds(pumpIds) : [],
    ]);
    const staffMap = new Map(staffList.map((s) => [String(s._id), { operatorName: s.fullName, staffCode: s.staffCode ?? null }]));
    const managerMap = new Map(managerList.map((m) => [String(m._id), { operatorName: m.fullName, staffCode: m.managerCode ?? null }]));
    const adminMap = new Map(adminList.map((a) => [String(a._id), { operatorName: a.name, staffCode: null }]));
    const pumpMap = new Map(pumpList.map((p) => [String(p._id), { pumpName: p.name, pumpCode: p.code }]));
    return list.map((t) => {
      const opId = t.operatorId ? String(t.operatorId) : null;
      const operator = staffMap.get(opId) ?? managerMap.get(opId) ?? adminMap.get(opId) ?? { operatorName: null, staffCode: null };
      const pump = t.pumpId ? pumpMap.get(String(t.pumpId)) : null;
      return {
        ...t,
        operatorName: operator.operatorName ?? null,
        staffCode: operator.staffCode ?? null,
        pumpName: pump?.pumpName ?? null,
        pumpCode: pump?.pumpCode ?? null,
      };
    });
  },

  /**
   * Get transaction by ID
   * @param {string} transactionId
   * @param {string[]} allowedPumpIds - Pump IDs allowed (null = all for admin)
   * @returns {Object} Transaction
   */
  async getTransactionById(transactionId, allowedPumpIds = null) {
    const transaction = await transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Transaction not found');
    }

    // Check pump access
    if (allowedPumpIds !== null && !allowedPumpIds.map((id) => String(id)).includes(String(transaction.pumpId))) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied to this transaction');
    }

    return this._enrichTransaction(transaction);
  },

  /**
   * Update a transaction (e.g. correct liters/amount). Recalculates points and adjusts user's wallet.
   * Scenario 1: User has not used points – balance is reduced/increased normally.
   * Scenario 2: User already used points – balance can go negative; next fuel purchase will add points and bring it back.
   * @param {string} transactionId - Transaction to update
   * @param {Object} data - { liters?, amount? } at least one required for points change
   * @param {string[]} allowedPumpIds - Pump IDs allowed (null = admin, all pumps)
   * @param {string} operatorId - Admin/Manager/Staff who is making the correction
   * @returns {Object} Updated transaction
   */
  async updateTransaction(transactionId, data, allowedPumpIds, operatorId) {
    const transaction = await transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Transaction not found');
    }
    if (allowedPumpIds !== null && !allowedPumpIds.map((id) => String(id)).includes(String(transaction.pumpId))) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied to this transaction');
    }

    const { liters, amount } = data;
    const updateFields = {};
    if (liters !== undefined) {
      if (transaction.category === 'Fuel' && (liters < 0 || (typeof liters !== 'number' && isNaN(Number(liters))))) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Liters must be a non-negative number');
      }
      updateFields.liters = transaction.category === 'Fuel' ? Number(liters) : null;
    }
    if (amount !== undefined) {
      const num = Number(amount);
      if (num < 0 || isNaN(num)) throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Amount must be a non-negative number');
      updateFields.amount = num;
    }
    if (Object.keys(updateFields).length === 0) {
      return transaction;
    }

    const newLiters = updateFields.liters !== undefined ? updateFields.liters : transaction.liters;
    const newAmount = updateFields.amount !== undefined ? updateFields.amount : transaction.amount;
    const category = transaction.category;
    const newPointsEarned = await pointsService.calculatePoints(category, newAmount, newLiters);
    const oldPointsEarned = transaction.pointsEarned ?? 0;
    updateFields.pointsEarned = Math.max(0, newPointsEarned);

    const updated = await transactionRepository.update(transactionId, updateFields);
    const delta = updated.pointsEarned - oldPointsEarned;
    if (delta !== 0) {
      await pointsService.adjustPointsForTransactionEdit({
        userId: transaction.userId,
        delta,
        transactionId: transaction._id,
        reason: 'Transaction corrected (liters/points updated by operator)',
        createdBy: operatorId,
      });
    }
    return this._enrichTransaction(updated);
  },
};
