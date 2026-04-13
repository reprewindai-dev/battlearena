const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { fraudDetectionMiddleware, recordFailedAttempt, clearFailedAttempts } = require('../middleware/fraudDetection');
const TokenService = require('../services/TokenService');
const auditService = require('../services/AuditService');
const { tokenSpendingTotal, tokenSpendingAmount } = require('../config/metrics');

const router = express.Router();
const tokenService = new TokenService();

// Spend tokens (general endpoint)
router.post('/spend', fraudDetectionMiddleware('spend'), asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { amount, type, referenceId, description, recipientId } = req.body;
  
  if (!amount || !type) {
    return res.status(400).json({
      success: false,
      error: 'Amount and type are required'
    });
  }
  
  if (amount < 1) {
    return res.status(400).json({
      success: false,
      error: 'Minimum amount is 1 token'
    });
  }
  
  try {
    // Validate spending
    const validation = await tokenService.validateSpending(userId, parseFloat(amount), type);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.reason,
        data: validation
      });
    }
    
    const result = await tokenService.spendTokens(
      userId,
      parseFloat(amount),
      type,
      referenceId,
      description,
      recipientId
    );
    
    await auditService.logEconomyEvent('tokens_spent', userId, {
      amount: parseFloat(amount),
      type,
      referenceId,
      recipientId,
      description
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    tokenSpendingTotal
      .labels(type, 'success')
      .inc();
    
    tokenSpendingAmount
      .labels(type)
      .observe(parseFloat(amount));
    
    // Clear any failed attempts
    await clearFailedAttempts(userId, 'spend', require('../config/database').redis);
    
    res.json({
      success: true,
      data: {
        amount: parseFloat(amount),
        type,
        referenceId,
        newBalance: {
          crowns: parseFloat(result.walletUpdate.wallet.crowns_balance),
          tokens: parseFloat(result.walletUpdate.wallet.tokens_balance),
          points: parseFloat(result.walletUpdate.wallet.points_balance)
        },
        transactionId: result.spending.id
      }
    });
    
  } catch (error) {
    // Record failed attempt
    await recordFailedAttempt(userId, 'spend', require('../config/database').redis);
    
    tokenSpendingTotal
      .labels(type || 'unknown', 'failed')
      .inc();
    
    throw error;
  }
}));

// Tip a creator
router.post('/tip', fraudDetectionMiddleware('spend'), asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { creatorId, amount, battleId, description } = req.body;
  
  if (!creatorId || !amount) {
    return res.status(400).json({
      success: false,
      error: 'Creator ID and amount are required'
    });
  }
  
  if (amount < 1) {
    return res.status(400).json({
      success: false,
      error: 'Minimum tip amount is 1 token'
    });
  }
  
  if (amount > 10000) {
    return res.status(400).json({
      success: false,
      error: 'Maximum tip amount is 10,000 tokens'
    });
  }
  
  try {
    // Validate spending
    const validation = await tokenService.validateSpending(userId, parseFloat(amount), 'tip');
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.reason,
        data: validation
      });
    }
    
    const result = await tokenService.tipCreator(
      userId,
      creatorId,
      parseFloat(amount),
      battleId,
      description
    );
    
    await auditService.logEconomyEvent('creator_tipped', userId, {
      creatorId,
      amount: parseFloat(amount),
      battleId,
      description
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    tokenSpendingTotal
      .labels('tip', 'success')
      .inc();
    
    tokenSpendingAmount
      .labels('tip')
      .observe(parseFloat(amount));
    
    // Clear any failed attempts
    await clearFailedAttempts(userId, 'spend', require('../config/database').redis);
    
    res.json({
      success: true,
      data: {
        creatorId,
        amount: parseFloat(amount),
        battleId,
        transactionId: result.spending.id,
        tipId: result.tip.id
      }
    });
    
  } catch (error) {
    // Record failed attempt
    await recordFailedAttempt(userId, 'spend', require('../config/database').redis);
    
    tokenSpendingTotal
      .labels('tip', 'failed')
      .inc();
    
    throw error;
  }
}));

// Pay battle entry fee
router.post('/entry-fee', fraudDetectionMiddleware('spend'), asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { battleId, amount } = req.body;
  
  if (!battleId || amount === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Battle ID and amount are required'
    });
  }
  
  if (amount < 0) {
    return res.status(400).json({
      success: false,
      error: 'Entry fee cannot be negative'
    });
  }
  
  try {
    // Validate spending
    const validation = await tokenService.validateSpending(userId, parseFloat(amount), 'entry_fee');
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.reason,
        data: validation
      });
    }
    
    const result = await tokenService.payEntryFee(userId, battleId, parseFloat(amount));
    
    await auditService.logEconomyEvent('battle_entry_fee_paid', userId, {
      battleId,
      amount: parseFloat(amount)
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    tokenSpendingTotal
      .labels('entry_fee', 'success')
      .inc();
    
    tokenSpendingAmount
      .labels('entry_fee')
      .observe(parseFloat(amount));
    
    // Clear any failed attempts
    await clearFailedAttempts(userId, 'spend', require('../config/database').redis);
    
    res.json({
      success: true,
      data: {
        battleId,
        amount: parseFloat(amount),
        transactionId: result.spending.id,
        entryId: result.entry.id
      }
    });
    
  } catch (error) {
    // Record failed attempt
    await recordFailedAttempt(userId, 'spend', require('../config/database').redis);
    
    tokenSpendingTotal
      .labels('entry_fee', 'failed')
      .inc();
    
    throw error;
  }
}));

// Purchase item with tokens
router.post('/purchase', fraudDetectionMiddleware('spend'), asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { itemId, itemType, amount, description } = req.body;
  
  if (!itemId || !itemType || !amount) {
    return res.status(400).json({
      success: false,
      error: 'Item ID, item type, and amount are required'
    });
  }
  
  if (amount < 1) {
    return res.status(400).json({
      success: false,
      error: 'Minimum purchase amount is 1 token'
    });
  }
  
  try {
    // Validate spending
    const validation = await tokenService.validateSpending(userId, parseFloat(amount), 'purchase');
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.reason,
        data: validation
      });
    }
    
    const result = await tokenService.purchaseItem(
      userId,
      itemId,
      itemType,
      parseFloat(amount),
      description
    );
    
    await auditService.logEconomyEvent('item_purchased', userId, {
      itemId,
      itemType,
      amount: parseFloat(amount),
      description
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    tokenSpendingTotal
      .labels('purchase', 'success')
      .inc();
    
    tokenSpendingAmount
      .labels('purchase')
      .observe(parseFloat(amount));
    
    // Clear any failed attempts
    await clearFailedAttempts(userId, 'spend', require('../config/database').redis);
    
    res.json({
      success: true,
      data: {
        itemId,
        itemType,
        amount: parseFloat(amount),
        transactionId: result.spending.id,
        purchaseId: result.purchase.id
      }
    });
    
  } catch (error) {
    // Record failed attempt
    await recordFailedAttempt(userId, 'spend', require('../config/database').redis);
    
    tokenSpendingTotal
      .labels('purchase', 'failed')
      .inc();
    
    throw error;
  }
}));

// Get spending history
router.get('/history', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    type,
    limit = 50,
    offset = 0,
    startDate,
    endDate
  } = req.query;
  
  try {
    const options = {
      type,
      limit: parseInt(limit),
      offset: parseInt(offset),
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null
    };
    
    const history = await tokenService.getSpendingHistory(userId, options);
    
    await auditService.logEconomyEvent('spending_history_view', userId, {
      filters: options,
      resultCount: history.spending.length
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      data: history
    });
    
  } catch (error) {
    throw error;
  }
}));

// Get receipt history (tokens received)
router.get('/receipts', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    type,
    limit = 50,
    offset = 0,
    startDate,
    endDate
  } = req.query;
  
  try {
    const options = {
      type,
      limit: parseInt(limit),
      offset: parseInt(offset),
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null
    };
    
    const receipts = await tokenService.getReceiptHistory(userId, options);
    
    await auditService.logEconomyEvent('receipt_history_view', userId, {
      filters: options,
      resultCount: receipts.receipts.length
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      data: receipts
    });
    
  } catch (error) {
    throw error;
  }
}));

// Get spending statistics
router.get('/stats', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { period = '30d' } = req.query;
  
  try {
    const stats = await tokenService.getSpendingStats(userId, period);
    
    await auditService.logEconomyEvent('spending_stats_view', userId, {
      period
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    throw error;
  }
}));

// Validate spending before operation
router.post('/validate', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { amount, type } = req.body;
  
  if (!amount || !type) {
    return res.status(400).json({
      success: false,
      error: 'Amount and type are required'
    });
  }
  
  try {
    const validation = await tokenService.validateSpending(userId, parseFloat(amount), type);
    
    await auditService.logEconomyEvent('spending_validation', userId, {
      amount: parseFloat(amount),
      type,
      valid: validation.valid
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      data: validation
    });
    
  } catch (error) {
    throw error;
  }
}));

// Get global spending stats (admin only)
router.get('/admin/stats', asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;
  
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
    
    // Spending stats by type
    const typeStatsQuery = `
      SELECT 
        type,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(DISTINCT user_id) as unique_users
      FROM token_spending
      WHERE created_at >= NOW() - INTERVAL '${interval}'
      GROUP BY type
      ORDER BY total_amount DESC
    `;
    
    const typeStatsResult = await pool.query(typeStatsQuery);
    
    // Daily spending trend
    const dailyQuery = `
      SELECT 
        DATE(created_at) as date,
        COALESCE(SUM(amount), 0) as daily_total,
        COUNT(*) as daily_count
      FROM token_spending
      WHERE created_at >= NOW() - INTERVAL '${interval}'
      GROUP BY DATE(created_at)
      ORDER BY date
    `;
    
    const dailyResult = await pool.query(dailyQuery);
    
    // Top spenders
    const topSpendersQuery = `
      SELECT 
        user_id,
        u.username,
        COUNT(*) as spend_count,
        COALESCE(SUM(amount), 0) as total_spent
      FROM token_spending ts
      LEFT JOIN users u ON ts.user_id = u.id
      WHERE ts.created_at >= NOW() - INTERVAL '${interval}'
      GROUP BY user_id, u.username
      ORDER BY total_spent DESC
      LIMIT 10
    `;
    
    const topSpendersResult = await pool.query(topSpendersQuery);
    
    // Tip statistics
    const tipStatsQuery = `
      SELECT 
        COUNT(*) as total_tips,
        COALESCE(SUM(amount), 0) as total_tipped,
        COUNT(DISTINCT user_id) as unique_tippers,
        COUNT(DISTINCT recipient_id) as unique_recipients
      FROM token_spending
      WHERE type = 'tip' AND created_at >= NOW() - INTERVAL '${interval}'
    `;
    
    const tipStatsResult = await pool.query(tipStatsQuery);
    
    await auditService.logEconomyEvent('admin_spending_stats_view', req.user.id, {
      period
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      data: {
        period,
        typeStats: typeStatsResult.rows,
        dailyTrend: dailyResult.rows,
        topSpenders: topSpendersResult.rows,
        tipStats: tipStatsResult.rows[0]
      }
    });
    
  } catch (error) {
    throw error;
  }
}));

module.exports = router;
