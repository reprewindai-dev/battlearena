import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession, createCustomer } from "@/lib/billing/stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { planType } = await request.json();
    
    if (!planType || !["pro", "enterprise"].includes(planType)) {
      return NextResponse.json({ error: "Invalid plan type" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const headersList = await headers();
    const authHeader = headersList.get("authorization");

    let user = null;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const { data, error } = await supabase.auth.getUser(token);
      if (error) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
      user = data.user;
    } else {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      user = data.user;
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, email")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await createCustomer(user.id, profile.email);
      customerId = customer.id;
      
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }

    const session = await createCheckoutSession(user.id, planType as "pro" | "enterprise");

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout session creation failed:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
