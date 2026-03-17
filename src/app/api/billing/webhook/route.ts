import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/billing/stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

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

        // Get subscription details for period end
        const subscriptionId = session.subscription as string;
        const subscription = subscriptionId 
          ? await stripe.subscriptions.retrieve(subscriptionId)
          : null;

        // Update user's subscription
        await supabase
          .from("profiles")
          .update({
            stripe_customer_id: customerId,
            subscription_id: subscriptionId,
            subscription_status: "active",
            subscription_tier: planType,
            subscription_ends_at: subscription 
              ? new Date(subscription.current_period_end * 1000).toISOString()
              : null,
          })
          .eq("user_id", userId);

        // Track payment event
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
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);

        // Update subscription status
        await supabase
          .from("profiles")
          .update({
            subscription_status: "active",
            subscription_ends_at: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq("subscription_id", invoice.subscription);

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;

        // Update subscription status
        await supabase
          .from("profiles")
          .update({
            subscription_status: "past_due",
          })
          .eq("subscription_id", invoice.subscription);

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;

        // Downgrade to free tier
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
