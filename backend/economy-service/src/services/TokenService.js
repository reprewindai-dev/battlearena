const logger = require('../config/logger');
const WalletService = require('./WalletService');

class TokenService {
  constructor() {
    this.walletService = new WalletService();
  }

  async spendTokens(userId, amount, type, referenceId = null, description = null, recipientId = null) {
    const { pool } = require('../config/database');
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Validate balance
      const validation = await this.walletService.validateBalance(userId, 'tokens', amount);
      if (!validation.sufficient) {
        throw new Error(`Insufficient token balance. Required: ${amount}, Available: ${validation.currentBalance}`);
      }
      
      // Update wallet (subtract tokens)
      const walletUpdate = await this.walletService.updateBalance(
        userId,
        'tokens',
        amount,
        'subtract',
        referenceId,
        description || `${type} - ${amount} tokens`
      );
      
      // Create token spending record
      const spendQuery = `
        INSERT INTO token_spending (
          user_id, amount, type, reference_id, description, recipient_id, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *
      `;
      
      const spendResult = await client.query(spendQuery, [
        userId,
        amount,
        type,
        referenceId,
        description,
        recipientId,
        'completed'
      ]);
      
      // If there's a recipient, add tokens to their wallet (for tips/gifts)
      if (recipientId && recipientId !== userId) {
        await this.walletService.updateBalance(
          recipientId,
          'tokens',
          amount,
          'add',
          referenceId,
          `Received ${type} - ${amount} tokens`
        );
        
        // Record receipt
        const receiptQuery = `
          INSERT INTO token_receipts (
            user_id, amount, type, reference_id, description, sender_id, status, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          RETURNING *
        `;
        
        await client.query(receiptQuery, [
          recipientId,
          amount,
          type,
          referenceId,
          description,
          userId,
          'completed'
        ]);
        
        // Distribute points to creator (90% of token value)
        const pointsEarned = Math.round(amount * 0.9); // 1 token = $0.01, 90% to creator
        await this.walletService.updateBalance(
          recipientId,
          'points',
          pointsEarned,
          'add',
          `creator_earnings_${referenceId}`,
          `Creator earnings from ${type} - ${amount} tokens`
        );
        
        // Add 10% to Community Rewards Fund
        const platformShare = Math.round(amount * 0.1);
        await this.addToCommunityRewardsFund(platformShare, referenceId, type);
      }
      
      await client.query('COMMIT');
      
      logger.info(`Tokens spent: userId=${userId}, amount=${amount}, type=${type}, recipient=${recipientId}`);
      
      return {
        walletUpdate,
        spending: spendResult.rows[0]
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to spend tokens:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async tipCreator(userId, creatorId, amount, battleId = null, description = null) {
    try {
      // Validate tip amount
      if (amount < 1) {
        throw new Error('Minimum tip amount is 1 token');
      }
      
      if (amount > 10000) {
        throw new Error('Maximum tip amount is 10,000 tokens');
      }
      
      // Create tip reference
      const referenceId = `tip_${Date.now()}_${userId}`;
      const tipDescription = description || `Tip to creator - ${amount} tokens`;
      
      // Spend tokens (this will automatically add to creator's wallet)
      const result = await this.spendTokens(
        userId,
        amount,
        'tip',
        referenceId,
        tipDescription,
        creatorId
      );
      
      // Record tip-specific details
      const { pool } = require('../config/database');
      const tipQuery = `
        INSERT INTO creator_tips (
          user_id, creator_id, amount, battle_id, reference_id, description, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `;
      
      const tipResult = await pool.query(tipQuery, [
        userId,
        creatorId,
        amount,
        battleId,
        referenceId,
        tipDescription
      ]);
      
      logger.info(`Creator tipped: userId=${userId}, creatorId=${creatorId}, amount=${amount}, battleId=${battleId}`);
      
      return {
        ...result,
        tip: tipResult.rows[0]
      };
      
    } catch (error) {
      logger.error('Failed to tip creator:', error);
      throw error;
    }
  }

  async payEntryFee(userId, battleId, amount) {
    try {
      // Validate entry fee
      if (amount < 0) {
        throw new Error('Entry fee cannot be negative');
      }
      
      // Create entry fee reference
      const referenceId = `entry_${battleId}_${userId}`;
      const description = `Battle entry fee - ${amount} tokens`;
      
      // Spend tokens
      const result = await this.spendTokens(
        userId,
        amount,
        'entry_fee',
        referenceId,
        description,
        null
      );
      
      // Record battle entry
      const { pool } = require('../config/database');
      const entryQuery = `
        INSERT INTO battle_entries (
          user_id, battle_id, entry_fee, reference_id, created_at
        ) VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `;
      
      const entryResult = await pool.query(entryQuery, [
        userId,
        battleId,
        amount,
        referenceId
      ]);
      
      logger.info(`Battle entry fee paid: userId=${userId}, battleId=${battleId}, amount=${amount}`);
      
      return {
        ...result,
        entry: entryResult.rows[0]
      };
      
    } catch (error) {
      logger.error('Failed to pay entry fee:', error);
      throw error;
    }
  }

  async purchaseItem(userId, itemId, itemType, amount, description = null) {
    try {
      // Validate purchase amount
      if (amount < 1) {
        throw new Error('Minimum purchase amount is 1 token');
      }
      
      // Create purchase reference
      const referenceId = `purchase_${itemId}_${userId}`;
      const purchaseDescription = description || `Purchased ${itemType} - ${amount} tokens`;
      
      // Spend tokens
      const result = await this.spendTokens(
        userId,
        amount,
        'purchase',
        referenceId,
        purchaseDescription,
        null
      );
      
      // Record item purchase
      const { pool } = require('../config/database');
      const purchaseQuery = `
        INSERT INTO item_purchases (
          user_id, item_id, item_type, amount, reference_id, description, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `;
      
      const purchaseResult = await pool.query(purchaseQuery, [
        userId,
        itemId,
        itemType,
        amount,
        referenceId,
        purchaseDescription
      ]);
      
      logger.info(`Item purchased: userId=${userId}, itemId=${itemId}, itemType=${itemType}, amount=${amount}`);
      
      return {
        ...result,
        purchase: purchaseResult.rows[0]
      };
      
    } catch (error) {
      logger.error('Failed to purchase item:', error);
      throw error;
    }
  }

  async getSpendingHistory(userId, options = {}) {
    try {
      const {
        type = null,
        limit = 50,
        offset = 0,
        startDate = null,
        endDate = null
      } = options;
      
      const { pool } = require('../config/database');
      
      let query = `
        SELECT ts.*, u.username as recipient_username
        FROM token_spending ts
        LEFT JOIN users u ON ts.recipient_id = u.id
        WHERE ts.user_id = $1
      `;
      
      const params = [userId];
      let paramIndex = 2;
      
      if (type) {
        query += ` AND ts.type = $${paramIndex++}`;
        params.push(type);
      }
      
      if (startDate) {
        query += ` AND ts.created_at >= $${paramIndex++}`;
        params.push(startDate);
      }
      
      if (endDate) {
        query += ` AND ts.created_at <= $${paramIndex++}`;
        params.push(endDate);
      }
      
      query += `
        ORDER BY ts.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      
      params.push(limit, offset);
      
      const result = await pool.query(query, params);
      
      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total
        FROM token_spending
        WHERE user_id = $1
      `;
      
      const countParams = [userId];
      let countParamIndex = 2;
      
      if (type) {
        countQuery += ` AND type = $${countParamIndex++}`;
        countParams.push(type);
      }
      
      if (startDate) {
        countQuery += ` AND created_at >= $${countParamIndex++}`;
        countParams.push(startDate);
      }
      
      if (endDate) {
        countQuery += ` AND created_at <= $${countParamIndex++}`;
        countParams.push(endDate);
      }
      
      const countResult = await pool.query(countQuery, countParams);
      
      return {
        spending: result.rows,
        total: parseInt(countResult.rows[0].total),
        limit,
        offset
      };
      
    } catch (error) {
      logger.error('Failed to get spending history:', error);
      throw error;
    }
  }

  async getReceiptHistory(userId, options = {}) {
    try {
      const {
        type = null,
        limit = 50,
        offset = 0,
        startDate = null,
        endDate = null
      } = options;
      
      const { pool } = require('../config/database');
      
      let query = `
        SELECT tr.*, u.username as sender_username
        FROM token_receipts tr
        LEFT JOIN users u ON tr.sender_id = u.id
        WHERE tr.user_id = $1
      `;
      
      const params = [userId];
      let paramIndex = 2;
      
      if (type) {
        query += ` AND tr.type = $${paramIndex++}`;
        params.push(type);
      }
      
      if (startDate) {
        query += ` AND tr.created_at >= $${paramIndex++}`;
        params.push(startDate);
      }
      
      if (endDate) {
        query += ` AND tr.created_at <= $${paramIndex++}`;
        params.push(endDate);
      }
      
      query += `
        ORDER BY tr.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      
      params.push(limit, offset);
      
      const result = await pool.query(query, params);
      
      return {
        receipts: result.rows,
        limit,
        offset
      };
      
    } catch (error) {
      logger.error('Failed to get receipt history:', error);
      throw error;
    }
  }

  async getSpendingStats(userId, period = '30d') {
    try {
      const { pool } = require('../config/database');
      
      let interval;
      switch (period) {
        case '7d':
          interval = "7 days";
          break;
        case '30d':
          interval = "30 days";
          break;
        case '90d':
          interval = "90 days";
          break;
        default:
          interval = "30 days";
      }
      
      // Total spending by type
      const spendingByTypeQuery = `
        SELECT 
          type,
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as total_amount
        FROM token_spending
        WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '${interval}'
        GROUP BY type
        ORDER BY total_amount DESC
      `;
      
      const spendingByTypeResult = await pool.query(spendingByTypeQuery, [userId]);
      
      // Daily spending trend
      const dailySpendingQuery = `
        SELECT 
          DATE(created_at) as date,
          COALESCE(SUM(amount), 0) as daily_total
        FROM token_spending
        WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '${interval}'
        GROUP BY DATE(created_at)
        ORDER BY date
      `;
      
      const dailySpendingResult = await pool.query(dailySpendingQuery, [userId]);
      
      // Top recipients (for tips/gifts)
      const topRecipientsQuery = `
        SELECT 
          recipient_id,
          u.username,
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as total_received
        FROM token_spending ts
        LEFT JOIN users u ON ts.recipient_id = u.id
        WHERE ts.user_id = $1 AND ts.recipient_id IS NOT NULL 
          AND ts.created_at >= NOW() - INTERVAL '${interval}'
        GROUP BY recipient_id, u.username
        ORDER BY total_received DESC
        LIMIT 10
      `;
      
      const topRecipientsResult = await pool.query(topRecipientsQuery, [userId]);
      
      return {
        period,
        spendingByType: spendingByTypeResult.rows,
        dailySpending: dailySpendingResult.rows,
        topRecipients: topRecipientsResult.rows
      };
      
    } catch (error) {
      logger.error('Failed to get spending stats:', error);
      throw error;
    }
  }

  async addToCommunityRewardsFund(amount, referenceId, type) {
    try {
      const { pool } = require('../config/database');
      
      const query = `
        INSERT INTO community_rewards_fund (amount, source, metadata, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING *
      `;
      
      const metadata = JSON.stringify({
        referenceId,
        type,
        timestamp: new Date().toISOString()
      });
      
      await pool.query(query, [amount * 0.01, 'token_spending', metadata]); // Convert tokens to USD
      
      logger.info(`CRF contribution: $${(amount * 0.01).toFixed(2)} from ${type} (${referenceId})`);
      
    } catch (error) {
      logger.error('Failed to add to CRF:', error);
      // Don't throw error to avoid breaking the main transaction
    }
  }

  async validateSpending(userId, amount, type) {
    try {
      // Check balance
      const validation = await this.walletService.validateBalance(userId, 'tokens', amount);
      
      if (!validation.sufficient) {
        return {
          valid: false,
          reason: 'Insufficient balance',
          currentBalance: validation.currentBalance,
          requiredAmount: validation.requiredAmount,
          shortfall: validation.shortfall
        };
      }
      
      // Check spending limits
      const { pool } = require('../config/database');
      const dailyLimitQuery = `
        SELECT COALESCE(SUM(amount), 0) as daily_total
        FROM token_spending
        WHERE user_id = $1 AND DATE(created_at) = CURRENT_DATE
      `;
      
      const dailyLimitResult = await pool.query(dailyLimitQuery, [userId]);
      const dailyTotal = parseFloat(dailyLimitResult.rows[0].daily_total);
      
      // Define limits by type
      const limits = {
        tip: { daily: 5000, transaction: 1000 },
        entry_fee: { daily: 10000, transaction: 5000 },
        purchase: { daily: 2000, transaction: 500 }
      };
      
      const limit = limits[type] || { daily: 1000, transaction: 100 };
      
      if (amount > limit.transaction) {
        return {
          valid: false,
          reason: `Transaction limit exceeded. Maximum: ${limit.transaction} tokens`,
          limit: limit.transaction
        };
      }
      
      if (dailyTotal + amount > limit.daily) {
        return {
          valid: false,
          reason: `Daily limit exceeded. Daily limit: ${limit.daily} tokens, Already spent: ${dailyTotal} tokens`,
          dailyLimit: limit.daily,
          dailySpent: dailyTotal
        };
      }
      
      return {
        valid: true,
        currentBalance: validation.currentBalance,
        dailySpent: dailyTotal,
        dailyLimit: limit.daily
      };
      
    } catch (error) {
      logger.error('Failed to validate spending:', error);
      throw error;
    }
  }
}

module.exports = TokenService;
