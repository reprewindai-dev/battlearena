const logger = require('../config/logger');
const { pool } = require('../config/database');

class SubscriptionService {
  constructor() {
    this.tiers = {
      basic: { price: 4.99, stipend: 50 },
      plus: { price: 9.99, stipend: 150 },
      creator: { price: 19.99, stipend: 300 }
    };
  }

  async createSubscription(userId, tier, paymentMethodId) {
    try {
      const tierConfig = this.tiers[tier];
      if (!tierConfig) {
        throw new Error('Invalid subscription tier');
      }

      const query = `
        INSERT INTO user_subscriptions (
          user_id, tier, status, monthly_price, token_stipend,
          current_period_start, current_period_end, features, created_at
        ) VALUES ($1, $2, 'active', $3, $4, NOW(), NOW() + INTERVAL '1 month', $5, NOW())
        RETURNING *
      `;

      const features = this.getTierFeatures(tier);
      const result = await pool.query(query, [
        userId,
        tier,
        tierConfig.price,
        tierConfig.stipend,
        JSON.stringify(features)
      ]);

      // Grant initial token stipend
      await this.grantTokenStipend(userId, tierConfig.stipend, result.rows[0].id);

      logger.info(`Subscription created: ${tier} for user ${userId}`);
      return result.rows[0];

    } catch (error) {
      logger.error('Failed to create subscription:', error);
      throw error;
    }
  }

  async cancelSubscription(userId, subscriptionId) {
    try {
      const query = `
        UPDATE user_subscriptions
        SET status = 'canceled', canceled_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND user_id = $2 AND status = 'active'
        RETURNING *
      `;

      const result = await pool.query(query, [subscriptionId, userId]);

      if (result.rows.length === 0) {
        throw new Error('Subscription not found or already canceled');
      }

      logger.info(`Subscription canceled: ${subscriptionId} for user ${userId}`);
      return result.rows[0];

    } catch (error) {
      logger.error('Failed to cancel subscription:', error);
      throw error;
    }
  }

  async grantTokenStipend(userId, amount, subscriptionId) {
    try {
      const { WalletService } = require('./WalletService');
      const walletService = new WalletService();

      await walletService.updateBalance(
        userId,
        'tokens',
        amount,
        'add',
        `subscription_stipend_${subscriptionId}`,
        `Monthly subscription stipend`
      );

      logger.info(`Token stipend granted: ${amount} tokens to user ${userId}`);

    } catch (error) {
      logger.error('Failed to grant token stipend:', error);
      throw error;
    }
  }

  async processMonthlyStipends() {
    try {
      const query = `
        SELECT * FROM user_subscriptions
        WHERE status = 'active' 
        AND current_period_end <= NOW()
        AND current_period_end > NOW() - INTERVAL '1 day'
      `;

      const result = await pool.query(query);

      for (const subscription of result.rows) {
        try {
          // Renew subscription period
          await this.renewSubscription(subscription.id);
          
          // Grant new stipend
          await this.grantTokenStipend(
            subscription.user_id,
            subscription.token_stipend,
            subscription.id
          );

        } catch (error) {
          logger.error(`Failed to process stipend for subscription ${subscription.id}:`, error);
        }
      }

      logger.info(`Processed ${result.rows.length} monthly stipends`);

    } catch (error) {
      logger.error('Failed to process monthly stipends:', error);
      throw error;
    }
  }

  async renewSubscription(subscriptionId) {
    try {
      const query = `
        UPDATE user_subscriptions
        SET current_period_start = NOW(),
            current_period_end = NOW() + INTERVAL '1 month',
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await pool.query(query, [subscriptionId]);
      return result.rows[0];

    } catch (error) {
      logger.error('Failed to renew subscription:', error);
      throw error;
    }
  }

  getTierFeatures(tier) {
    const features = {
      basic: ['ad_light', 'limited_replay', 'profile_customization'],
      plus: ['no_ads', 'full_replay', 'advanced_analytics', 'priority_tournament'],
      creator: ['all_plus', 'creator_tools', 'promotion', 'direct_support']
    };

    return features[tier] || [];
  }

  async getUserSubscription(userId) {
    try {
      const query = `
        SELECT * FROM user_subscriptions
        WHERE user_id = $1 AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const result = await pool.query(query, [userId]);
      return result.rows[0] || null;

    } catch (error) {
      logger.error('Failed to get user subscription:', error);
      throw error;
    }
  }
}

module.exports = SubscriptionService;
