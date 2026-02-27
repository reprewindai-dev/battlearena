const logger = require('../config/logger');
const WalletService = require('./WalletService');

class PayoutService {
  constructor() {
    this.walletService = new WalletService();
  }

  async createPayoutRequest(userId, amount, payoutMethod, payoutDetails) {
    const { pool } = require('../config/database');
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Validate payout amount
      if (amount < 10) {
        throw new Error('Minimum payout amount is $10');
      }
      
      if (amount > 10000) {
        throw new Error('Maximum payout amount is $10,000');
      }
      
      // Calculate required points (1 point = $1)
      const requiredPoints = Math.round(amount * 100);
      
      // Validate user has sufficient points
      const validation = await this.walletService.validateBalance(userId, 'points', requiredPoints);
      if (!validation.sufficient) {
        throw new Error(`Insufficient points. Required: ${requiredPoints}, Available: ${validation.currentBalance}`);
      }
      
      // Check for pending payouts
      const pendingQuery = `
        SELECT COUNT(*) as pending_count
        FROM payout_requests
        WHERE user_id = $1 AND status IN ('pending', 'processing')
      `;
      
      const pendingResult = await client.query(pendingQuery, [userId]);
      const pendingCount = parseInt(pendingResult.rows[0].pending_count);
      
      if (pendingCount >= 3) {
        throw new Error('Maximum number of pending payouts reached');
      }
      
      // Create payout request
      const payoutQuery = `
        INSERT INTO payout_requests (
          user_id, amount_usd, points_used, payout_method, payout_details,
          status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), NOW())
        RETURNING *
      `;
      
      const payoutResult = await client.query(payoutQuery, [
        userId,
        amount,
        requiredPoints,
        payoutMethod,
        JSON.stringify(payoutDetails)
      ]);
      
      const payoutRequest = payoutResult.rows[0];
      
      // Hold points (subtract from wallet but keep in escrow)
      await this.walletService.updateBalance(
        userId,
        'points',
        requiredPoints,
        'subtract',
        `payout_${payoutRequest.id}`,
        `Payout request - $${amount} (${requiredPoints} points held in escrow)`
      );
      
      // Create escrow record
      const escrowQuery = `
        INSERT INTO payout_escrow (
          payout_request_id, user_id, points_held, amount_usd, status, created_at
        ) VALUES ($1, $2, $3, $4, 'held', NOW())
        RETURNING *
      `;
      
      await client.query(escrowQuery, [
        payoutRequest.id,
        userId,
        requiredPoints,
        amount
      ]);
      
      await client.query('COMMIT');
      
      logger.info(`Payout request created: userId=${userId}, amount=$${amount}, points=${requiredPoints}, method=${payoutMethod}`);
      
      return payoutRequest;
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create payout request:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async approvePayoutRequest(payoutRequestId, adminId, notes = null) {
    const { pool } = require('../config/database');
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get payout request
      const payoutQuery = `
        SELECT pr.*, u.email, u.username
        FROM payout_requests pr
        JOIN users u ON pr.user_id = u.id
        WHERE pr.id = $1 AND pr.status = 'pending'
      `;
      
      const payoutResult = await client.query(payoutQuery, [payoutRequestId]);
      
      if (payoutResult.rows.length === 0) {
        throw new Error('Payout request not found or not in pending status');
      }
      
      const payoutRequest = payoutResult.rows[0];
      
      // Update payout request status
      const updateQuery = `
        UPDATE payout_requests
        SET status = 'approved', 
            approved_by = $2,
            approved_at = NOW(),
            admin_notes = $3,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      
      const updateResult = await client.query(updateQuery, [
        payoutRequestId,
        adminId,
        notes
      ]);
      
      // Process the actual payout (would integrate with payment provider)
      const payoutProcessed = await this.processPayout(payoutRequest);
      
      // Update status to completed if successful
      if (payoutProcessed.success) {
        const completeQuery = `
          UPDATE payout_requests
          SET status = 'completed',
              completed_at = NOW(),
              provider_transaction_id = $2,
              updated_at = NOW()
          WHERE id = $1
        `;
        
        await client.query(completeQuery, [
          payoutRequestId,
          payoutProcessed.transactionId
        ]);
        
        // Release escrow (points are permanently deducted)
        const releaseEscrowQuery = `
          UPDATE payout_escrow
          SET status = 'released', released_at = NOW()
          WHERE payout_request_id = $1
        `;
        
        await client.query(releaseEscrowQuery, [payoutRequestId]);
      } else {
        // If payout fails, return points to user
        await this.walletService.updateBalance(
          payoutRequest.user_id,
          'points',
          payoutRequest.points_used,
          'add',
          `payout_refund_${payoutRequestId}`,
          `Payout failed - points returned`
        );
        
        // Update escrow status
        const refundEscrowQuery = `
          UPDATE payout_escrow
          SET status = 'refunded', refunded_at = NOW()
          WHERE payout_request_id = $1
        `;
        
        await client.query(refundEscrowQuery, [payoutRequestId]);
        
        // Update payout request status
        const failQuery = `
          UPDATE payout_requests
          SET status = 'failed',
              failure_reason = $2,
              updated_at = NOW()
          WHERE id = $1
        `;
        
        await client.query(failQuery, [
          payoutRequestId,
          payoutProcessed.error
        ]);
      }
      
      await client.query('COMMIT');
      
      logger.info(`Payout request processed: requestId=${payoutRequestId}, status=${payoutProcessed.success ? 'completed' : 'failed'}`);
      
      return {
        payoutRequest: updateResult.rows[0],
        processed: payoutProcessed
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to approve payout request:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async rejectPayoutRequest(payoutRequestId, adminId, reason) {
    const { pool } = require('../config/database');
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get payout request
      const payoutQuery = `
        SELECT * FROM payout_requests
        WHERE id = $1 AND status = 'pending'
      `;
      
      const payoutResult = await client.query(payoutQuery, [payoutRequestId]);
      
      if (payoutResult.rows.length === 0) {
        throw new Error('Payout request not found or not in pending status');
      }
      
      const payoutRequest = payoutResult.rows[0];
      
      // Update payout request status
      const updateQuery = `
        UPDATE payout_requests
        SET status = 'rejected', 
            rejected_by = $2,
            rejected_at = NOW(),
            rejection_reason = $3,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      
      await client.query(updateQuery, [
        payoutRequestId,
        adminId,
        reason
      ]);
      
      // Return points to user
      await this.walletService.updateBalance(
        payoutRequest.user_id,
        'points',
        payoutRequest.points_used,
        'add',
        `payout_refund_${payoutRequestId}`,
        `Payout rejected - points returned: ${reason}`
      );
      
      // Update escrow status
      const refundEscrowQuery = `
        UPDATE payout_escrow
        SET status = 'refunded', refunded_at = NOW()
        WHERE payout_request_id = $1
      `;
      
      await client.query(refundEscrowQuery, [payoutRequestId]);
      
      await client.query('COMMIT');
      
      logger.info(`Payout request rejected: requestId=${payoutRequestId}, reason=${reason}`);
      
      return payoutRequest;
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to reject payout request:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async processPayout(payoutRequest) {
    try {
      // This would integrate with actual payment providers (Stripe, PayPal, etc.)
      // For now, we'll simulate the process
      
      const payoutDetails = JSON.parse(payoutRequest.payout_details);
      
      switch (payoutRequest.payout_method) {
        case 'stripe':
          return await this.processStripePayout(payoutRequest, payoutDetails);
        case 'paypal':
          return await this.processPayPalPayout(payoutRequest, payoutDetails);
        case 'bank_transfer':
          return await this.processBankTransferPayout(payoutRequest, payoutDetails);
        default:
          throw new Error('Unsupported payout method');
      }
      
    } catch (error) {
      logger.error('Failed to process payout:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async processStripePayout(payoutRequest, payoutDetails) {
    try {
      // In production, this would use Stripe Connect or Transfers API
      // For now, simulate successful payout
      
      const transactionId = `stripe_payout_${Date.now()}_${payoutRequest.id}`;
      
      logger.info(`Stripe payout processed: requestId=${payoutRequest.id}, transactionId=${transactionId}`);
      
      return {
        success: true,
        transactionId,
        provider: 'stripe'
      };
      
    } catch (error) {
      logger.error('Failed to process Stripe payout:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async processPayPalPayout(payoutRequest, payoutDetails) {
    try {
      // In production, this would use PayPal Payouts API
      // For now, simulate successful payout
      
      const transactionId = `paypal_payout_${Date.now()}_${payoutRequest.id}`;
      
      logger.info(`PayPal payout processed: requestId=${payoutRequest.id}, transactionId=${transactionId}`);
      
      return {
        success: true,
        transactionId,
        provider: 'paypal'
      };
      
    } catch (error) {
      logger.error('Failed to process PayPal payout:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async processBankTransferPayout(payoutRequest, payoutDetails) {
    try {
      // In production, this would integrate with banking APIs or services like Plaid
      // For now, simulate successful payout
      
      const transactionId = `bank_transfer_${Date.now()}_${payoutRequest.id}`;
      
      logger.info(`Bank transfer processed: requestId=${payoutRequest.id}, transactionId=${transactionId}`);
      
      return {
        success: true,
        transactionId,
        provider: 'bank_transfer'
      };
      
    } catch (error) {
      logger.error('Failed to process bank transfer:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getPayoutRequests(userId, options = {}) {
    try {
      const {
        status = null,
        limit = 20,
        offset = 0,
        startDate = null,
        endDate = null
      } = options;
      
      const { pool } = require('../config/database');
      
      let query = `
        SELECT pr.*, 
               approver.username as approver_username,
               rejecter.username as rejecter_username
        FROM payout_requests pr
        LEFT JOIN users approver ON pr.approved_by = approver.id
        LEFT JOIN users rejecter ON pr.rejected_by = rejecter.id
        WHERE pr.user_id = $1
      `;
      
      const params = [userId];
      let paramIndex = 2;
      
      if (status) {
        query += ` AND pr.status = $${paramIndex++}`;
        params.push(status);
      }
      
      if (startDate) {
        query += ` AND pr.created_at >= $${paramIndex++}`;
        params.push(startDate);
      }
      
      if (endDate) {
        query += ` AND pr.created_at <= $${paramIndex++}`;
        params.push(endDate);
      }
      
      query += `
        ORDER BY pr.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      
      params.push(limit, offset);
      
      const result = await pool.query(query, params);
      
      return {
        payouts: result.rows,
        limit,
        offset
      };
      
    } catch (error) {
      logger.error('Failed to get payout requests:', error);
      throw error;
    }
  }

  async getAllPayoutRequests(options = {}) {
    try {
      const {
        status = null,
        limit = 50,
        offset = 0,
        startDate = null,
        endDate = null
      } = options;
      
      const { pool } = require('../config/database');
      
      let query = `
        SELECT pr.*, u.username, u.email,
               approver.username as approver_username,
               rejecter.username as rejecter_username
        FROM payout_requests pr
        JOIN users u ON pr.user_id = u.id
        LEFT JOIN users approver ON pr.approved_by = approver.id
        LEFT JOIN users rejecter ON pr.rejected_by = rejecter.id
        WHERE 1=1
      `;
      
      const params = [];
      let paramIndex = 1;
      
      if (status) {
        query += ` AND pr.status = $${paramIndex++}`;
        params.push(status);
      }
      
      if (startDate) {
        query += ` AND pr.created_at >= $${paramIndex++}`;
        params.push(startDate);
      }
      
      if (endDate) {
        query += ` AND pr.created_at <= $${paramIndex++}`;
        params.push(endDate);
      }
      
      query += `
        ORDER BY pr.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      
      params.push(limit, offset);
      
      const result = await pool.query(query, params);
      
      return {
        payouts: result.rows,
        limit,
        offset
      };
      
    } catch (error) {
      logger.error('Failed to get all payout requests:', error);
      throw error;
    }
  }

  async getPayoutStats(period = '30d') {
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
      
      // Payout stats by status
      const statusStatsQuery = `
        SELECT 
          status,
          COUNT(*) as count,
          COALESCE(SUM(amount_usd), 0) as total_amount
        FROM payout_requests
        WHERE created_at >= NOW() - INTERVAL '${interval}'
        GROUP BY status
        ORDER BY total_amount DESC
      `;
      
      const statusStatsResult = await pool.query(statusStatsQuery);
      
      // Payout stats by method
      const methodStatsQuery = `
        SELECT 
          payout_method,
          COUNT(*) as count,
          COALESCE(SUM(amount_usd), 0) as total_amount
        FROM payout_requests
        WHERE created_at >= NOW() - INTERVAL '${interval}'
        GROUP BY payout_method
        ORDER BY total_amount DESC
      `;
      
      const methodStatsResult = await pool.query(methodStatsQuery);
      
      // Daily payout trend
      const dailyPayoutQuery = `
        SELECT 
          DATE(created_at) as date,
          COALESCE(SUM(amount_usd), 0) as daily_total,
          COUNT(*) as daily_count
        FROM payout_requests
        WHERE created_at >= NOW() - INTERVAL '${interval}'
        GROUP BY DATE(created_at)
        ORDER BY date
      `;
      
      const dailyPayoutResult = await pool.query(dailyPayoutQuery);
      
      // Pending payouts amount
      const pendingQuery = `
        SELECT COALESCE(SUM(amount_usd), 0) as pending_amount,
               COUNT(*) as pending_count
        FROM payout_requests
        WHERE status IN ('pending', 'processing')
      `;
      
      const pendingResult = await pool.query(pendingQuery);
      
      return {
        period,
        statusStats: statusStatsResult.rows,
        methodStats: methodStatsResult.rows,
        dailyPayouts: dailyPayoutResult.rows,
        pending: pendingResult.rows[0]
      };
      
    } catch (error) {
      logger.error('Failed to get payout stats:', error);
      throw error;
    }
  }

  async validatePayoutRequest(userId, amount, payoutMethod, payoutDetails) {
    try {
      // Validate amount
      if (amount < 10) {
        return {
          valid: false,
          reason: 'Minimum payout amount is $10'
        };
      }
      
      if (amount > 10000) {
        return {
          valid: false,
          reason: 'Maximum payout amount is $10,000'
        };
      }
      
      // Validate payout method and details
      const methodValidation = this.validatePayoutMethod(payoutMethod, payoutDetails);
      if (!methodValidation.valid) {
        return methodValidation;
      }
      
      // Check user has sufficient points
      const requiredPoints = Math.round(amount * 100);
      const validation = await this.walletService.validateBalance(userId, 'points', requiredPoints);
      
      if (!validation.sufficient) {
        return {
          valid: false,
          reason: `Insufficient points. Required: ${requiredPoints}, Available: ${validation.currentBalance}`,
          requiredPoints,
          currentPoints: validation.currentBalance
        };
      }
      
      // Check for pending payouts
      const { pool } = require('../config/database');
      const pendingQuery = `
        SELECT COUNT(*) as pending_count
        FROM payout_requests
        WHERE user_id = $1 AND status IN ('pending', 'processing')
      `;
      
      const pendingResult = await pool.query(pendingQuery, [userId]);
      const pendingCount = parseInt(pendingResult.rows[0].pending_count);
      
      if (pendingCount >= 3) {
        return {
          valid: false,
          reason: 'Maximum number of pending payouts reached (3)',
          pendingCount
        };
      }
      
      return {
        valid: true,
        requiredPoints,
        currentPoints: validation.currentBalance,
        pendingCount
      };
      
    } catch (error) {
      logger.error('Failed to validate payout request:', error);
      throw error;
    }
  }

  validatePayoutMethod(payoutMethod, payoutDetails) {
    switch (payoutMethod) {
      case 'stripe':
        return this.validateStripePayout(payoutDetails);
      case 'paypal':
        return this.validatePayPalPayout(payoutDetails);
      case 'bank_transfer':
        return this.validateBankTransferPayout(payoutDetails);
      default:
        return {
          valid: false,
          reason: 'Unsupported payout method'
        };
    }
  }

  validateStripePayout(payoutDetails) {
    const required = ['accountId'];
    const missing = required.filter(field => !payoutDetails[field]);
    
    if (missing.length > 0) {
      return {
        valid: false,
        reason: `Missing required fields: ${missing.join(', ')}`
      };
    }
    
    return { valid: true };
  }

  validatePayPalPayout(payoutDetails) {
    const required = ['email'];
    const missing = required.filter(field => !payoutDetails[field]);
    
    if (missing.length > 0) {
      return {
        valid: false,
        reason: `Missing required fields: ${missing.join(', ')}`
      };
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payoutDetails.email)) {
      return {
        valid: false,
        reason: 'Invalid PayPal email address'
      };
    }
    
    return { valid: true };
  }

  validateBankTransferPayout(payoutDetails) {
    const required = ['accountNumber', 'routingNumber', 'accountHolderName'];
    const missing = required.filter(field => !payoutDetails[field]);
    
    if (missing.length > 0) {
      return {
        valid: false,
        reason: `Missing required fields: ${missing.join(', ')}`
      };
    }
    
    // Basic routing number validation (US)
    if (payoutDetails.routingNumber.length !== 9 || !/^\d+$/.test(payoutDetails.routingNumber)) {
      return {
        valid: false,
        reason: 'Invalid routing number'
      };
    }
    
    return { valid: true };
  }
}

module.exports = PayoutService;
