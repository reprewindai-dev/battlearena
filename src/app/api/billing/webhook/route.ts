import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getBillingStripeClient } from "@/lib/billing/stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export async function POST(request: NextRequest) {
  let stripe: Stripe;
  try {
    stripe = getBillingStripeClient();
  } catch {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 500 });
  }

  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret =
    process.env.STRIPE_BILLING_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json({ error: "stripe_billing_webhook_secret_missing" }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const getSubscriptionPeriodEnd = (subscription: Stripe.Subscription | null) => {
    const value = (subscription as unknown as { current_period_end?: number | null })?.current_period_end;
    return typeof value === "number" ? new Date(value * 1000).toISOString() : null;
  };

  const getInvoiceSubscriptionId = (invoice: Stripe.Invoice) => {
    const value = (invoice as unknown as { subscription?: string | { id?: string } | null }).subscription;
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && typeof value.id === "string") return value.id;
    return null;
  };

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const planType = session.metadata?.planType;
        const customerId = session.customer;

        if (!userId) {
          console.error("Missing userId in session metadata");
          break;
        }

        const subscriptionId = session.subscription as string;
        const subscription = subscriptionId
          ? await stripe.subscriptions.retrieve(subscriptionId)
          : null;

        await supabase
          .from("profiles")
          .update({
            stripe_customer_id: customerId,
            subscription_id: subscriptionId,
            subscription_status: "active",
            subscription_tier: planType,
            subscription_ends_at: getSubscriptionPeriodEnd(subscription),
          })
          .eq("user_id", userId);

        await supabase
          .from("payment_events")
          .insert({
            user_id: userId,
            stripe_event_id: event.id,
            event_type: event.type,
            event_data: session,
          });

        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceSubscriptionId = getInvoiceSubscriptionId(invoice);
        const subscription = invoiceSubscriptionId
          ? await stripe.subscriptions.retrieve(invoiceSubscriptionId)
          : null;

        await supabase
          .from("profiles")
          .update({
            subscription_status: "active",
            subscription_ends_at: getSubscriptionPeriodEnd(subscription),
          })
          .eq("subscription_id", invoiceSubscriptionId);

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceSubscriptionId = getInvoiceSubscriptionId(invoice);

        await supabase
          .from("profiles")
          .update({
            subscription_status: "past_due",
          })
          .eq("subscription_id", invoiceSubscriptionId);

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;

        await supabase
          .from("profiles")
          .update({
            subscription_status: "canceled",
            subscription_tier: "free",
            subscription_ends_at: new Date().toISOString(),
          })
          .eq("subscription_id", subscription.id);

        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing failed:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}