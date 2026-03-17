const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const logger = require('../config/logger');
const WalletService = require('./WalletService');

class PaymentService {
  constructor() {
    this.walletService = new WalletService();
  }

  async createPaymentIntent(userId, amount, currency = 'usd', paymentMethod = null) {
    try {
      // Validate amount
      if (amount < 1) {
        throw new Error('Minimum amount is $1');
      }
      
      if (amount > 10000) {
        throw new Error('Maximum amount is $10,000');
      }
      
      // Create Stripe payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        payment_method: paymentMethod,
        confirmation_method: paymentMethod ? 'manual' : 'automatic',
        confirm: paymentMethod ? false : false,
        metadata: {
          userId,
          service: 'arena-economy'
        },
        automatic_payment_methods: {
          enabled: paymentMethod ? false : true,
        },
      });

      // Store payment intent in database
      const { pool } = require('../config/database');
      const query = `
        INSERT INTO payment_intents (
          id, user_id, amount, currency, status, provider, 
          provider_intent_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING *
      `;
      
      const result = await pool.query(query, [
        paymentIntent.id,
        userId,
        amount,
        currency,
        paymentIntent.status,
        'stripe',
        paymentIntent.id
      ]);

      logger.info(`Created payment intent: ${paymentIntent.id} for user: ${userId}, amount: $${amount}`);
      
      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount,
        currency,
        status: paymentIntent.status
      };
      
    } catch (error) {
      logger.error('Failed to create payment intent:', error);
      throw error;
    }
  }

  async confirmPayment(paymentIntentId, userId) {
    try {
      // Retrieve payment intent from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      // Verify user ownership
      if (paymentIntent.metadata.userId !== userId) {
        throw new Error('Payment intent does not belong to user');
      }
      
      // Update database record
      const { pool } = require('../config/database');
      const updateQuery = `
        UPDATE payment_intents 
        SET status = $1, updated_at = NOW()
        WHERE id = $2 AND user_id = $3
        RETURNING *
      `;
      
      const result = await pool.query(updateQuery, [
        paymentIntent.status,
        paymentIntentId,
        userId
      ]);
      
      if (result.rows.length === 0) {
        throw new Error('Payment intent not found');
      }

      // If payment is successful, process token purchase
      if (paymentIntent.status === 'succeeded') {
        await this.processSuccessfulPayment(paymentIntent, userId);
      }
      
      logger.info(`Payment confirmed: ${paymentIntentId}, status: ${paymentIntent.status}`);
      
      return {
        paymentIntentId,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency
      };
      
    } catch (error) {
      logger.error('Failed to confirm payment:', error);
      throw error;
    }
  }

  async processSuccessfulPayment(paymentIntent, userId) {
    try {
      const amount = paymentIntent.amount / 100; // Convert from cents
      
      // Calculate token amount (1 USD = 100 tokens)
      const tokenAmount = Math.round(amount * 100);
      
      // Update wallet
      const walletUpdate = await this.walletService.updateBalance(
        userId,
        'tokens',
        tokenAmount,
        'add',
        paymentIntent.id,
        `Token purchase - $${amount}`
      );
      
      // Create token purchase record
      const { pool } = require('../config/database');
      const purchaseQuery = `
        INSERT INTO token_purchases (
          user_id, amount_usd, tokens_received, provider, 
          provider_transaction_id, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `;
      
      const purchaseResult = await pool.query(purchaseQuery, [
        userId,
        amount,
        tokenAmount,
        'stripe',
        paymentIntent.id,
        'completed'
      ]);
      
      logger.info(`Processed successful payment: ${paymentIntent.id}, user: ${userId}, amount: $${amount}, tokens: ${tokenAmount}`);
      
      return {
        walletUpdate,
        purchase: purchaseResult.rows[0]
      };
      
    } catch (error) {
      logger.error('Failed to process successful payment:', error);
      throw error;
    }
  }

  async createSetupIntent(userId) {
    try {
      const setupIntent = await stripe.setupIntents.create({
        customer: userId, // In production, you'd use Stripe customer ID
        metadata: {
          userId,
          service: 'arena-economy'
        }
      });

      logger.info(`Created setup intent: ${setupIntent.id} for user: ${userId}`);
      
      return {
        clientSecret: setupIntent.client_secret,
        setupIntentId: setupIntent.id
      };
      
    } catch (error) {
      logger.error('Failed to create setup intent:', error);
      throw error;
    }
  }

  async attachPaymentMethod(paymentMethodId, userId) {
    try {
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      
      // In production, you'd attach to a Stripe customer
      // For now, we'll just validate the payment method
      
      logger.info(`Attached payment method: ${paymentMethodId} for user: ${userId}`);
      
      return {
        paymentMethodId,
        type: paymentMethod.type,
        last4: paymentMethod.card?.last4,
        brand: paymentMethod.card?.brand,
        expiryMonth: paymentMethod.card?.exp_month,
        expiryYear: paymentMethod.card?.exp_year
      };
      
    } catch (error) {
      logger.error('Failed to attach payment method:', error);
      throw error;
    }
  }

  async refundPayment(paymentIntentId, amount = null, reason = 'requested_by_customer') {
    try {
      let refundParams = {
        payment_intent: paymentIntentId,
        reason
      };
      
      if (amount) {
        refundParams.amount = Math.round(amount * 100); // Convert to cents
      }
      
      const refund = await stripe.refunds.create(refundParams);
      
      // Update database
      const { pool } = require('../config/database');
      const updateQuery = `
        UPDATE payment_intents 
        SET refunded = true, refund_amount = COALESCE(refund_amount, 0) + $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      
      const result = await pool.query(updateQuery, [
        refund.amount / 100, // Convert from cents
        paymentIntentId
      ]);
      
      // If refund is successful, reverse token purchase
      if (refund.status === 'succeeded') {
        await this.processRefund(paymentIntentId, refund.amount / 100);
      }
      
      logger.info(`Refund processed: ${refund.id} for payment: ${paymentIntentId}, amount: $${refund.amount / 100}`);
      
      return {
        refundId: refund.id,
        paymentIntentId,
        amount: refund.amount / 100,
        status: refund.status,
        reason
      };
      
    } catch (error) {
      logger.error('Failed to refund payment:', error);
      throw error;
    }
  }

  async processRefund(paymentIntentId, refundAmount) {
    try {
      // Find the original purchase
      const { pool } = require('../config/database');
      const purchaseQuery = `
        SELECT * FROM token_purchases
        WHERE provider_transaction_id = $1 AND status = 'completed'
      `;
      
      const purchaseResult = await pool.query(purchaseQuery, [paymentIntentId]);
      
      if (purchaseResult.rows.length === 0) {
        throw new Error('Original purchase not found');
      }
      
      const purchase = purchaseResult.rows[0];
      
      // Calculate tokens to refund (proportional)
      const tokensToRefund = Math.round((refundAmount / purchase.amount_usd) * purchase.tokens_received);
      
      // Update wallet (subtract tokens)
      await this.walletService.updateBalance(
        purchase.user_id,
        'tokens',
        tokensToRefund,
        'subtract',
        `refund_${paymentIntentId}`,
        `Refund - $${refundAmount}`
      );
      
      // Update purchase record
      const updatePurchaseQuery = `
        UPDATE token_purchases
        SET status = 'refunded', refunded_amount = COALESCE(refunded_amount, 0) + $1, updated_at = NOW()
        WHERE id = $2
      `;
      
      await pool.query(updatePurchaseQuery, [refundAmount, purchase.id]);
      
      logger.info(`Processed refund: ${paymentIntentId}, user: ${purchase.user_id}, amount: $${refundAmount}, tokens: ${tokensToRefund}`);
      
    } catch (error) {
      logger.error('Failed to process refund:', error);
      throw error;
    }
  }

  async getPaymentHistory(userId, options = {}) {
    try {
      const {
        limit = 20,
        offset = 0,
        status = null,
        startDate = null,
        endDate = null
      } = options;
      
      const { pool } = require('../config/database');
      
      let query = `
        SELECT pi.*, tp.tokens_received, tp.status as purchase_status
        FROM payment_intents pi
        LEFT JOIN token_purchases tp ON pi.id = tp.provider_transaction_id
        WHERE pi.user_id = $1
      `;
      
      const params = [userId];
      let paramIndex = 2;
      
      if (status) {
        query += ` AND pi.status = $${paramIndex++}`;
        params.push(status);
      }
      
      if (startDate) {
        query += ` AND pi.created_at >= $${paramIndex++}`;
        params.push(startDate);
      }
      
      if (endDate) {
        query += ` AND pi.created_at <= $${paramIndex++}`;
        params.push(endDate);
      }
      
      query += `
        ORDER BY pi.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      
      params.push(limit, offset);
      
      const result = await pool.query(query, params);
      
      return {
        payments: result.rows,
        limit,
        offset
      };
      
    } catch (error) {
      logger.error('Failed to get payment history:', error);
      throw error;
    }
  }

  async validatePaymentMethod(paymentMethodId) {
    try {
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      
      return {
        valid: true,
        type: paymentMethod.type,
        card: paymentMethod.card ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          expiryMonth: paymentMethod.card.exp_month,
          expiryYear: paymentMethod.card.exp_year,
          funding: paymentMethod.card.funding
        } : null
      };
      
    } catch (error) {
      logger.error('Failed to validate payment method:', error);
      return { valid: false, error: error.message };
    }
  }
}

module.exports = PaymentService;
