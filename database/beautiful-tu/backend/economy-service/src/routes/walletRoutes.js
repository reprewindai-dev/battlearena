const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { fraudDetectionMiddleware, recordFailedAttempt, clearFailedAttempts } = require('../middleware/fraudDetection');
const WalletService = require('../services/WalletService');
const auditService = require('../services/AuditService');
const { walletOperationsTotal } = require('../config/metrics');

const router = express.Router();
const walletService = new WalletService();

// Get wallet information
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  try {
    const wallet = await walletService.getWallet(userId);
    
    await auditService.logEconomyEvent('wallet_view', userId, {
      walletId: wallet.id,
      balances: {
        crowns: wallet.crowns_balance,
        tokens: wallet.tokens_balance,
        points: wallet.points_balance
      }
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    walletOperationsTotal
      .labels('view', 'success')
      .inc();
    
    res.json({
      success: true,
      data: {
        walletId: wallet.id,
        balances: {
          crowns: parseFloat(wallet.crowns_balance),
          tokens: parseFloat(wallet.tokens_balance),
          points: parseFloat(wallet.points_balance)
        },
        createdAt: wallet.created_at,
        updatedAt: wallet.updated_at
      }
    });
    
  } catch (error) {
    walletOperationsTotal
      .labels('view', 'failed')
      .inc();
    throw error;
  }
}));

// Get balance snapshot
router.get('/snapshot', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  try {
    const snapshot = await walletService.getBalanceSnapshot(userId);
    
    await auditService.logEconomyEvent('balance_snapshot', userId, {
      balances: snapshot.balances,
      recentActivityCount: snapshot.recentActivity.length
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    walletOperationsTotal
      .labels('snapshot', 'success')
      .inc();
    
    res.json({
      success: true,
      data: snapshot
    });
    
  } catch (error) {
    walletOperationsTotal
      .labels('snapshot', 'failed')
      .inc();
    throw error;
  }
}));

// Get transaction history
router.get('/transactions', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    currency,
    operation,
    limit = 50,
    offset = 0,
    startDate,
    endDate
  } = req.query;
  
  try {
    const options = {
      currency,
      operation,
      limit: parseInt(limit),
      offset: parseInt(offset),
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null
    };
    
    const history = await walletService.getTransactionHistory(userId, options);
    
    await auditService.logEconomyEvent('transaction_history_view', userId, {
      filters: options,
      resultCount: history.transactions.length
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    walletOperationsTotal
      .labels('history', 'success')
      .inc();
    
    res.json({
      success: true,
      data: history
    });
    
  } catch (error) {
    walletOperationsTotal
      .labels('history', 'failed')
      .inc();
    throw error;
  }
}));

// Validate balance for operation
router.post('/validate', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { currency, requiredAmount } = req.body;
  
  if (!currency || !requiredAmount) {
    return res.status(400).json({
      success: false,
      error: 'Currency and required amount are required'
    });
  }
  
  try {
    const validation = await walletService.validateBalance(userId, currency, parseFloat(requiredAmount));
    
    await auditService.logEconomyEvent('balance_validation', userId, {
      currency,
      requiredAmount: parseFloat(requiredAmount),
      sufficient: validation.sufficient,
      currentBalance: validation.currentBalance
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    walletOperationsTotal
      .labels('validate', 'success')
      .inc();
    
    res.json({
      success: true,
      data: validation
    });
    
  } catch (error) {
    walletOperationsTotal
      .labels('validate', 'failed')
      .inc();
    throw error;
  }
}));

// Get total circulation (admin only)
router.get('/circulation', asyncHandler(async (req, res) => {
  try {
    const circulation = await walletService.getTotalCirculation();
    
    await auditService.logEconomyEvent('circulation_view', req.user.id, {
      circulation: {
        totalCrowns: circulation.total_crowns,
        totalTokens: circulation.total_tokens,
        totalPoints: circulation.total_points,
        totalWallets: circulation.total_wallets
      }
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      data: circulation
    });
    
  } catch (error) {
    throw error;
  }
}));

// Create wallet (internal use)
router.post('/create', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  try {
    const wallet = await walletService.createWallet(userId);
    
    await auditService.logEconomyEvent('wallet_created', userId, {
      walletId: wallet.id
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    walletOperationsTotal
      .labels('create', 'success')
      .inc();
    
    res.status(201).json({
      success: true,
      data: {
        walletId: wallet.id,
        balances: {
          crowns: parseFloat(wallet.crowns_balance),
          tokens: parseFloat(wallet.tokens_balance),
          points: parseFloat(wallet.points_balance)
        },
        createdAt: wallet.created_at
      }
    });
    
  } catch (error) {
    walletOperationsTotal
      .labels('create', 'failed')
      .inc();
    throw error;
  }
}));

module.exports = router;
