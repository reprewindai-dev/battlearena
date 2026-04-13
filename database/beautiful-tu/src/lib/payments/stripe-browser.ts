export type StripePaymentIntent = {
  id?: string;
  status?: string;
};

export type StripeConfirmResult = {
  error?: {
    message?: string;
  };
  paymentIntent?: StripePaymentIntent;
};

export type StripePaymentElement = {
  mount: (element: HTMLElement) => void;
  destroy: () => void;
};

export type StripeElements = {
  create: (
    type: "payment",
    options?: { layout?: "tabs" | "accordion" },
  ) => StripePaymentElement;
};

export type StripeJs = {
  elements: (options: {
    clientSecret: string;
    appearance?: {
      theme?: string;
      variables?: Record<string, string>;
    };
  }) => StripeElements;
  confirmPayment: (options: {
    elements: StripeElements;
    confirmParams: { return_url: string };
    redirect: "if_required";
  }) => Promise<StripeConfirmResult>;
};

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => StripeJs;
  }
}

let stripeLoaderPromise: Promise<void> | null = null;

async function ensureStripeScript() {
  if (typeof window === "undefined") {
    throw new Error("stripe_browser_only");
  }

  if (window.Stripe) {
    return;
  }

  if (!stripeLoaderPromise) {
    stripeLoaderPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-stripe-js="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("stripe_script_load_failed")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://js.stripe.com/v3/";
      script.async = true;
      script.dataset.stripeJs = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("stripe_script_load_failed"));
      document.head.appendChild(script);
    });
  }

  await stripeLoaderPromise;
}

export async function loadStripeJs(publishableKey: string) {
  if (!publishableKey) {
    throw new Error("stripe_publishable_key_missing");
  }

  await ensureStripeScript();

  if (!window.Stripe) {
    throw new Error("stripe_constructor_missing");
  }

  return window.Stripe(publishableKey);
}
