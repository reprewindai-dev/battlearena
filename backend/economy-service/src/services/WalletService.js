const { Pool } = require('../config/database');
const logger = require('../config/logger');

class WalletService {
  constructor() {
    this.pool = Pool;
  }

  async getWallet(userId) {
    try {
      const query = `
        SELECT w.*, u.email, u.username
        FROM wallets w
        JOIN users u ON w.user_id = u.id
        WHERE w.user_id = $1
      `;
      
      const result = await this.pool.query(query, [userId]);
      
      if (result.rows.length === 0) {
        // Create wallet if it doesn't exist
        await this.createWallet(userId);
        return await this.getWallet(userId);
      }
      
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get wallet:', error);
      throw error;
    }
  }

  async createWallet(userId) {
    try {
      const query = `
        INSERT INTO wallets (user_id, crowns_balance, tokens_balance, points_balance, created_at, updated_at)
        VALUES ($1, 0, 0, 0, NOW(), NOW())
        RETURNING *
      `;
      
      const result = await this.pool.query(query, [userId]);
      logger.info(`Created wallet for user: ${userId}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create wallet:', error);
      throw error;
    }
  }

  async updateBalance(userId, currency, amount, operation, referenceId = null, description = null) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get current balance
      const balanceQuery = `
        SELECT crowns_balance, tokens_balance, points_balance, version
        FROM wallets
        WHERE user_id = $1
        FOR UPDATE
      `;
      
      const balanceResult = await client.query(balanceQuery, [userId]);
      
      if (balanceResult.rows.length === 0) {
        throw new Error('Wallet not found');
      }
      
      const wallet = balanceResult.rows[0];
      const currentBalance = wallet[`${currency}_balance`];
      
      // Calculate new balance
      let newBalance;
      if (operation === 'add') {
        newBalance = parseFloat(currentBalance) + parseFloat(amount);
      } else if (operation === 'subtract') {
        newBalance = parseFloat(currentBalance) - parseFloat(amount);
        if (newBalance < 0) {
          throw new Error('Insufficient balance');
        }
      } else {
        throw new Error('Invalid operation');
      }
      
      // Update wallet with optimistic locking
      const updateQuery = `
        UPDATE wallets 
        SET ${currency}_balance = $1,
            updated_at = NOW(),
            version = version + 1
        WHERE user_id = $2 AND version = $3
        RETURNING *
      `;
      
      const updateResult = await client.query(updateQuery, [newBalance, userId, wallet.version]);
      
      if (updateResult.rows.length === 0) {
        throw new Error('Wallet update failed - version conflict');
      }
      
      // Create audit log entry
      const auditQuery = `
        INSERT INTO wallet_audit_logs (
          user_id, currency, amount, operation, previous_balance, new_balance,
          reference_id, description, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *
      `;
      
      const auditResult = await client.query(auditQuery, [
        userId, currency, amount, operation, currentBalance, newBalance,
        referenceId, description
      ]);
      
      await client.query('COMMIT');
      
      logger.info(`Wallet balance updated: userId=${userId}, currency=${currency}, amount=${amount}, operation=${operation}, newBalance=${newBalance}`);
      
      return {
        wallet: updateResult.rows[0],
        auditLog: auditResult.rows[0]
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to update balance:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getTransactionHistory(userId, options = {}) {
    try {
      const {
        currency = null,
        operation = null,
        limit = 50,
        offset = 0,
        startDate = null,
        endDate = null
      } = options;
      
      let query = `
        SELECT *
        FROM wallet_audit_logs
        WHERE user_id = $1
      `;
      
      const params = [userId];
      let paramIndex = 2;
      
      if (currency) {
        query += ` AND currency = $${paramIndex++}`;
        params.push(currency);
      }
      
      if (operation) {
        query += ` AND operation = $${paramIndex++}`;
        params.push(operation);
      }
      
      if (startDate) {
        query += ` AND created_at >= $${paramIndex++}`;
        params.push(startDate);
      }
      
      if (endDate) {
        query += ` AND created_at <= $${paramIndex++}`;
        params.push(endDate);
      }
      
      query += `
        ORDER BY created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      
      params.push(limit, offset);
      
      const result = await this.pool.query(query, params);
      
      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total
        FROM wallet_audit_logs
        WHERE user_id = $1
      `;
      
      const countParams = [userId];
      let countParamIndex = 2;
      
      if (currency) {
        countQuery += ` AND currency = $${countParamIndex++}`;
        countParams.push(currency);
      }
      
      if (operation) {
        countQuery += ` AND operation = $${countParamIndex++}`;
        countParams.push(operation);
      }
      
      if (startDate) {
        countQuery += ` AND created_at >= $${countParamIndex++}`;
        countParams.push(startDate);
      }
      
      if (endDate) {
        countQuery += ` AND created_at <= $${countParamIndex++}`;
        countParams.push(endDate);
      }
      
      const countResult = await this.pool.query(countQuery, countParams);
      
      return {
        transactions: result.rows,
        total: parseInt(countResult.rows[0].total),
        limit,
        offset
      };
      
    } catch (error) {
      logger.error('Failed to get transaction history:', error);
      throw error;
    }
  }

  async getBalanceSnapshot(userId) {
    try {
      const query = `
        SELECT 
          crowns_balance,
          tokens_balance,
          points_balance,
          updated_at
        FROM wallets
        WHERE user_id = $1
      `;
      
      const result = await this.pool.query(query, [userId]);
      
      if (result.rows.length === 0) {
        throw new Error('Wallet not found');
      }
      
      const wallet = result.rows[0];
      
      // Get recent activity summary
      const activityQuery = `
        SELECT 
          currency,
          operation,
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as total_amount
        FROM wallet_audit_logs
        WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY currency, operation
      `;
      
      const activityResult = await this.pool.query(activityQuery, [userId]);
      
      return {
        balances: {
          crowns: parseFloat(wallet.crowns_balance),
          tokens: parseFloat(wallet.tokens_balance),
          points: parseFloat(wallet.points_balance)
        },
        lastUpdated: wallet.updated_at,
        recentActivity: activityResult.rows
      };
      
    } catch (error) {
      logger.error('Failed to get balance snapshot:', error);
      throw error;
    }
  }

  async validateBalance(userId, currency, requiredAmount) {
    try {
      const wallet = await this.getWallet(userId);
      const currentBalance = parseFloat(wallet[`${currency}_balance`]);
      
      return {
        sufficient: currentBalance >= requiredAmount,
        currentBalance,
        requiredAmount,
        shortfall: Math.max(0, requiredAmount - currentBalance)
      };
      
    } catch (error) {
      logger.error('Failed to validate balance:', error);
      throw error;
    }
  }

  async getTotalCirculation() {
    try {
      const query = `
        SELECT 
          SUM(crowns_balance) as total_crowns,
          SUM(tokens_balance) as total_tokens,
          SUM(points_balance) as total_points,
          COUNT(*) as total_wallets
        FROM wallets
      `;
      
      const result = await this.pool.query(query);
      return result.rows[0];
      
    } catch (error) {
      logger.error('Failed to get total circulation:', error);
      throw error;
    }
  }
}

module.exports = WalletService;
