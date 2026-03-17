const logger = require('../config/logger');
const { pool } = require('../config/database');

class CommunityRewardsService {
  constructor() {
    this.crfPercentage = 0.10;
  }

  async addCRFContribution(amount, source = 'platform_revenue') {
    try {
      const query = `
        INSERT INTO community_rewards_fund (amount, source, created_at)
        VALUES ($1, $2, NOW())
        RETURNING *
      `;
      
      const result = await pool.query(query, [amount, source]);
      logger.info(`CRF contribution added: $${amount} from ${source}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to add CRF contribution:', error);
      throw error;
    }
  }

  async createTournamentPrize(name, amount, tournamentId) {
    try {
      const query = `
        INSERT INTO tournament_prizes (name, amount, tournament_id, status, created_at)
        VALUES ($1, $2, $3, 'available', NOW())
        RETURNING *
      `;
      
      const result = await pool.query(query, [name, amount, tournamentId]);
      logger.info(`Tournament prize created: ${name} - $${amount}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create tournament prize:', error);
      throw error;
    }
  }

  async getCRFSummary() {
    try {
      const query = `
        SELECT COALESCE(SUM(amount), 0) as total_funds, COUNT(*) as contribution_count
        FROM community_rewards_fund
      `;
      
      const result = await pool.query(query);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get CRF summary:', error);
      throw error;
    }
  }
}

module.exports = CommunityRewardsService;