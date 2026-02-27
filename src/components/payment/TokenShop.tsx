'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Zap, Crown, CreditCard, Shield, Check } from 'lucide-react';
import { toast } from 'sonner';

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

export function TokenShop() {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'tokens' | 'subscriptions'>('tokens');

  const tokenPackages: TokenPackage[] = [
    {
      id: 'starter',
      name: 'Starter Pack',
      tokens: 100,
      price: 4.99,
      currency: 'USD',
      description: 'Perfect for trying out premium features'
    },
    {
      id: 'regular',
      name: 'Regular Pack',
      tokens: 250,
      price: 9.99,
      currency: 'USD',
      bonus_tokens: 25,
      description: 'Great value for regular battlers'
    },
    {
      id: 'pro',
      name: 'Pro Pack',
      tokens: 500,
      price: 19.99,
      currency: 'USD',
      bonus_tokens: 75,
      popular: true,
      description: 'Best value for serious competitors'
    },
    {
      id: 'elite',
      name: 'Elite Pack',
      tokens: 1000,
      price: 34.99,
      currency: 'USD',
      bonus_tokens: 200,
      description: 'Maximum tokens for dedicated players'
    },
    {
      id: 'legendary',
      name: 'Legendary Pack',
      tokens: 2500,
      price: 79.99,
      currency: 'USD',
      bonus_tokens: 625,
      description: 'Ultimate package for arena legends'
    }
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
        'Custom profile badge'
      ],
      badge: 'Spectator',
      color: 'from-blue-600 to-cyan-600'
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
        'Pro profile badge'
      ],
      popular: true,
      badge: 'Pro',
      color: 'from-purple-600 to-pink-600'
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
        'Diamond profile badge'
      ],
      badge: 'Premium',
      color: 'from-yellow-600 to-orange-600'
    }
  ];

  const handleTokenPurchase = async (packageId: string) => {
    try {
      setLoading(true);
      const packageData = tokenPackages.find(pkg => pkg.id === packageId);
      
      const response = await fetch('/api/economy/tokens/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          token_package: packageData?.tokens,
          payment_method: 'card',
          currency: 'USD'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to initiate purchase');
      }

      const { payment_intent_client_secret } = await response.json();
      
      // Initialize Stripe checkout
      const stripe = (window as any).Stripe;
      const result = await stripe.confirmCardPayment(payment_intent_client_secret);
      
      if (result.error) {
        throw new Error(result.error.message);
      }

      toast.success(`Successfully purchased ${packageData?.tokens} tokens!`);
      setSelectedPackage(null);
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error(error instanceof Error ? error.message : 'Purchase failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscription = async (planId: string) => {
    try {
      setLoading(true);
      const planData = subscriptionPlans.find(plan => plan.id === planId);
      
      const response = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          plan_id: planId,
          payment_method: 'card'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to create subscription');
      }

      const { subscription_id, client_secret } = await response.json();
      
      // Initialize Stripe subscription
      const stripe = (window as any).Stripe;
      const result = await stripe.confirmCardSubscription(client_secret);
      
      if (result.error) {
        throw new Error(result.error.message);
      }

      toast.success(`Successfully subscribed to ${planData?.name}!`);
      setSelectedPlan(null);
    } catch (error) {
      console.error('Subscription error:', error);
      toast.error(error instanceof Error ? error.message : 'Subscription failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Arena Shop</h1>
          <p className="text-gray-300">Get tokens and unlock premium features</p>
        </div>

        {/* Tab Navigation */}
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

        {/* Token Packages */}
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
                        {pkg.bonus_tokens && (
                          <span className="text-lg text-green-400"> +{pkg.bonus_tokens}</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400">tokens</div>
                    </div>
                    
                    <div className="text-2xl font-bold">
                      ${pkg.price}
                      <span className="text-sm text-gray-400">/{pkg.currency}</span>
                    </div>

                    {pkg.bonus_tokens && (
                      <div className="text-xs text-green-400">
                        {Math.round((pkg.bonus_tokens / pkg.tokens) * 100)}% bonus!
                      </div>
                    )}
                    
                    <Button
                      onClick={() => handleTokenPurchase(pkg.id)}
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

        {/* Subscription Plans */}
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
                      onClick={() => handleSubscription(plan.id)}
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

        {/* Security Notice */}
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
    </div>
  );
}
