import SystemConfig from '../models/SystemConfig.model.js';

/**
 * SystemConfig repository - data access only.
 * Uses singleton pattern (only one config document).
 */
export const systemConfigRepository = {
  async getConfig() {
    return SystemConfig.getConfig();
  },

  async updateConfig(data) {
    const config = await SystemConfig.getConfig();
    Object.assign(config, data);
    await config.save();
    return config;
  },
};
