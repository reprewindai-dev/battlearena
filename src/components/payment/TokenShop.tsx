'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, CreditCard, Crown, Shield, Zap } from 'lucide-react';
import { toast } from 'sonner';
import {
  loadStripeJs,
  type StripeElements,
  type StripeJs,
  type StripePaymentElement,
} from '@/lib/payments/stripe-browser';

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
    description: 'Clean entry for viewers testing premium access.',
  },
  {
    id: 'regular',
    name: 'Regular Pack',
    tokens: 250,
    price: 9.99,
    currency: 'USD',
    bonus_tokens: 25,
    description: 'Built for repeat battles, votes, and room activity.',
  },
  {
    id: 'pro',
    name: 'Pro Pack',
    tokens: 500,
    price: 19.99,
    currency: 'USD',
    bonus_tokens: 75,
    popular: true,
    description: 'Best value for serious battlers and promoters.',
  },
  {
    id: 'elite',
    name: 'Elite Pack',
    tokens: 1000,
    price: 34.99,
    currency: 'USD',
    bonus_tokens: 200,
    description: 'For creators running rooms and community campaigns.',
  },
  {
    id: 'legendary',
    name: 'Legendary Pack',
    tokens: 2500,
    price: 79.99,
    currency: 'USD',
    bonus_tokens: 625,
    description: 'Maximum reserve for premium room control and showcase pushes.',
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
    color: 'from-[#5d84ff] to-[#2bb5ff]',
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
    color: 'from-[#f2447a] to-[#ff7a1a]',
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
    color: 'from-[#f5d88c] to-[#f3b842]',
  },
];

function formatCurrency(price: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(price);
}

function bonusPercent(pkg: TokenPackage) {
  if (!pkg.bonus_tokens) return null;
  return Math.round((pkg.bonus_tokens / pkg.tokens) * 100);
}

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
              colorPrimary: '#f3b842',
              colorBackground: '#0c0d10',
              colorText: '#ffffff',
              colorDanger: '#fca5a5',
              borderRadius: '14px',
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

        const confirmPayload = (await confirmResponse.json().catch(() => null)) as
          | { error?: string; details?: string }
          | null;
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
    <div className="space-y-8">
      <section className="spitzone-panel-strong spitzone-metal-line spitzone-surface-grid overflow-hidden px-6 py-7 md:px-8 md:py-9">
        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.8fr]">
          <div className="space-y-5">
            <div className="spitzone-kicker">Economy control</div>
            <div className="space-y-3">
              <h1 className="spitzone-display spitzone-wordmark text-5xl sm:text-6xl xl:text-7xl">
                Fund the signal
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-white/68 sm:text-base">
                Tokens and paid access should feel like controlled leverage, not cheap upsells. Every pack and pass
                below maps to real runtime utility inside Spitzone.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
                <div className="spitzone-kicker">Spend</div>
                <div className="mt-2 text-2xl font-semibold text-primary">Tokens</div>
                <p className="mt-2 text-xs leading-5 text-white/56">
                  Use for premium actions, room access, and future economy unlocks.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
                <div className="spitzone-kicker">Own</div>
                <div className="mt-2 text-2xl font-semibold text-white">Membership</div>
                <p className="mt-2 text-xs leading-5 text-white/56">
                  Subscriptions convert committed users into retained operators and creators.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
                <div className="spitzone-kicker">Trust</div>
                <div className="mt-2 text-2xl font-semibold text-white">Stripe-secured</div>
                <p className="mt-2 text-xs leading-5 text-white/56">
                  Card entry stays inside Stripe. Purchase state is confirmed server-side.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,17,25,0.94),rgba(12,12,17,0.98))] p-5">
              <div className="flex items-center justify-between">
                <span className="spitzone-chip-live">Revenue stack</span>
                <span className="text-xs uppercase tracking-[0.24em] text-white/44">live</span>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl border border-white/10 bg-white/4 px-3 py-4">
                  <div className="text-xl font-semibold text-white">{tokenPackages.length}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/44">packs</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/4 px-3 py-4">
                  <div className="text-xl font-semibold text-primary">{subscriptionPlans.length}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/44">passes</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/4 px-3 py-4">
                  <div className="text-xl font-semibold text-white">24/7</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/44">checkout</div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-white/10 bg-black/22 p-5">
              <div className="spitzone-kicker">Operator note</div>
              <p className="mt-3 text-sm leading-6 text-white/62">
                A premium economy only works if the UI feels controlled and trustworthy. No loud gradients, no fake
                urgency, no clutter.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex justify-center">
        <div className="rounded-full border border-white/10 bg-black/20 p-1">
          <div className="flex gap-1">
            <Button
              variant="ghost"
              onClick={() => setActiveTab('tokens')}
              className={`rounded-full px-5 text-sm ${
                activeTab === 'tokens'
                  ? 'bg-primary text-black hover:bg-[#ffd071]'
                  : 'text-white/70 hover:bg-white/8 hover:text-white'
              }`}
            >
              <Zap className="mr-2 h-4 w-4" />
              Tokens
            </Button>
            <Button
              variant="ghost"
              onClick={() => setActiveTab('subscriptions')}
              className={`rounded-full px-5 text-sm ${
                activeTab === 'subscriptions'
                  ? 'bg-primary text-black hover:bg-[#ffd071]'
                  : 'text-white/70 hover:bg-white/8 hover:text-white'
              }`}
            >
              <Crown className="mr-2 h-4 w-4" />
              Memberships
            </Button>
          </div>
        </div>
      </div>

      {activeTab === 'tokens' ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {tokenPackages.map((pkg, index) => {
            const totalTokens = pkg.tokens + (pkg.bonus_tokens ?? 0);
            const percent = bonusPercent(pkg);

            return (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: index * 0.06 }}
              >
                <Card
                  className={`spitzone-panel relative h-full overflow-hidden p-0 ${
                    pkg.popular ? 'border-primary/35 bg-primary/8' : ''
                  }`}
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(245,216,140,0.85),transparent)]" />
                  {pkg.popular ? (
                    <div className="absolute right-4 top-4">
                      <Badge className="spitzone-chip-live">most moved</Badge>
                    </div>
                  ) : null}

                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="spitzone-kicker">Token pack</div>
                        <CardTitle className="mt-2 text-2xl text-white">{pkg.name}</CardTitle>
                        <p className="mt-2 text-sm leading-6 text-white/56">{pkg.description}</p>
                      </div>
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/12">
                        <Zap className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-5">
                    <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                      <div className="text-3xl font-semibold text-white">{totalTokens.toLocaleString()}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/44">total tokens credited</div>
                      {pkg.bonus_tokens ? (
                        <div className="mt-2 text-xs text-primary">
                          Includes {pkg.bonus_tokens} bonus tokens{percent ? ` (${percent}% extra)` : ''}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <div className="text-2xl font-semibold text-white">{formatCurrency(pkg.price, pkg.currency)}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/44">{pkg.currency}</div>
                      </div>
                      <span className="spitzone-chip">instant delivery</span>
                    </div>

                    <Button
                      onClick={() => void handleTokenPurchase(pkg.id)}
                      disabled={loading}
                      className={`w-full rounded-full text-sm font-semibold ${
                        pkg.popular
                          ? 'bg-primary text-black hover:bg-[#ffd071]'
                          : 'border border-white/12 bg-white/4 text-white hover:bg-white/10'
                      }`}
                      variant={pkg.popular ? 'default' : 'outline'}
                    >
                      {loading ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <>
                          <CreditCard className="mr-2 h-4 w-4" />
                          Purchase pack
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {subscriptionPlans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: index * 0.06 }}
            >
              <Card
                className={`spitzone-panel relative h-full overflow-hidden p-0 ${
                  plan.popular ? 'border-primary/35 bg-primary/8' : ''
                }`}
              >
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${plan.color}`} />
                {plan.popular ? (
                  <div className="absolute right-4 top-4">
                    <Badge className="spitzone-chip-live">lead tier</Badge>
                  </div>
                ) : null}

                <CardHeader className="space-y-4 pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="spitzone-kicker">Membership</div>
                      <CardTitle className="mt-2 text-2xl text-white">{plan.name}</CardTitle>
                    </div>
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${plan.color}`}>
                      <Crown className="h-6 w-6 text-black" />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge className="border border-white/12 bg-white/5 text-white shadow-none">{plan.badge}</Badge>
                    <div className="text-3xl font-semibold text-white">
                      {formatCurrency(plan.price, plan.currency)}
                      <span className="ml-1 text-sm font-medium text-white/52">/{plan.interval}</span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5">
                  <div className="space-y-3">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-black/18 px-3 py-3">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span className="text-sm leading-6 text-white/70">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={() => void handleSubscription(plan.id)}
                    disabled={loading}
                    className={`w-full rounded-full text-sm font-semibold ${
                      plan.popular
                        ? 'bg-primary text-black hover:bg-[#ffd071]'
                        : 'border border-white/12 bg-white/4 text-white hover:bg-white/10'
                    }`}
                    variant={plan.popular ? 'default' : 'outline'}
                  >
                    {loading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
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

      <Card className="spitzone-panel p-0">
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-white">Secure checkout</h3>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/60">
              Payments are processed by Stripe, not stored on Spitzone servers. Token credit and subscription state are
              confirmed through the production backend before access is granted.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center md:min-w-[260px]">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-4">
              <div className="text-sm font-semibold text-white">Card</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/44">Stripe</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-4">
              <div className="text-sm font-semibold text-white">Runtime</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/44">server check</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-4">
              <div className="text-sm font-semibold text-white">Access</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/44">gated</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={paymentDialogOpen} onOpenChange={(open) => (!open ? resetPaymentDialog() : undefined)}>
        <DialogContent className="border-white/10 bg-[#090a0d] text-white sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="spitzone-display text-3xl tracking-[0.04em] text-white">
              {checkoutTitle || 'Complete payment'}
            </DialogTitle>
            <DialogDescription className="text-white/58">
              {checkoutDescription || 'Enter your payment details to continue.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div
              ref={paymentElementHostRef}
              className="rounded-[1.2rem] border border-white/10 bg-black/30 p-4"
              data-testid="stripe-payment-element"
            />

            {paymentError ? <div className="text-xs text-amber-200/90">{paymentError}</div> : null}

            <div className="flex items-center justify-end gap-3">
              <Button
                variant="outline"
                onClick={resetPaymentDialog}
                disabled={confirmingPayment}
                className="rounded-full border-white/12 bg-white/4 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={() => void submitPayment()}
                disabled={confirmingPayment || !paymentClientSecret}
                className="rounded-full bg-primary text-black hover:bg-[#ffd071]"
              >
                {confirmingPayment
                  ? 'Processing...'
                  : paymentMode === 'subscription'
                    ? 'Confirm subscription'
                    : 'Confirm purchase'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
