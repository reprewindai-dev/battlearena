'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { loadStripeJs, type StripeConfirmResult, type StripeElements, type StripeJs, type StripePaymentElement } from '@/lib/payments/stripe-browser';

interface StripeCheckoutDialogProps {
  open: boolean;
  title: string;
  description: string;
  clientSecret: string | null;
  publishableKey: string;
  confirmLabel: string;
  onOpenChange: (open: boolean) => void;
  onConfirmed: (result: StripeConfirmResult) => Promise<void> | void;
}

export function StripeCheckoutDialog({
  open,
  title,
  description,
  clientSecret,
  publishableKey,
  confirmLabel,
  onOpenChange,
  onConfirmed,
}: StripeCheckoutDialogProps) {
  const [error, setError] = React.useState<string | null>(null);
  const [isConfirming, setIsConfirming] = React.useState(false);
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const stripeRef = React.useRef<StripeJs | null>(null);
  const elementsRef = React.useRef<StripeElements | null>(null);
  const paymentElementRef = React.useRef<StripePaymentElement | null>(null);

  React.useEffect(() => {
    if (!open || !clientSecret || !hostRef.current) {
      return;
    }

    let cancelled = false;
    const resolvedClientSecret = clientSecret;
    const hostElement = hostRef.current;

    async function mountPaymentElement() {
      try {
        setError(null);
        const stripe = await loadStripeJs(publishableKey);
        if (cancelled) {
          return;
        }

        const elements = stripe.elements({
          clientSecret: resolvedClientSecret,
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
      } catch (mountError) {
        if (!cancelled) {
          setError(mountError instanceof Error ? mountError.message : 'Unable to initialize Stripe checkout.');
        }
      }
    }

    void mountPaymentElement();

    return () => {
      cancelled = true;
      paymentElementRef.current?.destroy();
      paymentElementRef.current = null;
      elementsRef.current = null;
      stripeRef.current = null;
      setError(null);
      setIsConfirming(false);
    };
  }, [clientSecret, open, publishableKey]);

  async function handleConfirm() {
    if (!stripeRef.current || !elementsRef.current) {
      setError('Stripe checkout is not ready yet.');
      return;
    }

    try {
      setIsConfirming(true);
      setError(null);

      const result = await stripeRef.current.confirmPayment({
        elements: elementsRef.current,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      });

      if (result.error?.message) {
        throw new Error(result.error.message);
      }

      await onConfirmed(result);
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : 'Payment confirmation failed.');
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/60 bg-slate-950 text-white sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title || 'Complete payment'}</DialogTitle>
          <DialogDescription className="text-slate-300">
            {description || 'Enter your payment details to continue.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div ref={hostRef} className="rounded-xl border border-white/10 bg-black/30 p-4" data-testid="stripe-payment-element" />

          {error ? <div className="text-xs text-amber-200/90">{error}</div> : null}

          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isConfirming}>
              Cancel
            </Button>
            <Button onClick={() => void handleConfirm()} disabled={isConfirming || !clientSecret}>
              {isConfirming ? 'Processing...' : confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
