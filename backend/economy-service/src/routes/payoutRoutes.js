const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { fraudDetectionMiddleware, recordFailedAttempt, clearFailedAttempts } = require('../middleware/fraudDetection');
const { adminMiddleware } = require('../middleware/auth');
const PayoutService = require('../services/PayoutService');
const auditService = require('../services/AuditService');
const { payoutRequestsTotal, payoutAmount } = require('../config/metrics');

const router = express.Router();
const payoutService = new PayoutService();

// Create payout request
router.post('/request', fraudDetectionMiddleware('payout'), asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { amount, payoutMethod, payoutDetails } = req.body;
  
  if (!amount || !payoutMethod || !payoutDetails) {
    return res.status(400).json({
      success: false,
      error: 'Amount, payout method, and payout details are required'
    });
  }
  
  try {
    // Validate payout request
    const validation = await payoutService.validatePayoutRequest(
      userId,
      parseFloat(amount),
      payoutMethod,
      payoutDetails
    );
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.reason,
        data: validation
      });
    }
    
    const payoutRequest = await payoutService.createPayoutRequest(
      userId,
      parseFloat(amount),
      payoutMethod,
      payoutDetails
    );
    
    await auditService.logEconomyEvent('payout_request_created', userId, {
      payoutRequestId: payoutRequest.id,
      amount: parseFloat(amount),
      payoutMethod,
      pointsUsed: payoutRequest.points_used
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    payoutRequestsTotal
      .labels('created')
      .inc();
    
    payoutAmount
      .observe(parseFloat(amount));
    
    // Clear any failed attempts
    await clearFailedAttempts(userId, 'payout', require('../config/database').redis);
    
    res.status(201).json({
      success: true,
      data: {
        payoutRequestId: payoutRequest.id,
        amount: parseFloat(payoutRequest.amount_usd),
        pointsUsed: parseInt(payoutRequest.points_used),
        payoutMethod,
        status: payoutRequest.status,
        createdAt: payoutRequest.created_at
      }
    });
    
  } catch (error) {
    // Record failed attempt
    await recordFailedAttempt(userId, 'payout', require('../config/database').redis);
    
    payoutRequestsTotal
      .labels('failed')
      .inc();
    
    throw error;
  }
}));

// Get user's payout requests
router.get('/my-requests', asyncHandler(async (req, res) => {
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
    
    const requests = await payoutService.getPayoutRequests(userId, options);
    
    await auditService.logEconomyEvent('payout_requests_view', userId, {
      filters: options,
      resultCount: requests.payouts.length
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      data: requests
    });
    
  } catch (error) {
    throw error;
  }
}));

// Validate payout request before submission
router.post('/validate', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { amount, payoutMethod, payoutDetails } = req.body;
  
  if (!amount || !payoutMethod || !payoutDetails) {
    return res.status(400).json({
      success: false,
      error: 'Amount, payout method, and payout details are required'
    });
  }
  
  try {
    const validation = await payoutService.validatePayoutRequest(
      userId,
      parseFloat(amount),
      payoutMethod,
      payoutDetails
    );
    
    await auditService.logEconomyEvent('payout_validation', userId, {
      amount: parseFloat(amount),
      payoutMethod,
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

// Admin routes

// Get all payout requests (admin only)
router.get('/admin/all', adminMiddleware, asyncHandler(async (req, res) => {
  const {
    status,
    limit = 50,
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
    
    const requests = await payoutService.getAllPayoutRequests(options);
    
    await auditService.logEconomyEvent('admin_payout_requests_view', req.user.id, {
      filters: options,
      resultCount: requests.payouts.length
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      data: requests
    });
    
  } catch (error) {
    throw error;
  }
}));

// Approve payout request (admin only)
router.post('/admin/approve', adminMiddleware, asyncHandler(async (req, res) => {
  const { payoutRequestId, notes } = req.body;
  
  if (!payoutRequestId) {
    return res.status(400).json({
      success: false,
      error: 'Payout request ID is required'
    });
  }
  
  try {
    const result = await payoutService.approvePayoutRequest(
      payoutRequestId,
      req.user.id,
      notes
    );
    
    await auditService.logEconomyEvent('payout_approved', req.user.id, {
      payoutRequestId,
      approvedBy: req.user.id,
      notes,
      processed: result.processed
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    payoutRequestsTotal
      .labels('approved')
      .inc();
    
    res.json({
      success: true,
      data: {
        payoutRequest: result.payoutRequest,
        processed: result.processed
      }
    });
    
  } catch (error) {
    payoutRequestsTotal
      .labels('approval_failed')
      .inc();
    throw error;
  }
}));

// Reject payout request (admin only)
router.post('/admin/reject', adminMiddleware, asyncHandler(async (req, res) => {
  const { payoutRequestId, reason } = req.body;
  
  if (!payoutRequestId || !reason) {
    return res.status(400).json({
      success: false,
      error: 'Payout request ID and rejection reason are required'
    });
  }
  
  try {
    const payoutRequest = await payoutService.rejectPayoutRequest(
      payoutRequestId,
      req.user.id,
      reason
    );
    
    await auditService.logEconomyEvent('payout_rejected', req.user.id, {
      payoutRequestId,
      rejectedBy: req.user.id,
      reason
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    payoutRequestsTotal
      .labels('rejected')
      .inc();
    
    res.json({
      success: true,
      data: payoutRequest
    });
    
  } catch (error) {
    payoutRequestsTotal
      .labels('rejection_failed')
      .inc();
    throw error;
  }
}));

// Get payout statistics (admin only)
router.get('/admin/stats', adminMiddleware, asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;
  
  try {
    const stats = await payoutService.getPayoutStats(period);
    
    await auditService.logEconomyEvent('payout_stats_view', req.user.id, {
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

// Get payout methods configuration
router.get('/methods', asyncHandler(async (req, res) => {
  try {
    const methods = {
      stripe: {
        name: 'Stripe Connect',
        description: 'Direct deposit to your Stripe account',
        supportedCountries: ['US', 'CA', 'UK', 'AU', 'EU'],
        processingTime: '1-3 business days',
        fee: '0.5% (minimum $0.25)',
        requiredFields: ['accountId']
      },
      paypal: {
        name: 'PayPal',
        description: 'Transfer to your PayPal account',
        supportedCountries: ['US', 'CA', 'UK', 'AU', 'EU', 'Global'],
        processingTime: '1-2 business days',
        fee: '2.9% + $0.30',
        requiredFields: ['email']
      },
      bank_transfer: {
        name: 'Bank Transfer',
        description: 'Direct bank transfer (US only)',
        supportedCountries: ['US'],
        processingTime: '3-5 business days',
        fee: '$2.50',
        requiredFields: ['accountNumber', 'routingNumber', 'accountHolderName']
      }
    };
    
    res.json({
      success: true,
      data: methods
    });
    
  } catch (error) {
    throw error;
  }
}));

// Get payout limits and policies
router.get('/limits', asyncHandler(async (req, res) => {
  try {
    const limits = {
      minimumAmount: 10,
      maximumAmount: 10000,
      maxPendingRequests: 3,
      processingTimes: {
        stripe: '1-3 business days',
        paypal: '1-2 business days',
        bank_transfer: '3-5 business days'
      },
      fees: {
        stripe: { type: 'percentage', value: 0.5, minimum: 0.25 },
        paypal: { type: 'percentage', value: 2.9, fixed: 0.30 },
        bank_transfer: { type: 'fixed', value: 2.50 }
      },
      restrictions: {
        kycRequired: true,
        accountVerificationRequired: true,
        cooldownPeriod: '24 hours between requests'
      }
    };
    
    res.json({
      success: true,
      data: limits
    });
    
  } catch (error) {
    throw error;
  }
}));

// Get user's payout eligibility
router.get('/eligibility', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  try {
    const { pool } = require('../config/database');
    
    // Check user's points balance
    const walletQuery = `
      SELECT points_balance
      FROM wallets
      WHERE user_id = $1
    `;
    
    const walletResult = await pool.query(walletQuery, [userId]);
    const pointsBalance = walletResult.rows.length > 0 ? parseFloat(walletResult.rows[0].points_balance) : 0;
    
    // Check pending payout requests
    const pendingQuery = `
      SELECT COUNT(*) as pending_count
      FROM payout_requests
      WHERE user_id = $1 AND status IN ('pending', 'processing')
    `;
    
    const pendingResult = await pool.query(pendingQuery, [userId]);
    const pendingCount = parseInt(pendingResult.rows[0].pending_count);
    
    // Check if user has completed purchases (required for payouts)
    const purchasesQuery = `
      SELECT COUNT(*) as purchase_count
      FROM token_purchases
      WHERE user_id = $1 AND status = 'completed'
    `;
    
    const purchasesResult = await pool.query(purchasesQuery, [userId]);
    const purchaseCount = parseInt(purchasesResult.rows[0].purchase_count);
    
    const eligibility = {
      eligible: pointsBalance >= 1000 && pendingCount < 3 && purchaseCount > 0,
      pointsBalance,
      pendingCount,
      purchaseCount,
      reasons: []
    };
    
    if (pointsBalance < 1000) {
      eligibility.reasons.push('Minimum 1000 points required for payouts');
    }
    
    if (pendingCount >= 3) {
      eligibility.reasons.push('Maximum pending requests reached');
    }
    
    if (purchaseCount === 0) {
      eligibility.reasons.push('At least one token purchase required');
    }
    
    await auditService.logEconomyEvent('payout_eligibility_check', userId, {
      eligible: eligibility.eligible,
      pointsBalance,
      pendingCount,
      purchaseCount
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      data: eligibility
    });
    
  } catch (error) {
    throw error;
  }
}));

module.exports = router;
