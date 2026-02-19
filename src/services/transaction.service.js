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
    const { pumpId, identifier, amount, liters, category, billNumber, paymentMode, attachments, campaignId } = data;

    // Validate pump access
    if (allowedPumpIds !== null && !allowedPumpIds.includes(String(pumpId))) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied to this pump');
    }

    // Verify pump exists
    const pump = await pumpRepository.findById(pumpId);
    if (!pump) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Pump not found');
    }

    // Check duplicate bill number
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

    // Calculate base points
    let basePoints = pointsService.calculatePoints(category, amount, liters, 1);
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
      billNumber: billNumber.trim(),
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
    // Apply pump scope for manager/staff
    if (allowedPumpIds !== null) {
      filter.pumpId = { $in: allowedPumpIds };
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
    if (allowedPumpIds !== null && !allowedPumpIds.includes(String(transaction.pumpId))) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied to this transaction');
    }

    return transaction;
  },
};
