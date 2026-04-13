const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const PPVService = require('../services/PPVService');

const router = express.Router();
const ppvService = new PPVService();

// Create PPV event (admin only)
router.post('/events', asyncHandler(async (req, res) => {
  const { title, description, price, startTime, options = {} } = req.body;
  
  const event = await ppvService.createPPVEvent(title, description, parseFloat(price), startTime, options);
  res.status(201).json({ success: true, data: event });
}));

// Get PPV events
router.get('/events', asyncHandler(async (req, res) => {
  const options = {
    status: req.query.status,
    limit: parseInt(req.query.limit) || 20,
    offset: parseInt(req.query.offset) || 0,
    startDate: req.query.startDate,
    endDate: req.query.endDate
  };
  
  const events = await ppvService.getPPVEvents(options);
  res.json({ success: true, data: events });
}));

// Get PPV event details
router.get('/events/:eventId', asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  
  const event = await ppvService.getPPVEvent(eventId);
  if (!event) {
    return res.status(404).json({ success: false, error: 'Event not found' });
  }
  
  res.json({ success: true, data: event });
}));

// Purchase PPV access
router.post('/purchase', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { eventId, paymentMethodId } = req.body;
  
  const result = await ppvService.purchasePPVAccess(userId, eventId, paymentMethodId);
  res.status(201).json({ success: true, data: result });
}));

// Confirm PPV purchase
router.post('/confirm', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { paymentIntentId } = req.body;
  
  const result = await ppvService.confirmPPVPurchase(paymentIntentId, userId);
  res.json({ success: true, data: result });
}));

// Get user's PPV purchases
router.get('/my-purchases', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const options = {
    limit: parseInt(req.query.limit) || 20,
    offset: parseInt(req.query.offset) || 0,
    status: req.query.status
  };
  
  const purchases = await ppvService.getUserPPVPurchases(userId, options);
  res.json({ success: true, data: purchases });
}));

// Update PPV event status (admin only)
router.patch('/events/:eventId/status', asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { status } = req.body;
  
  const event = await ppvService.updatePPVEventStatus(eventId, status);
  res.json({ success: true, data: event });
}));

module.exports = router;
