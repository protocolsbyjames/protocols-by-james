import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/lemonsqueezy";

/**
 * POST /api/customer-portal
 *
 * Returns the LemonSqueezy customer portal URL for the current user's
 * active subscription. The client settings page redirects the user here
 * so they can manage billing, update payment method, or cancel.
 *
 * LemonSqueezy provides a `customer_portal` URL on each subscription
 * object. We look up the user's subscription and return that URL.
 */
export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the user's active subscription (stripe_subscription_id holds the LS sub ID)
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("client_id", user.id)
      .in("status", ["active", "trialing", "past_due", "paused"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.stripe_subscription_id) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 },
      );
    }

    // Fetch the subscription from LS to get the portal URL
    const lsSub = await getSubscription(sub.stripe_subscription_id);
    const portalUrl = lsSub.data.attributes.urls.customer_portal;

    if (!portalUrl) {
      return NextResponse.json(
        { error: "Customer portal URL not available" },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: portalUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Customer portal error:", message);
    return NextResponse.json(
      { error: "Failed to get customer portal URL" },
      { status: 500 },
    );
  }
}
