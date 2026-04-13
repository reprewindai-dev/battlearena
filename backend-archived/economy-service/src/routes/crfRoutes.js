const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { adminMiddleware } = require('../middleware/auth');
const CommunityRewardsService = require('../services/CommunityRewardsService');

const router = express.Router();
const crfService = new CommunityRewardsService();

// Add CRF contribution (admin only)
router.post('/contributions', adminMiddleware, asyncHandler(async (req, res) => {
  const { amount, source = 'platform_revenue' } = req.body;
  const contribution = await crfService.addCRFContribution(parseFloat(amount), source);
  res.status(201).json({ success: true, data: contribution });
}));

// Create tournament prize (admin only)
router.post('/tournament-prizes', adminMiddleware, asyncHandler(async (req, res) => {
  const { name, amount, tournamentId } = req.body;
  const prize = await crfService.createTournamentPrize(name, parseFloat(amount), tournamentId);
  res.status(201).json({ success: true, data: prize });
}));

// Get CRF summary (admin only)
router.get('/summary', adminMiddleware, asyncHandler(async (req, res) => {
  const summary = await crfService.getCRFSummary();
  res.json({ success: true, data: summary });
}));

module.exports = router;