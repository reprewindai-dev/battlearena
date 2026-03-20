'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Zap, Crown, CreditCard, Shield, Check } from 'lucide-react';
import { toast } from 'sonner';
import { loadStripeJs, type StripeElements, type StripeJs, type StripePaymentElement } from '@/lib/payments/stripe-browser';

type CheckoutMode = 'tokens' | 'subscription';

interface TokenPackage {
  id: string;
  name: string;
  tokens: number;
  price: number;
  currency: string;
  bonus_tokens?: number;
  popular?: boolean;
  description: string;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  popular?: boolean;
  badge: string;
  color: string;
}

const tokenPackages: TokenPackage[] = [
  {
    id: 'starter',
    name: 'Starter Pack',
    tokens: 100,
    price: 4.99,
    currency: 'USD',
    description: 'Perfect for trying out premium features',
  },
  {
    id: 'regular',
    name: 'Regular Pack',
    tokens: 250,
    price: 9.99,
    currency: 'USD',
    bonus_tokens: 25,
    description: 'Great value for regular battlers',
  },
  {
    id: 'pro',
    name: 'Pro Pack',
    tokens: 500,
    price: 19.99,
    currency: 'USD',
    bonus_tokens: 75,
    popular: true,
    description: 'Best value for serious competitors',
  },
  {
    id: 'elite',
    name: 'Elite Pack',
    tokens: 1000,
    price: 34.99,
    currency: 'USD',
    bonus_tokens: 200,
    description: 'Maximum tokens for dedicated players',
  },
  {
    id: 'legendary',
    name: 'Legendary Pack',
    tokens: 2500,
    price: 79.99,
    currency: 'USD',
    bonus_tokens: 625,
    description: 'Ultimate package for arena legends',
  },
];

const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: 'spectator',
    name: 'Spectator Pass',
    price: 4.99,
    currency: 'USD',
    interval: 'month',
    features: [
      'Watch exclusive battles',
      'Vote in community decisions',
      'Access battle archives',
      'Custom profile badge',
    ],
    badge: 'Spectator',
    color: 'from-blue-600 to-cyan-600',
  },
  {
    id: 'pro',
    name: 'Pro Creator',
    price: 9.99,
    currency: 'USD',
    interval: 'month',
    features: [
      'All Spectator features',
      'Advanced battle analytics',
      'Higher payout rates (85%)',
      'Priority matchmaking',
      'Custom battle rooms',
      'Pro profile badge',
    ],
    popular: true,
    badge: 'Pro',
    color: 'from-purple-600 to-pink-600',
  },
  {
    id: 'premium',
    name: 'Premium Battle',
    price: 19.99,
    currency: 'USD',
    interval: 'month',
    features: [
      'All Pro features',
      'Unlimited battle creation',
      'Tournament priority access',
      'Exclusive beat library',
      'Advanced moderation tools',
      'Premium support',
      'Diamond profile badge',
    ],
    badge: 'Premium',
    color: 'from-yellow-600 to-orange-600',
  },
];

export function TokenShop() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'tokens' | 'subscriptions'>('tokens');
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<CheckoutMode | null>(null);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [checkoutTitle, setCheckoutTitle] = useState('');
  const [checkoutDescription, setCheckoutDescription] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
  const paymentElementHostRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<StripeJs | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const paymentElementRef = useRef<StripePaymentElement | null>(null);

  useEffect(() => {
    if (!paymentDialogOpen || !paymentClientSecret || !paymentElementHostRef.current) {
      return;
    }

    let cancelled = false;
    const clientSecret = paymentClientSecret;
    const hostElement = paymentElementHostRef.current;

    async function mountPaymentElement() {
      try {
        setPaymentError(null);
        const stripe = await loadStripeJs(publishableKey);
        if (cancelled) return;

        const elements = stripe.elements({
          clientSecret,
          appearance: {
            theme: 'night',
            variables: {
              colorPrimary: '#f97316',
              colorBackground: '#0f172a',
              colorText: '#ffffff',
              colorDanger: '#fca5a5',
              borderRadius: '12px',
            },
          },
        });
        const paymentElement = elements.create('payment', { layout: 'tabs' });
        paymentElement.mount(hostElement);

        stripeRef.current = stripe;
        elementsRef.current = elements;
        paymentElementRef.current = paymentElement;
      } catch (error) {
        if (!cancelled) {
          setPaymentError(error instanceof Error ? error.message : 'Unable to initialize Stripe checkout.');
        }
      }
    }

    void mountPaymentElement();

    return () => {
      cancelled = true;
      paymentElementRef.current?.destroy();
      paymentElementRef.current = null;
      elementsRef.current = null;
    };
  }, [paymentClientSecret, paymentDialogOpen, publishableKey]);

  function resetPaymentDialog() {
    setPaymentDialogOpen(false);
    setPaymentMode(null);
    setPaymentClientSecret(null);
    setPaymentIntentId(null);
    setCheckoutTitle('');
    setCheckoutDescription('');
    setPaymentError(null);
    setConfirmingPayment(false);
  }

  async function openPaymentDialog(params: {
    mode: CheckoutMode;
    clientSecret: string;
    paymentIntentId: string | null;
    title: string;
    description: string;
  }) {
    if (!publishableKey) {
      throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing');
    }

    setPaymentMode(params.mode);
    setPaymentClientSecret(params.clientSecret);
    setPaymentIntentId(params.paymentIntentId);
    setCheckoutTitle(params.title);
    setCheckoutDescription(params.description);
    setPaymentDialogOpen(true);
  }

  async function handleTokenPurchase(packageId: string) {
    try {
      setLoading(true);
      const packageData = tokenPackages.find((pkg) => pkg.id === packageId);
      if (!packageData) {
        throw new Error('Unknown token package');
      }

      const response = await fetch('/api/economy/tokens/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token_package: packageData.tokens,
          payment_method: 'card',
          currency: 'USD',
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        details?: string;
        payment_intent_client_secret?: string | null;
        payment_intent_id?: string | null;
      } | null;

      if (!response.ok || !payload?.payment_intent_client_secret) {
        throw new Error(payload?.details ?? payload?.error ?? 'Failed to initiate purchase');
      }

      await openPaymentDialog({
        mode: 'tokens',
        clientSecret: payload.payment_intent_client_secret,
        paymentIntentId: payload.payment_intent_id ?? null,
        title: packageData.name,
        description: `${packageData.tokens + (packageData.bonus_tokens ?? 0)} tokens will be credited after payment confirmation.`,
      });
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error(error instanceof Error ? error.message : 'Purchase failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscription(planId: string) {
    try {
      setLoading(true);
      const planData = subscriptionPlans.find((plan) => plan.id === planId);
      if (!planData) {
        throw new Error('Unknown subscription plan');
      }

      const response = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan_id: planId,
          payment_method: 'card',
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        details?: string;
        client_secret?: string | null;
        status?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.details ?? payload?.error ?? 'Failed to create subscription');
      }

      if (payload?.status === 'active') {
        toast.success(`Successfully subscribed to ${planData.name}.`);
        return;
      }

      if (!payload?.client_secret) {
        throw new Error('Stripe did not return a client secret for this subscription.');
      }

      await openPaymentDialog({
        mode: 'subscription',
        clientSecret: payload.client_secret,
        paymentIntentId: null,
        title: planData.name,
        description: `Confirm your ${planData.name} subscription in Stripe.`,
      });
    } catch (error) {
      console.error('Subscription error:', error);
      toast.error(error instanceof Error ? error.message : 'Subscription failed');
    } finally {
      setLoading(false);
    }
  }

  async function submitPayment() {
    if (!stripeRef.current || !elementsRef.current || !paymentMode) {
      setPaymentError('Stripe checkout is not ready yet.');
      return;
    }

    try {
      setConfirmingPayment(true);
      setPaymentError(null);

      const result = await stripeRef.current.confirmPayment({
        elements: elementsRef.current,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      });

      if (result.error?.message) {
        throw new Error(result.error.message);
      }

      if (paymentMode === 'tokens') {
        const resolvedIntentId = result.paymentIntent?.id ?? paymentIntentId;
        if (!resolvedIntentId) {
          throw new Error('Stripe did not return a payment intent id.');
        }

        const confirmResponse = await fetch('/api/economy/tokens/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ payment_intent_id: resolvedIntentId }),
        });

        const confirmPayload = (await confirmResponse.json().catch(() => null)) as { error?: string; details?: string } | null;
        if (!confirmResponse.ok) {
          throw new Error(confirmPayload?.details ?? confirmPayload?.error ?? 'Payment confirmed but token credit failed.');
        }

        toast.success('Token purchase completed successfully.');
      } else {
        toast.success('Subscription payment confirmed. Billing status will refresh automatically.');
      }

      resetPaymentDialog();
    } catch (error) {
      console.error('Stripe confirmation error:', error);
      const message = error instanceof Error ? error.message : 'Payment confirmation failed';
      setPaymentError(message);
      toast.error(message);
    } finally {
      setConfirmingPayment(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Arena Shop</h1>
          <p className="text-gray-300">Get tokens and unlock premium features</p>
        </div>

        <div className="flex justify-center mb-8">
          <div className="bg-black/20 rounded-lg p-1 flex space-x-1">
            <Button
              variant={activeTab === 'tokens' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('tokens')}
              className="flex items-center space-x-2"
            >
              <Zap className="w-4 h-4" />
              <span>Tokens</span>
            </Button>
            <Button
              variant={activeTab === 'subscriptions' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('subscriptions')}
              className="flex items-center space-x-2"
            >
              <Crown className="w-4 h-4" />
              <span>Subscriptions</span>
            </Button>
          </div>
        </div>

        {activeTab === 'tokens' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {tokenPackages.map((pkg, index) => (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Card className={`relative bg-black/20 border-white/10 hover:bg-black/30 transition-all ${pkg.popular ? 'ring-2 ring-purple-500' : ''}`}>
                  {pkg.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                        Most Popular
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
                      <Zap className="w-8 h-8" />
                    </div>
                    <CardTitle className="text-xl">{pkg.name}</CardTitle>
                    <p className="text-sm text-gray-400">{pkg.description}</p>
                  </CardHeader>

                  <CardContent className="text-center space-y-4">
                    <div>
                      <div className="text-3xl font-bold">
                        {pkg.tokens}
                        {pkg.bonus_tokens ? <span className="text-lg text-green-400"> +{pkg.bonus_tokens}</span> : null}
                      </div>
                      <div className="text-sm text-gray-400">tokens</div>
                    </div>

                    <div className="text-2xl font-bold">
                      ${pkg.price}
                      <span className="text-sm text-gray-400">/{pkg.currency}</span>
                    </div>

                    {pkg.bonus_tokens ? (
                      <div className="text-xs text-green-400">
                        {Math.round((pkg.bonus_tokens / pkg.tokens) * 100)}% bonus!
                      </div>
                    ) : null}

                    <Button
                      onClick={() => void handleTokenPurchase(pkg.id)}
                      disabled={loading}
                      className="w-full"
                      variant={pkg.popular ? 'default' : 'outline'}
                    >
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4 mr-2" />
                          Purchase
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {activeTab === 'subscriptions' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {subscriptionPlans.map((plan, index) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Card className={`relative bg-black/20 border-white/10 hover:bg-black/30 transition-all ${plan.popular ? 'ring-2 ring-purple-500 scale-105' : ''}`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                        Most Popular
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="text-center">
                    <div className={`w-16 h-16 mx-auto mb-4 bg-gradient-to-r ${plan.color} rounded-full flex items-center justify-center`}>
                      <Crown className="w-8 h-8" />
                    </div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <Badge variant="outline" className="mx-auto">
                      {plan.badge}
                    </Badge>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold">
                        ${plan.price}
                        <span className="text-sm text-gray-400">/{plan.interval}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {plan.features.map((feature, featureIndex) => (
                        <div key={featureIndex} className="flex items-center space-x-3">
                          <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <Button
                      onClick={() => void handleSubscription(plan.id)}
                      disabled={loading}
                      className="w-full"
                      variant={plan.popular ? 'default' : 'outline'}
                    >
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4 mr-2" />
                          Subscribe
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        <Card className="mt-8 bg-black/20 border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Shield className="w-5 h-5 text-green-400" />
              <h3 className="text-lg font-semibold">Secure Payments</h3>
            </div>
            <p className="text-gray-300 text-sm">
              All payments are processed securely through Stripe. Your payment information is never stored on our servers.
              All purchases are final and subject to our Terms of Service.
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={paymentDialogOpen} onOpenChange={(open) => (!open ? resetPaymentDialog() : undefined)}>
        <DialogContent className="border-border/60 bg-slate-950 text-white sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{checkoutTitle || 'Complete payment'}</DialogTitle>
            <DialogDescription className="text-slate-300">
              {checkoutDescription || 'Enter your payment details to continue.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div
              ref={paymentElementHostRef}
              className="rounded-xl border border-white/10 bg-black/30 p-4"
              data-testid="stripe-payment-element"
            />

            {paymentError ? <div className="text-xs text-amber-200/90">{paymentError}</div> : null}

            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={resetPaymentDialog} disabled={confirmingPayment}>
                Cancel
              </Button>
              <Button onClick={() => void submitPayment()} disabled={confirmingPayment || !paymentClientSecret}>
                {confirmingPayment ? 'Processing...' : paymentMode === 'subscription' ? 'Confirm subscription' : 'Confirm purchase'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
