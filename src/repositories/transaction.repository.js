import Transaction from '../models/Transaction.model.js';

/**
 * Transaction repository - data access only.
 */
export const transactionRepository = {
  async create(data) {
    const transaction = await Transaction.create(data);
    return transaction;
  },

  async findById(id) {
    return Transaction.findById(id).lean();
  },

  async findByPumpAndBillNumber(pumpId, billNumber) {
    return Transaction.findOne({ pumpId, billNumber: billNumber?.trim() }).lean();
  },

  async list(filter = {}, options = {}) {
    const { page = 1, limit = 20, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      Transaction.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Transaction.countDocuments(filter),
    ]);
    return { list, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async update(id, data) {
    const transaction = await Transaction.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
    return transaction;
  },
};
