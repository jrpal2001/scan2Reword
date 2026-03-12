import { onboardingRepository } from '../repositories/onboarding.repository.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

export const onboardingService = {
  async create(data) {
    return onboardingRepository.create(data);
  },

  /** Create one onboarding doc with onboardImage array (from multipart upload). */
  async createWithImages(urls) {
    if (!urls?.length) return null;
    return onboardingRepository.createWithImages(urls);
  },

  async list(filter = {}, options = {}) {
    return onboardingRepository.list(filter, options);
  },

  async getById(id) {
    const item = await onboardingRepository.findById(id);
    if (!item) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Onboarding item not found');
    }
    return item;
  },

  async update(id, data) {
    const item = await onboardingRepository.findById(id);
    if (!item) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Onboarding item not found');
    }
    return onboardingRepository.update(id, data);
  },

  async delete(id) {
    const item = await onboardingRepository.findById(id);
    if (!item) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Onboarding item not found');
    }
    await onboardingRepository.delete(id);
    return { deleted: true };
  },

  /** Public: list all onboarding images, sorted by createdAt. */
  async listActive(limit = 20) {
    return onboardingRepository.listActive(limit);
  },
};
