const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const SubscriptionService = require('../services/SubscriptionService');

const router = express.Router();
const subscriptionService = new SubscriptionService();

// Create subscription
router.post('/subscribe', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { tier, paymentMethodId } = req.body;
  
  const subscription = await subscriptionService.createSubscription(userId, tier, paymentMethodId);
  res.status(201).json({ success: true, data: subscription });
}));

// Cancel subscription
router.post('/cancel', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { subscriptionId } = req.body;
  
  const subscription = await subscriptionService.cancelSubscription(userId, subscriptionId);
  res.json({ success: true, data: subscription });
}));

// Get user subscription
router.get('/my-subscription', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  const subscription = await subscriptionService.getUserSubscription(userId);
  res.json({ success: true, data: subscription });
}));

// Get subscription tiers
router.get('/tiers', asyncHandler(async (req, res) => {
  const tiers = {
    basic: { price: 4.99, stipend: 50, features: ['ad_light', 'limited_replay', 'profile_customization'] },
    plus: { price: 9.99, stipend: 150, features: ['no_ads', 'full_replay', 'advanced_analytics', 'priority_tournament'] },
    creator: { price: 19.99, stipend: 300, features: ['all_plus', 'creator_tools', 'promotion', 'direct_support'] }
  };
  
  res.json({ success: true, data: tiers });
}));

module.exports = router;
