import { transactionRepository } from '../repositories/transaction.repository.js';
import { scanService } from './scan.service.js';
import { pointsService } from './points.service.js';
import { campaignService } from './campaign.service.js';
import { pumpRepository } from '../repositories/pump.repository.js';
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
    let { pumpId, identifier, amount, liters, category, billNumber, paymentMode, attachments, campaignId } = data;

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

    // Find active campaigns for this transaction
    const activeCampaigns = await campaignService.findActiveCampaignsForTransaction(
      pumpId,
      category,
      amount
    );

    // Calculate base points (uses SystemConfig: points.fuel.pointsPerLiter, etc.)
    let basePoints = await pointsService.calculatePoints(category, amount, liters, 1);
    let finalPoints = basePoints;
    let appliedCampaignId = null;

    // Apply campaign (use first matching campaign)
    if (activeCampaigns.length > 0) {
      const campaign = activeCampaigns[0];
      appliedCampaignId = campaign._id;

      if (campaign.type === 'multiplier') {
        finalPoints = Math.floor(basePoints * campaign.multiplier);
      } else if (campaign.type === 'bonusPoints') {
        finalPoints = basePoints + campaign.bonusPoints;
      } else if (campaign.type === 'bonusPercentage') {
        const bonus = Math.floor((basePoints * campaign.bonusPercentage) / 100);
        finalPoints = basePoints + bonus;
      }
    }

    const pointsEarned = finalPoints;

    // Create transaction
    const transaction = await transactionRepository.create({
      pumpId,
      vehicleId: vehicle?._id || null,
      userId: user._id,
      operatorId,
      amount,
      liters: category === 'Fuel' ? liters : null,
      category,
      billNumber: String(billNumber).trim(),
      paymentMode,
      pointsEarned,
      campaignId: campaignId || appliedCampaignId || null,
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

    return transactionRepository.list(filter, options);
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

    return transaction;
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
    return updated;
  },
};
