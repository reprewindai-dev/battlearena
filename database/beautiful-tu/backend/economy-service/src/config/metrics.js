const client = require('prom-client');

// Create a Registry
const register = new client.Registry();

// Add a default label which can be used to filter metrics
register.setDefaultLabels({
  app: 'economy-service'
});

// Enable the collection of default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const tokenPurchasesTotal = new client.Counter({
  name: 'token_purchases_total',
  help: 'Total number of token purchases',
  labelNames: ['provider', 'status']
});

const tokenPurchaseAmount = new client.Histogram({
  name: 'token_purchase_amount_dollars',
  help: 'Amount of token purchases in dollars',
  labelNames: ['provider'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000]
});

const tokenSpendingTotal = new client.Counter({
  name: 'token_spending_total',
  help: 'Total number of token spending operations',
  labelNames: ['type', 'status']
});

const tokenSpendingAmount = new client.Histogram({
  name: 'token_spending_amount_tokens',
  help: 'Amount of tokens spent',
  labelNames: ['type'],
  buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
});

const walletOperationsTotal = new client.Counter({
  name: 'wallet_operations_total',
  help: 'Total number of wallet operations',
  labelNames: ['operation', 'status']
});

const payoutRequestsTotal = new client.Counter({
  name: 'payout_requests_total',
  help: 'Total number of payout requests',
  labelNames: ['status']
});

const payoutAmount = new client.Histogram({
  name: 'payout_amount_dollars',
  help: 'Amount of payouts in dollars',
  buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
});

const activeUsersGauge = new client.Gauge({
  name: 'active_users',
  help: 'Number of active users'
});

const totalTokensGauge = new client.Gauge({
  name: 'total_tokens_in_circulation',
  help: 'Total number of tokens in circulation'
});

const totalRevenueGauge = new client.Gauge({
  name: 'total_revenue_dollars',
  help: 'Total revenue in dollars'
});

// Register all metrics
register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDuration);
register.registerMetric(tokenPurchasesTotal);
register.registerMetric(tokenPurchaseAmount);
register.registerMetric(tokenSpendingTotal);
register.registerMetric(tokenSpendingAmount);
register.registerMetric(walletOperationsTotal);
register.registerMetric(payoutRequestsTotal);
register.registerMetric(payoutAmount);
register.registerMetric(activeUsersGauge);
register.registerMetric(totalTokensGauge);
register.registerMetric(totalRevenueGauge);

// Metrics middleware
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    
    httpRequestsTotal
      .labels(req.method, route, res.statusCode)
      .inc();
      
    httpRequestDuration
      .labels(req.method, route)
      .observe(duration);
  });
  
  next();
};

// Metrics router
const { Router } = require('express');
const metricsRouter = Router();

metricsRouter.get('/', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error);
  }
});

const registerDefaultMetrics = () => {
  // Default metrics already registered above
};

module.exports = {
  register,
  metricsRouter,
  metricsMiddleware,
  registerDefaultMetrics,
  // Individual metrics for use in other modules
  httpRequestsTotal,
  httpRequestDuration,
  tokenPurchasesTotal,
  tokenPurchaseAmount,
  tokenSpendingTotal,
  tokenSpendingAmount,
  walletOperationsTotal,
  payoutRequestsTotal,
  payoutAmount,
  activeUsersGauge,
  totalTokensGauge,
  totalRevenueGauge
};
