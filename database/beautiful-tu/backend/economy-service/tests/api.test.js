const request = require('supertest');
const app = require('../src/app');
const { pool, redis } = require('../src/config/database');

describe('Economy Service API', () => {
  let authToken;
  let testUserId;

  beforeAll(async () => {
    // Setup test database and Redis
    // Create test user and get auth token
    testUserId = 'test-user-123';
    authToken = 'Bearer test-jwt-token';
  });

  afterAll(async () => {
    // Cleanup test data
    await pool.end();
    await redis.quit();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        service: 'economy-service'
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Wallet Endpoints', () => {
    it('should create and get wallet', async () => {
      // Create wallet
      const createResponse = await request(app)
        .post('/v1/wallet/create')
        .set('Authorization', authToken)
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.data.walletId).toBeDefined();
      expect(createResponse.body.data.balances).toEqual({
        crowns: 0,
        tokens: 0,
        points: 0
      });

      // Get wallet
      const getResponse = await request(app)
        .get('/v1/wallet')
        .set('Authorization', authToken)
        .expect(200);

      expect(getResponse.body.success).toBe(true);
      expect(getResponse.body.data.balances).toEqual({
        crowns: 0,
        tokens: 0,
        points: 0
      });
    });

    it('should get balance snapshot', async () => {
      const response = await request(app)
        .get('/v1/wallet/snapshot')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.balances).toBeDefined();
      expect(response.body.data.lastUpdated).toBeDefined();
    });

    it('should validate balance', async () => {
      const response = await request(app)
        .post('/v1/wallet/validate')
        .set('Authorization', authToken)
        .send({
          currency: 'tokens',
          requiredAmount: 100
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sufficient).toBe(false);
      expect(response.body.data.currentBalance).toBe(0);
      expect(response.body.data.requiredAmount).toBe(100);
    });
  });

  describe('Token Purchase Endpoints', () => {
    it('should create payment intent', async () => {
      const response = await request(app)
        .post('/v1/tokens/purchase')
        .set('Authorization', authToken)
        .send({
          amount: 10,
          currency: 'usd'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.clientSecret).toBeDefined();
      expect(response.body.data.paymentIntentId).toBeDefined();
      expect(response.body.data.amount).toBe(10);
      expect(response.body.data.currency).toBe('usd');
    });

    it('should reject invalid amount', async () => {
      const response = await request(app)
        .post('/v1/tokens/purchase')
        .set('Authorization', authToken)
        .send({
          amount: 0.5,
          currency: 'usd'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Minimum amount is $1');
    });
  });

  describe('Token Spending Endpoints', () => {
    it('should validate spending before operation', async () => {
      const response = await request(app)
        .post('/v1/tokens/validate')
        .set('Authorization', authToken)
        .send({
          amount: 100,
          type: 'tip'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(false);
      expect(response.body.data.reason).toContain('Insufficient balance');
    });

    it('should reject spending with insufficient balance', async () => {
      const response = await request(app)
        .post('/v1/tokens/spend')
        .set('Authorization', authToken)
        .send({
          amount: 100,
          type: 'tip',
          recipientId: 'test-creator-456'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Insufficient token balance');
    });
  });

  describe('Payout Endpoints', () => {
    it('should check payout eligibility', async () => {
      const response = await request(app)
        .get('/v1/payouts/eligibility')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.eligible).toBe(false);
      expect(response.body.data.reasons).toContain('Minimum 1000 points required');
    });

    it('should validate payout request', async () => {
      const response = await request(app)
        .post('/v1/payouts/validate')
        .set('Authorization', authToken)
        .send({
          amount: 10,
          payoutMethod: 'paypal',
          payoutDetails: {
            email: 'test@example.com'
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(false);
      expect(response.body.data.reason).toContain('Insufficient points');
    });

    it('should get payout methods', async () => {
      const response = await request(app)
        .get('/v1/payouts/methods')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.stripe).toBeDefined();
      expect(response.body.data.paypal).toBeDefined();
      expect(response.body.data.bank_transfer).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing authorization', async () => {
      const response = await request(app)
        .get('/v1/wallet')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('should handle invalid endpoints', async () => {
      const response = await request(app)
        .get('/v1/invalid-endpoint')
        .set('Authorization', authToken)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/v1/tokens/purchase')
        .set('Authorization', authToken)
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });
  });

  describe('Metrics Endpoint', () => {
    it('should return metrics', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
    });
  });
});
