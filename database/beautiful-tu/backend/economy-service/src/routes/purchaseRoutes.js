const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { fraudDetectionMiddleware, recordFailedAttempt, clearFailedAttempts } = require('../middleware/fraudDetection');
const PaymentService = require('../services/PaymentService');
const auditService = require('../services/AuditService');
const { tokenPurchasesTotal, tokenPurchaseAmount } = require('../config/metrics');

const router = express.Router();
const paymentService = new PaymentService();

// Create payment intent for token purchase
router.post('/purchase', fraudDetectionMiddleware('purchase'), asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { amount, currency = 'usd', paymentMethod } = req.body;
  
  if (!amount || amount < 1) {
    return res.status(400).json({
      success: false,
      error: 'Valid amount is required (minimum $1)'
    });
  }
  
  if (amount > 10000) {
    return res.status(400).json({
      success: false,
      error: 'Maximum amount is $10,000'
    });
  }
  
  try {
    const paymentIntent = await paymentService.createPaymentIntent(
      userId,
      parseFloat(amount),
      currency,
      paymentMethod
    );
    
    await auditService.logEconomyEvent('payment_intent_created', userId, {
      amount: parseFloat(amount),
      currency,
      paymentIntentId: paymentIntent.paymentIntentId,
      paymentMethod: paymentMethod || 'automatic'
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    tokenPurchasesTotal
      .labels('stripe', 'intent_created')
      .inc();
    
    tokenPurchaseAmount
      .labels('stripe')
      .observe(parseFloat(amount));
    
    // Clear any failed attempts
    await clearFailedAttempts(userId, 'purchase', require('../config/database').redis);
    
    res.status(201).json({
      success: true,
      data: paymentIntent
    });
    
  } catch (error) {
    // Record failed attempt
    await recordFailedAttempt(userId, 'purchase', require('../config/database').redis);
    
    tokenPurchasesTotal
      .labels('stripe', 'intent_failed')
      .inc();
    
    throw error;
  }
}));

// Confirm payment and process token purchase
router.post('/purchase/confirm', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { paymentIntentId } = req.body;
  
  if (!paymentIntentId) {
    return res.status(400).json({
      success: false,
      error: 'Payment intent ID is required'
    });
  }
  
  try {
    const confirmation = await paymentService.confirmPayment(paymentIntentId, userId);
    
    await auditService.logEconomyEvent('payment_confirmed', userId, {
      paymentIntentId,
      status: confirmation.status,
      amount: confirmation.amount
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    if (confirmation.status === 'succeeded') {
      tokenPurchasesTotal
        .labels('stripe', 'completed')
        .inc();
      
      // Clear any failed attempts
      await clearFailedAttempts(userId, 'purchase', require('../config/database').redis);
    } else {
      tokenPurchasesTotal
        .labels('stripe', 'confirmation_failed')
        .inc();
    }
    
    res.json({
      success: true,
      data: confirmation
    });
    
  } catch (error) {
    tokenPurchasesTotal
      .labels('stripe', 'confirmation_error')
      .inc();
    throw error;
  }
}));

// Create setup intent for saving payment methods
router.post('/setup-intent', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  try {
    const setupIntent = await paymentService.createSetupIntent(userId);
    
    await auditService.logEconomyEvent('setup_intent_created', userId, {
      setupIntentId: setupIntent.setupIntentId
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.status(201).json({
      success: true,
      data: setupIntent
    });
    
  } catch (error) {
    throw error;
  }
}));

// Attach payment method to user
router.post('/payment-methods/attach', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { paymentMethodId } = req.body;
  
  if (!paymentMethodId) {
    return res.status(400).json({
      success: false,
      error: 'Payment method ID is required'
    });
  }
  
  try {
    const attachedMethod = await paymentService.attachPaymentMethod(paymentMethodId, userId);
    
    await auditService.logEconomyEvent('payment_method_attached', userId, {
      paymentMethodId,
      type: attachedMethod.type,
      last4: attachedMethod.last4
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      data: attachedMethod
    });
    
  } catch (error) {
    throw error;
  }
}));

// Validate payment method
router.post('/payment-methods/validate', asyncHandler(async (req, res) => {
  const { paymentMethodId } = req.body;
  
  if (!paymentMethodId) {
    return res.status(400).json({
      success: false,
      error: 'Payment method ID is required'
    });
  }
  
  try {
    const validation = await paymentService.validatePaymentMethod(paymentMethodId);
    
    res.json({
      success: true,
      data: validation
    });
    
  } catch (error) {
    throw error;
  }
}));

// Get payment history
router.get('/history', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    status,
    limit = 20,
    offset = 0,
    startDate,
    endDate
  } = req.query;
  
  try {
    const options = {
      status,
      limit: parseInt(limit),
      offset: parseInt(offset),
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null
    };
    
    const history = await paymentService.getPaymentHistory(userId, options);
    
    await auditService.logEconomyEvent('payment_history_view', userId, {
      filters: options,
      resultCount: history.payments.length
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

// Refund payment (admin only)
router.post('/refund', asyncHandler(async (req, res) => {
  const { paymentIntentId, amount, reason } = req.body;
  
  if (!paymentIntentId) {
    return res.status(400).json({
      success: false,
      error: 'Payment intent ID is required'
    });
  }
  
  try {
    const refund = await paymentService.refundPayment(
      paymentIntentId,
      amount ? parseFloat(amount) : null,
      reason || 'requested_by_customer'
    );
    
    await auditService.logEconomyEvent('payment_refunded', req.user.id, {
      paymentIntentId,
      refundAmount: refund.amount,
      refundId: refund.refundId,
      reason: refund.reason
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      data: refund
    });
    
  } catch (error) {
    throw error;
  }
}));

// Get purchase statistics (admin only)
router.get('/stats', asyncHandler(async (req, res) => {
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
    
    // Purchase stats
    const statsQuery = `
      SELECT 
        COUNT(*) as total_purchases,
        COALESCE(SUM(amount_usd), 0) as total_revenue,
        COALESCE(SUM(tokens_received), 0) as total_tokens,
        COALESCE(AVG(amount_usd), 0) as avg_purchase_amount,
        COUNT(DISTINCT user_id) as unique_purchasers
      FROM token_purchases
      WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '${interval}'
    `;
    
    const statsResult = await pool.query(statsQuery);
    
    // Daily revenue trend
    const dailyQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as purchases,
        COALESCE(SUM(amount_usd), 0) as daily_revenue,
        COALESCE(SUM(tokens_received), 0) as daily_tokens
      FROM token_purchases
      WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '${interval}'
      GROUP BY DATE(created_at)
      ORDER BY date
    `;
    
    const dailyResult = await pool.query(dailyQuery);
    
    // Top purchasers
    const topPurchasersQuery = `
      SELECT 
        user_id,
        u.username,
        COUNT(*) as purchase_count,
        COALESCE(SUM(amount_usd), 0) as total_spent,
        COALESCE(SUM(tokens_received), 0) as total_tokens
      FROM token_purchases tp
      LEFT JOIN users u ON tp.user_id = u.id
      WHERE tp.status = 'completed' AND tp.created_at >= NOW() - INTERVAL '${interval}'
      GROUP BY user_id, u.username
      ORDER BY total_spent DESC
      LIMIT 10
    `;
    
    const topPurchasersResult = await pool.query(topPurchasersQuery);
    
    await auditService.logEconomyEvent('purchase_stats_view', req.user.id, {
      period,
      stats: statsResult.rows[0]
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      data: {
        period,
        summary: statsResult.rows[0],
        dailyTrend: dailyResult.rows,
        topPurchasers: topPurchasersResult.rows
      }
    });
    
  } catch (error) {
    throw error;
  }
}));

module.exports = router;
