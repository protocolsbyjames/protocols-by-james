import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCheckout } from "@/lib/lemonsqueezy";

/**
 * POST /api/checkout
 *
 * Creates a LemonSqueezy checkout session for the selected plan + optional
 * add-ons and returns the hosted checkout URL. The client-side SubscribeButton
 * redirects the user to this URL.
 *
 * LemonSqueezy creates one checkout per variant. For plans that include an
 * add-on (e.g. Elite includes VIP), the variant itself should be configured
 * in LS with the combined pricing. For optional add-ons (e.g. VIP on
 * Performance), we use a separate "combined" variant that bundles both.
 *
 * Database mapping:
 *   coaching_plans.stripe_price_id       → LemonSqueezy variant_id
 *   coaching_plans.stripe_program_price_id → (unused; LS handles setup fees on the variant)
 */

type PlanRow = {
  id: string;
  coach_id: string;
  plan_type: "self_guided" | "coaching" | "addon";
  stripe_price_id: string; // Now holds LS variant_id
  stripe_program_price_id: string | null;
  auto_include_addon_id: string | null;
  ls_variant_with_addon: string | null; // New column: variant_id when addon is attached
  is_active: boolean;
};

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

    const body = (await request.json()) as {
      planId?: string;
      addonPlanIds?: string[];
    };

    const planId = body.planId;
    const requestedAddonIds = Array.isArray(body.addonPlanIds)
      ? body.addonPlanIds.filter((id): id is string => typeof id === "string")
      : [];

    if (!planId) {
      return NextResponse.json(
        { error: "Missing required field: planId" },
        { status: 400 },
      );
    }

    const { data: plan, error: planError } = await supabase
      .from("coaching_plans")
      .select(
        "id, coach_id, plan_type, stripe_price_id, stripe_program_price_id, auto_include_addon_id, is_active",
      )
      .eq("id", planId)
      .maybeSingle<PlanRow>();

    if (planError || !plan || !plan.is_active) {
      return NextResponse.json(
        { error: "Plan not found or inactive" },
        { status: 404 },
      );
    }

    if (plan.plan_type === "addon") {
      return NextResponse.json(
        { error: "Add-ons must be attached to a main plan" },
        { status: 400 },
      );
    }

    // Pin the client to the coach they're subscribing to.
    await supabase
      .from("profiles")
      .update({ coach_id: plan.coach_id })
      .eq("id", user.id);

    // Determine which variant to use. If the user selected a VIP add-on
    // and the plan has a combined variant, use that. Otherwise use the
    // base variant.
    const hasAddon =
      requestedAddonIds.length > 0 || !!plan.auto_include_addon_id;

    // For now, we use the base variant. If you set up combined variants
    // in LemonSqueezy (e.g. "Performance + VIP"), store that variant ID
    // in a new column or use the addon logic below.
    const variantId = plan.stripe_price_id; // This now holds the LS variant_id

    if (!variantId) {
      return NextResponse.json(
        { error: "Plan is missing its LemonSqueezy variant" },
        { status: 500 },
      );
    }

    // Get user profile for checkout pre-fill
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name, referred_by, referral_discount_applied")
      .eq("id", user.id)
      .single();

    // Build metadata for the webhook to use when recording the subscription
    const customData: Record<string, string> = {
      client_id: user.id,
      coach_id: plan.coach_id,
      plan_id: plan.id,
      plan_type: plan.plan_type,
    };

    if (hasAddon) {
      const addonIds = new Set<string>();
      if (plan.auto_include_addon_id) addonIds.add(plan.auto_include_addon_id);
      for (const id of requestedAddonIds) addonIds.add(id);
      customData.attached_addon_plan_ids = JSON.stringify(
        Array.from(addonIds),
      );
    }

    // Referral discount code (set up in LemonSqueezy dashboard)
    const shouldApplyDiscount =
      !!profile?.referred_by &&
      !profile.referral_discount_applied &&
      !!process.env.LEMONSQUEEZY_REFERRAL_DISCOUNT_CODE;

    const marketingUrl =
      process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://protocolsbyjames.com";

    const checkoutUrl = await createCheckout({
      variantId,
      customerEmail: profile?.email ?? user.email ?? "",
      customerName: profile?.full_name ?? undefined,
      successUrl: `${marketingUrl}/onboarding/agreement?checkout_id={checkout_id}`,
      customData,
      discountCode: shouldApplyDiscount
        ? process.env.LEMONSQUEEZY_REFERRAL_DISCOUNT_CODE
        : undefined,
    });

    return NextResponse.json({ url: checkoutUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Checkout session creation failed:", message);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
