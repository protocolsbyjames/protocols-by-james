import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, getOrCreateStripeCustomer } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId } = await request.json();

    if (!planId) {
      return NextResponse.json(
        { error: "Missing required field: planId" },
        { status: 400 },
      );
    }

    // Look up the plan and its coach. RLS allows any authenticated user to
    // read active plans, so onboarding works before the client has a coach_id.
    const { data: plan, error: planError } = await supabase
      .from("coaching_plans")
      .select("id, coach_id, stripe_price_id, is_active")
      .eq("id", planId)
      .maybeSingle();

    if (planError || !plan || !plan.is_active) {
      return NextResponse.json(
        { error: "Plan not found or inactive" },
        { status: 404 },
      );
    }

    // Pin the client to the coach they're subscribing to. Safe to overwrite
    // because a client can only have one active subscription at a time.
    await supabase
      .from("profiles")
      .update({ coach_id: plan.coach_id })
      .eq("id", user.id);

    const customerId = await getOrCreateStripeCustomer(user.id);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      success_url: `${appUrl}/client?checkout=success`,
      cancel_url: `${appUrl}/onboarding?checkout=canceled`,
      metadata: {
        client_id: user.id,
        coach_id: plan.coach_id,
        plan_id: plan.id,
      },
      subscription_data: {
        metadata: {
          client_id: user.id,
          coach_id: plan.coach_id,
          plan_id: plan.id,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Checkout session creation failed:", message);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
