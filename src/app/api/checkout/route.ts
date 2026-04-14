import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, getOrCreateStripeCustomer } from "@/lib/stripe";
import type Stripe from "stripe";

type PlanRow = {
  id: string;
  coach_id: string;
  plan_type: "self_guided" | "coaching" | "addon";
  stripe_price_id: string;
  stripe_program_price_id: string | null;
  auto_include_addon_id: string | null;
  is_active: boolean;
};

type AddonPlanRow = {
  id: string;
  plan_type: "self_guided" | "coaching" | "addon";
  stripe_price_id: string;
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

    // Clients cannot subscribe directly to an add-on — add-ons must be
    // attached to a main plan. Guard even though the UI shouldn't allow it.
    if (plan.plan_type === "addon") {
      return NextResponse.json(
        { error: "Add-ons must be attached to a main plan" },
        { status: 400 },
      );
    }

    // Self-guided hybrid plans require a stripe_program_price_id to charge
    // the one-time program access fee alongside the recurring app access.
    if (plan.plan_type === "self_guided" && !plan.stripe_program_price_id) {
      return NextResponse.json(
        { error: "Hybrid plan is missing its program price" },
        { status: 500 },
      );
    }

    // Pin the client to the coach they're subscribing to.
    await supabase
      .from("profiles")
      .update({ coach_id: plan.coach_id })
      .eq("id", user.id);

    // ----------------------------------------------------------
    // Collect every add-on plan we need to attach to this checkout.
    // - Elite auto_include_addon_id is ALWAYS attached, ignoring client input.
    // - Anything the client explicitly requested (VIP on Performance) is
    //   added too, deduped.
    // ----------------------------------------------------------
    const addonIdsToAttach = new Set<string>();
    if (plan.auto_include_addon_id) {
      addonIdsToAttach.add(plan.auto_include_addon_id);
    }
    for (const id of requestedAddonIds) {
      addonIdsToAttach.add(id);
    }

    let addonPlans: AddonPlanRow[] = [];
    if (addonIdsToAttach.size > 0) {
      const { data: addons, error: addonsError } = await supabase
        .from("coaching_plans")
        .select("id, plan_type, stripe_price_id, is_active")
        .in("id", Array.from(addonIdsToAttach))
        .eq("plan_type", "addon")
        .eq("is_active", true)
        .returns<AddonPlanRow[]>();

      if (addonsError) {
        return NextResponse.json(
          { error: "Failed to load add-ons" },
          { status: 500 },
        );
      }
      addonPlans = addons ?? [];
    }

    // ----------------------------------------------------------
    // Build the Stripe Checkout line items. Everything goes into a single
    // mode='subscription' session — Stripe supports a one-time price as a
    // line item inside a subscription session; it gets charged on the
    // first invoice and doesn't renew.
    // ----------------------------------------------------------
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    // Main recurring price (always present for both coaching and self_guided)
    line_items.push({ price: plan.stripe_price_id, quantity: 1 });

    // One-time program access fee for hybrid plans
    if (plan.plan_type === "self_guided" && plan.stripe_program_price_id) {
      line_items.push({
        price: plan.stripe_program_price_id,
        quantity: 1,
      });
    }

    // Add-on recurring prices (VIP, etc.)
    for (const addon of addonPlans) {
      line_items.push({ price: addon.stripe_price_id, quantity: 1 });
    }

    // ----------------------------------------------------------
    // Referral coupon: only apply on the FIRST paid checkout. Checked via
    // profiles.referral_discount_applied so re-subscription never double-credits.
    // ----------------------------------------------------------
    const { data: referralProfile } = await supabase
      .from("profiles")
      .select("referred_by, referral_discount_applied")
      .eq("id", user.id)
      .maybeSingle();

    const shouldApplyRefereeDiscount =
      !!referralProfile?.referred_by &&
      !referralProfile.referral_discount_applied &&
      !!process.env.STRIPE_COUPON_REFEREE;

    const customerId = await getOrCreateStripeCustomer(user.id);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

    // Metadata: the webhook uses these to write program_purchases and
    // subscription_addons rows. attached_addon_plan_ids is a JSON-encoded
    // list so the webhook can map Stripe line items back to our plan rows.
    const metadata: Record<string, string> = {
      client_id: user.id,
      coach_id: plan.coach_id,
      plan_id: plan.id,
      plan_type: plan.plan_type,
    };
    if (addonPlans.length > 0) {
      metadata.attached_addon_plan_ids = JSON.stringify(
        addonPlans.map((a) => a.id),
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items,
      success_url: `${appUrl}/client?checkout=success`,
      cancel_url: `${appUrl}/onboarding?checkout=canceled`,
      ...(shouldApplyRefereeDiscount
        ? { discounts: [{ coupon: process.env.STRIPE_COUPON_REFEREE! }] }
        : {}),
      metadata,
      subscription_data: { metadata },
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
