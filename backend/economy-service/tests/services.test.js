const WalletService = require('../src/services/WalletService');
const TokenService = require('../src/services/TokenService');
const PaymentService = require('../src/services/PaymentService');
const { pool } = require('../src/config/database');

describe('Economy Services', () => {
  let walletService;
  let tokenService;
  let paymentService;
  let testUserId;

  beforeAll(async () => {
    walletService = new WalletService();
    tokenService = new TokenService();
    paymentService = new PaymentService();
    testUserId = 'test-user-service-' + Date.now();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('WalletService', () => {
    it('should create a new wallet', async () => {
      const wallet = await walletService.createWallet(testUserId);
      
      expect(wallet.user_id).toBe(testUserId);
      expect(parseFloat(wallet.crowns_balance)).toBe(0);
      expect(parseFloat(wallet.tokens_balance)).toBe(0);
      expect(parseFloat(wallet.points_balance)).toBe(0);
    });

    it('should get existing wallet', async () => {
      const wallet = await walletService.getWallet(testUserId);
      
      expect(wallet.user_id).toBe(testUserId);
      expect(wallet.crowns_balance).toBeDefined();
      expect(wallet.tokens_balance).toBeDefined();
      expect(wallet.points_balance).toBeDefined();
    });

    it('should add tokens to wallet', async () => {
      const result = await walletService.updateBalance(
        testUserId,
        'tokens',
        100,
        'add',
        'test-add',
        'Test addition'
      );
      
      expect(parseFloat(result.wallet.tokens_balance)).toBe(100);
      expect(result.auditLog.operation).toBe('add');
      expect(result.auditLog.amount).toBe('100');
    });

    it('should subtract tokens from wallet', async () => {
      const result = await walletService.updateBalance(
        testUserId,
        'tokens',
        50,
        'subtract',
        'test-subtract',
        'Test subtraction'
      );
      
      expect(parseFloat(result.wallet.tokens_balance)).toBe(50);
      expect(result.auditLog.operation).toBe('subtract');
      expect(result.auditLog.amount).toBe('50');
    });

    it('should validate balance correctly', async () => {
      const validation = await walletService.validateBalance(testUserId, 'tokens', 25);
      
      expect(validation.sufficient).toBe(true);
      expect(validation.currentBalance).toBe(50);
      expect(validation.requiredAmount).toBe(25);
      expect(validation.shortfall).toBe(0);
    });

    it('should reject insufficient balance', async () => {
      const validation = await walletService.validateBalance(testUserId, 'tokens', 100);
      
      expect(validation.sufficient).toBe(false);
      expect(validation.currentBalance).toBe(50);
      expect(validation.requiredAmount).toBe(100);
      expect(validation.shortfall).toBe(50);
    });

    it('should get balance snapshot', async () => {
      const snapshot = await walletService.getBalanceSnapshot(testUserId);
      
      expect(snapshot.balances.tokens).toBe(50);
      expect(snapshot.balances.crowns).toBe(0);
      expect(snapshot.balances.points).toBe(0);
      expect(snapshot.lastUpdated).toBeDefined();
    });
  });

  describe('TokenService', () => {
    it('should validate spending correctly', async () => {
      const validation = await tokenService.validateSpending(testUserId, 25, 'tip');
      
      expect(validation.valid).toBe(true);
      expect(validation.currentBalance).toBe(50);
    });

    it('should reject invalid spending amount', async () => {
      const validation = await tokenService.validateSpending(testUserId, 100, 'tip');
      
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('Insufficient balance');
    });

    it('should spend tokens successfully', async () => {
      const result = await tokenService.spendTokens(
        testUserId,
        25,
        'tip',
        'test-tip-123',
        'Test tip',
        'test-recipient-456'
      );
      
      expect(parseFloat(result.walletUpdate.wallet.tokens_balance)).toBe(25);
      expect(result.spending.amount).toBe('25');
      expect(result.spending.type).toBe('tip');
      expect(result.spending.recipient_id).toBe('test-recipient-456');
    });

    it('should tip creator successfully', async () => {
      const result = await tokenService.tipCreator(
        testUserId,
        'test-creator-789',
        10,
        'test-battle-123',
        'Test tip to creator'
      );
      
      expect(parseFloat(result.walletUpdate.wallet.tokens_balance)).toBe(15);
      expect(result.tip.amount).toBe('10');
      expect(result.tip.creator_id).toBe('test-creator-789');
      expect(result.tip.battle_id).toBe('test-battle-123');
    });

    it('should pay entry fee successfully', async () => {
      const result = await tokenService.payEntryFee(
        testUserId,
        'test-battle-456',
        5
      );
      
      expect(parseFloat(result.walletUpdate.wallet.tokens_balance)).toBe(10);
      expect(result.entry.amount).toBe('5');
      expect(result.entry.battle_id).toBe('test-battle-456');
    });

    it('should purchase item successfully', async () => {
      const result = await tokenService.purchaseItem(
        testUserId,
        'test-item-123',
        'badge',
        3,
        'Test badge purchase'
      );
      
      expect(parseFloat(result.walletUpdate.wallet.tokens_balance)).toBe(7);
      expect(result.purchase.amount).toBe('3');
      expect(result.purchase.item_type).toBe('badge');
    });
  });

  describe('PaymentService', () => {
    it('should validate payment method', async () => {
      // Mock Stripe payment method
      const validation = await paymentService.validatePaymentMethod('pm_test_123');
      
      // This will fail in test environment without real Stripe setup
      expect(validation.valid).toBe(false);
      expect(validation.error).toBeDefined();
    });

    it('should get payment history', async () => {
      const history = await paymentService.getPaymentHistory(testUserId);
      
      expect(history.payments).toBeDefined();
      expect(history.limit).toBe(20);
      expect(history.offset).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete token flow', async () => {
      // Add tokens to wallet
      await walletService.updateBalance(testUserId, 'tokens', 100, 'add', 'integration-test');
      
      // Spend tokens
      const spendResult = await tokenService.spendTokens(
        testUserId,
        50,
        'tip',
        'integration-tip',
        'Integration test tip'
      );
      
      expect(parseFloat(spendResult.walletUpdate.wallet.tokens_balance)).toBe(57);
      
      // Verify audit trail
      const history = await walletService.getTransactionHistory(testUserId);
      expect(history.transactions.length).toBeGreaterThan(0);
      
      // Check final balance
      const finalWallet = await walletService.getWallet(testUserId);
      expect(parseFloat(finalWallet.tokens_balance)).toBe(57);
    });
  });
});
