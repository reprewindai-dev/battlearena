const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');

const { metricsRouter, registerDefaultMetrics, metricsMiddleware } = require('./config/metrics');
const logger = require('./config/logger');
const { initializeConnections, closeConnections } = require('./config/database');
const { errorHandler } = require('./middleware/errorHandler');
const { authMiddleware, adminMiddleware } = require('./middleware/auth');

const purchaseRoutes = require('./routes/purchaseRoutes');
const walletRoutes = require('./routes/walletRoutes');
const spendRoutes = require('./routes/spendRoutes');
const payoutRoutes = require('./routes/payoutRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const crfRoutes = require('./routes/crfRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const ppvRoutes = require('./routes/ppvRoutes');

// Initialize database connections
initializeConnections().catch(error => {
  logger.error('Failed to initialize database connections:', error);
  process.exit(1);
});

registerDefaultMetrics();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ 
  origin: process.env.CORS_ORIGIN || true, 
  credentials: true 
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Logging
app.use(pinoHttp({ logger }));

// Metrics
app.use(metricsMiddleware);

// Rate limiting
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.'
    }
  })
);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'economy-service', 
    timestamp: Date.now(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Metrics endpoint
app.use('/metrics', metricsRouter);

// Public routes (no auth required)
app.use('/v1/providers', webhookRoutes);

// Authenticated routes
app.use('/v1', authMiddleware);
app.use('/v1/wallet', walletRoutes);
app.use('/v1/tokens', purchaseRoutes);
app.use('/v1/tokens', spendRoutes);
app.use('/v1/payouts', payoutRoutes);
app.use('/v1/subscriptions', subscriptionRoutes);
app.use('/v1/ppv', ppvRoutes);

// Admin routes
app.use('/v1/admin', adminMiddleware);
app.use('/v1/crf', crfRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found'
    }
  });
});

// Error handling (must be last)
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await closeConnections();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await closeConnections();
  process.exit(0);
});

module.exports = app;
