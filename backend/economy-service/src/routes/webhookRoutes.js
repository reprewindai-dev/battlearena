const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const crypto = require('crypto');
const PaymentService = require('../services/PaymentService');
const TokenService = require('../services/TokenService');
const PayoutService = require('../services/PayoutService');
const auditService = require('../services/AuditService');
const logger = require('../config/logger');

const router = express.Router();
const paymentService = new PaymentService();
const tokenService = new TokenService();
const payoutService = new PayoutService();

// Stripe webhook
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    logger.error('Stripe webhook secret not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    logger.error('Stripe webhook signature verification failed:', err);
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }
  
  try {
    // Log the webhook event
    await auditService.logEconomyEvent('stripe_webhook_received', 'system', {
      eventId: event.id,
      type: event.type,
      created: event.created
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
        
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;
        
      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event.data.object);
        break;
        
      case 'charge.succeeded':
        await handleChargeSucceeded(event.data.object);
        break;
        
      case 'charge.failed':
        await handleChargeFailed(event.data.object);
        break;
        
      case 'charge.dispute.created':
        await handleChargeDisputeCreated(event.data.object);
        break;
        
      case 'payout.created':
        await handlePayoutCreated(event.data.object);
        break;
        
      case 'payout.failed':
        await handlePayoutFailed(event.data.object);
        break;
        
      case 'account.updated':
        await handleAccountUpdated(event.data.object);
        break;
        
      default:
        logger.info(`Unhandled Stripe webhook event type: ${event.type}`);
    }
    
    res.json({ received: true });
    
  } catch (error) {
    logger.error('Error processing Stripe webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}));

// PayPal webhook
router.post('/paypal/webhook', express.json(), asyncHandler(async (req, res) => {
  const headers = req.headers;
  const body = req.body;
  
  // Verify PayPal webhook signature
  const isValid = await verifyPayPalWebhook(headers, body);
  
  if (!isValid) {
    logger.error('PayPal webhook signature verification failed');
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }
  
  try {
    const eventType = body.event_type;
    const resource = body.resource;
    
    await auditService.logEconomyEvent('paypal_webhook_received', 'system', {
      eventType,
      resourceId: resource.id,
      eventTypeVersion: body.event_version
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    switch (eventType) {
      case 'PAYMENT.SALE.COMPLETED':
        await handlePayPalPaymentCompleted(resource);
        break;
        
      case 'PAYMENT.SALE.DENIED':
        await handlePayPalPaymentDenied(resource);
        break;
        
      case 'PAYMENT.SALE.REFUNDED':
        await handlePayPalPaymentRefunded(resource);
        break;
        
      case 'PAYOUT-SUCCESS':
        await handlePayPalPayoutSuccess(resource);
        break;
        
      case 'PAYOUT-FAILED':
        await handlePayPalPayoutFailed(resource);
        break;
        
      default:
        logger.info(`Unhandled PayPal webhook event type: ${eventType}`);
    }
    
    res.json({ received: true });
    
  } catch (error) {
    logger.error('Error processing PayPal webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}));

// Adyen webhook
router.post('/adyen/webhook', express.json(), asyncHandler(async (req, res) => {
  const notifications = req.body.notificationItems;
  
  if (!notifications || !Array.isArray(notifications)) {
    return res.status(400).json({ error: 'Invalid webhook format' });
  }
  
  try {
    for (const notification of notifications) {
      const event = notification.NotificationRequestItem;
      
      // Verify Adyen webhook signature
      const isValid = await verifyAdyenWebhook(event);
      
      if (!isValid) {
        logger.error('Adyen webhook signature verification failed');
        continue;
      }
      
      await auditService.logEconomyEvent('adyen_webhook_received', 'system', {
        eventCode: event.eventCode,
        pspReference: event.pspReference,
        merchantReference: event.merchantReference
      }, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      switch (event.eventCode) {
        case 'AUTHORISATION':
          await handleAdyenAuthorization(event);
          break;
          
        case 'CAPTURE':
          await handleAdyenCapture(event);
          break;
          
        case 'CANCELLATION':
          await handleAdyenCancellation(event);
          break;
          
        case 'REFUND':
          await handleAdyenRefund(event);
          break;
          
        case 'CHARGEBACK':
          await handleAdyenChargeback(event);
          break;
          
        case 'PAYOUT':
          await handleAdyenPayout(event);
          break;
          
        default:
          logger.info(`Unhandled Adyen webhook event code: ${event.eventCode}`);
      }
    }
    
    res.json({ received: true });
    
  } catch (error) {
    logger.error('Error processing Adyen webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}));

// Stripe webhook handlers
async function handlePaymentIntentSucceeded(paymentIntent) {
  try {
    const userId = paymentIntent.metadata.userId;
    
    if (!userId) {
      logger.error('Payment intent missing user ID:', paymentIntent.id);
      return;
    }
    
    // Process the successful payment
    await paymentService.processSuccessfulPayment(paymentIntent, userId);
    
    logger.info(`Stripe payment succeeded: ${paymentIntent.id} for user ${userId}`);
    
  } catch (error) {
    logger.error('Error handling payment intent succeeded:', error);
  }
}

async function handlePaymentIntentFailed(paymentIntent) {
  try {
    const userId = paymentIntent.metadata.userId;
    
    if (!userId) {
      logger.error('Payment intent missing user ID:', paymentIntent.id);
      return;
    }
    
    await auditService.logEconomyEvent('payment_failed', userId, {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      lastPaymentError: paymentIntent.last_payment_error
    });
    
    logger.info(`Stripe payment failed: ${paymentIntent.id} for user ${userId}`);
    
  } catch (error) {
    logger.error('Error handling payment intent failed:', error);
  }
}

async function handlePaymentIntentCanceled(paymentIntent) {
  try {
    const userId = paymentIntent.metadata.userId;
    
    if (!userId) {
      logger.error('Payment intent missing user ID:', paymentIntent.id);
      return;
    }
    
    await auditService.logEconomyEvent('payment_canceled', userId, {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency
    });
    
    logger.info(`Stripe payment canceled: ${paymentIntent.id} for user ${userId}`);
    
  } catch (error) {
    logger.error('Error handling payment intent canceled:', error);
  }
}

async function handleChargeSucceeded(charge) {
  try {
    const userId = charge.metadata.userId;
    
    if (!userId) {
      logger.error('Charge missing user ID:', charge.id);
      return;
    }
    
    await auditService.logEconomyEvent('charge_succeeded', userId, {
      chargeId: charge.id,
      amount: charge.amount / 100,
      currency: charge.currency,
      paymentMethodId: charge.payment_method
    });
    
    logger.info(`Stripe charge succeeded: ${charge.id} for user ${userId}`);
    
  } catch (error) {
    logger.error('Error handling charge succeeded:', error);
  }
}

async function handleChargeFailed(charge) {
  try {
    const userId = charge.metadata.userId;
    
    if (!userId) {
      logger.error('Charge missing user ID:', charge.id);
      return;
    }
    
    await auditService.logEconomyEvent('charge_failed', userId, {
      chargeId: charge.id,
      amount: charge.amount / 100,
      currency: charge.currency,
      failureCode: charge.failure_code,
      failureMessage: charge.failure_message
    });
    
    logger.info(`Stripe charge failed: ${charge.id} for user ${userId}`);
    
  } catch (error) {
    logger.error('Error handling charge failed:', error);
  }
}

async function handleChargeDisputeCreated(charge) {
  try {
    const userId = charge.metadata.userId;
    
    if (!userId) {
      logger.error('Charge missing user ID:', charge.id);
      return;
    }
    
    await auditService.logEconomyEvent('charge_dispute_created', userId, {
      chargeId: charge.id,
      amount: charge.amount / 100,
      currency: charge.currency,
      disputeId: charge.dispute
    });
    
    logger.warn(`Stripe charge dispute created: ${charge.id} for user ${userId}`);
    
  } catch (error) {
    logger.error('Error handling charge dispute created:', error);
  }
}

async function handlePayoutCreated(payout) {
  try {
    await auditService.logEconomyEvent('stripe_payout_created', 'system', {
      payoutId: payout.id,
      amount: payout.amount / 100,
      currency: payout.currency,
      destination: payout.destination
    });
    
    logger.info(`Stripe payout created: ${payout.id}`);
    
  } catch (error) {
    logger.error('Error handling payout created:', error);
  }
}

async function handlePayoutFailed(payout) {
  try {
    await auditService.logEconomyEvent('stripe_payout_failed', 'system', {
      payoutId: payout.id,
      amount: payout.amount / 100,
      currency: payout.currency,
      failureCode: payout.failure_code,
      failureMessage: payout.failure_message
    });
    
    logger.warn(`Stripe payout failed: ${payout.id}`);
    
  } catch (error) {
    logger.error('Error handling payout failed:', error);
  }
}

async function handleAccountUpdated(account) {
  try {
    await auditService.logEconomyEvent('stripe_account_updated', account.metadata?.userId || 'system', {
      accountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      requirements: account.requirements
    });
    
    logger.info(`Stripe account updated: ${account.id}`);
    
  } catch (error) {
    logger.error('Error handling account updated:', error);
  }
}

// PayPal webhook handlers
async function handlePayPalPaymentCompleted(resource) {
  try {
    const paymentId = resource.id;
    const amount = parseFloat(resource.amount.total);
    const currency = resource.amount.currency;
    
    await auditService.logEconomyEvent('paypal_payment_completed', 'system', {
      paymentId,
      amount,
      currency
    });
    
    logger.info(`PayPal payment completed: ${paymentId} for amount ${amount} ${currency}`);
    
  } catch (error) {
    logger.error('Error handling PayPal payment completed:', error);
  }
}

async function handlePayPalPaymentDenied(resource) {
  try {
    const paymentId = resource.id;
    const amount = parseFloat(resource.amount.total);
    const currency = resource.amount.currency;
    
    await auditService.logEconomyEvent('paypal_payment_denied', 'system', {
      paymentId,
      amount,
      currency
    });
    
    logger.warn(`PayPal payment denied: ${paymentId}`);
    
  } catch (error) {
    logger.error('Error handling PayPal payment denied:', error);
  }
}

async function handlePayPalPaymentRefunded(resource) {
  try {
    const saleId = resource.id;
    const amount = parseFloat(resource.amount.total);
    const currency = resource.amount.currency;
    
    await auditService.logEconomyEvent('paypal_payment_refunded', 'system', {
      saleId,
      amount,
      currency
    });
    
    logger.info(`PayPal payment refunded: ${saleId} for amount ${amount} ${currency}`);
    
  } catch (error) {
    logger.error('Error handling PayPal payment refunded:', error);
  }
}

async function handlePayPalPayoutSuccess(resource) {
  try {
    const payoutId = resource.payout_batch_id;
    const amount = parseFloat(resource.payout_item.amount.value);
    const currency = resource.payout_item.amount.currency;
    
    await auditService.logEconomyEvent('paypal_payout_success', 'system', {
      payoutId,
      amount,
      currency
    });
    
    logger.info(`PayPal payout successful: ${payoutId}`);
    
  } catch (error) {
    logger.error('Error handling PayPal payout success:', error);
  }
}

async function handlePayPalPayoutFailed(resource) {
  try {
    const payoutId = resource.payout_batch_id;
    const amount = parseFloat(resource.payout_item.amount.value);
    const currency = resource.payout_item.amount.currency;
    
    await auditService.logEconomyEvent('paypal_payout_failed', 'system', {
      payoutId,
      amount,
      currency
    });
    
    logger.warn(`PayPal payout failed: ${payoutId}`);
    
  } catch (error) {
    logger.error('Error handling PayPal payout failed:', error);
  }
}

// Adyen webhook handlers
async function handleAdyenAuthorization(event) {
  try {
    await auditService.logEconomyEvent('adyen_authorization', 'system', {
      pspReference: event.pspReference,
      merchantReference: event.merchantReference,
      success: event.success
    });
    
    logger.info(`Adyen authorization: ${event.pspReference}, success: ${event.success}`);
    
  } catch (error) {
    logger.error('Error handling Adyen authorization:', error);
  }
}

async function handleAdyenCapture(event) {
  try {
    await auditService.logEconomyEvent('adyen_capture', 'system', {
      pspReference: event.pspReference,
      merchantReference: event.merchantReference,
      success: event.success
    });
    
    logger.info(`Adyen capture: ${event.pspReference}, success: ${event.success}`);
    
  } catch (error) {
    logger.error('Error handling Adyen capture:', error);
  }
}

async function handleAdyenCancellation(event) {
  try {
    await auditService.logEconomyEvent('adyen_cancellation', 'system', {
      pspReference: event.pspReference,
      merchantReference: event.merchantReference,
      success: event.success
    });
    
    logger.info(`Adyen cancellation: ${event.pspReference}, success: ${event.success}`);
    
  } catch (error) {
    logger.error('Error handling Adyen cancellation:', error);
  }
}

async function handleAdyenRefund(event) {
  try {
    await auditService.logEconomyEvent('adyen_refund', 'system', {
      pspReference: event.pspReference,
      merchantReference: event.merchantReference,
      success: event.success
    });
    
    logger.info(`Adyen refund: ${event.pspReference}, success: ${event.success}`);
    
  } catch (error) {
    logger.error('Error handling Adyen refund:', error);
  }
}

async function handleAdyenChargeback(event) {
  try {
    await auditService.logEconomyEvent('adyen_chargeback', 'system', {
      pspReference: event.pspReference,
      merchantReference: event.merchantReference,
      reason: event.reason
    });
    
    logger.warn(`Adyen chargeback: ${event.pspReference}, reason: ${event.reason}`);
    
  } catch (error) {
    logger.error('Error handling Adyen chargeback:', error);
  }
}

async function handleAdyenPayout(event) {
  try {
    await auditService.logEconomyEvent('adyen_payout', 'system', {
      pspReference: event.pspReference,
      merchantReference: event.merchantReference,
      success: event.success
    });
    
    logger.info(`Adyen payout: ${event.pspReference}, success: ${event.success}`);
    
  } catch (error) {
    logger.error('Error handling Adyen payout:', error);
  }
}

// Webhook verification functions
async function verifyPayPalWebhook(headers, body) {
  try {
    const authAlgo = headers['paypal-auth-algo'];
    const transmissionId = headers['paypal-transmission-id'];
    const certId = headers['paypal-cert-id'];
    const transmissionSig = headers['paypal-transmission-sig'];
    const transmissionTime = headers['paypal-transmission-time'];
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    
    if (!webhookId) {
      logger.error('PayPal webhook ID not configured');
      return false;
    }
    
    // In production, you would verify the signature using PayPal's SDK
    // For now, we'll just log the verification attempt
    logger.info('PayPal webhook verification attempt', {
      authAlgo,
      transmissionId,
      certId,
      transmissionTime
    });
    
    return true; // Placeholder - implement actual verification
    
  } catch (error) {
    logger.error('PayPal webhook verification error:', error);
    return false;
  }
}

async function verifyAdyenWebhook(event) {
  try {
    const webhookSecret = process.env.ADYEN_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      logger.error('Adyen webhook secret not configured');
      return false;
    }
    
    // In production, you would verify the HMAC signature
    // For now, we'll just log the verification attempt
    logger.info('Adyen webhook verification attempt', {
      pspReference: event.pspReference,
      eventCode: event.eventCode
    });
    
    return true; // Placeholder - implement actual verification
    
  } catch (error) {
    logger.error('Adyen webhook verification error:', error);
    return false;
  }
}

module.exports = router;
