import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/lemonsqueezy";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * LemonSqueezy webhook events we handle:
 *
 *   subscription_created  — New subscription after checkout (like Stripe checkout.session.completed)
 *   subscription_updated  — Status change, renewal, etc.
 *   subscription_cancelled — Subscription canceled
 *   order_created         — One-time purchase completed (self-guided programs)
 *
 * All custom metadata we set during checkout lives in:
 *   event.meta.custom_data.{client_id, coach_id, plan_id, plan_type, ...}
 *
 * We reuse the existing stripe_* columns in the database to store LS IDs,
 * avoiding a migration. Column mapping:
 *   stripe_subscription_id  → LS subscription ID
 *   stripe_customer_id      → LS customer ID
 *   price_id                → LS variant ID
 *   stripe_payment_intent_id → LS order ID
 */

type LsWebhookEvent = {
  meta: {
    event_name: string;
    custom_data?: Record<string, string>;
  };
  data: {
    id: string;
    type: string;
    attributes: Record<string, unknown>;
  };
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing x-signature header" },
      { status: 400 },
    );
  }

  let event: LsWebhookEvent;

  try {
    event = verifyWebhookSignature(rawBody, signature) as LsWebhookEvent;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Webhook signature verification failed: ${message}`);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 },
    );
  }

  const eventName = event.meta.event_name;
  const attrs = event.data.attributes;
  const customData = event.meta.custom_data ?? {};

  try {
    switch (eventName) {
      // ────────────────────────────────────────────────────────
      // SUBSCRIPTION CREATED — record the new subscription
      // ────────────────────────────────────────────────────────
      case "subscription_created": {
        const clientId = customData.client_id;
        const coachId = customData.coach_id;
        const planId = customData.plan_id;
        const planType = customData.plan_type as
          | "self_guided"
          | "coaching"
          | undefined;

        if (!clientId || !coachId || !planId) {
          console.error("Missing required custom_data in subscription_created");
          break;
        }

        const subscriptionId = String(event.data.id);
        const customerId = String(attrs.customer_id);
        const variantId = String(attrs.variant_id);
        const status = mapLsStatus(attrs.status as string);
        const renewsAt = (attrs.renews_at as string) ?? null;

        // Load the plan to get price info
        const { data: plan } = await supabaseAdmin
          .from("coaching_plans")
          .select("id, price_cents, currency")
          .eq("id", planId)
          .maybeSingle();

        // Store the LS customer ID on the profile (reusing stripe_customer_id column)
        await supabaseAdmin
          .from("profiles")
          .update({ stripe_customer_id: customerId })
          .eq("id", clientId);

        // Upsert the subscription row
        const { data: insertedSub, error: subError } = await supabaseAdmin
          .from("subscriptions")
          .upsert(
            {
              stripe_subscription_id: subscriptionId,
              stripe_customer_id: customerId,
              client_id: clientId,
              coach_id: coachId,
              status,
              price_id: variantId,
              price_cents: plan?.price_cents ?? 0,
              current_period_end: renewsAt,
            },
            { onConflict: "stripe_subscription_id" },
          )
          .select("id")
          .single();

        if (subError || !insertedSub) {
          console.error("Failed to upsert subscription:", subError);
          return NextResponse.json(
            { error: "Database error" },
            { status: 500 },
          );
        }

        // Handle add-ons from metadata
        const addonIdsRaw = customData.attached_addon_plan_ids;
        if (addonIdsRaw) {
          try {
            const addonPlanIds = JSON.parse(addonIdsRaw) as string[];
            if (Array.isArray(addonPlanIds) && addonPlanIds.length > 0) {
              for (const addonPlanId of addonPlanIds) {
                const { data: addonPlan } = await supabaseAdmin
                  .from("coaching_plans")
                  .select("id, stripe_price_id")
                  .eq("id", addonPlanId)
                  .maybeSingle();

                if (!addonPlan) continue;

                const { error: addonError } = await supabaseAdmin
                  .from("subscription_addons")
                  .upsert(
                    {
                      subscription_id: insertedSub.id,
                      addon_plan_id: addonPlan.id,
                      stripe_subscription_item_id: `ls_addon_${subscriptionId}_${addonPlan.id}`,
                      stripe_price_id: addonPlan.stripe_price_id,
                      status: "active",
                      current_period_end: renewsAt,
                    },
                    { onConflict: "subscription_id,addon_plan_id" },
                  );

                if (addonError) {
                  console.error("Failed to upsert addon:", addonError);
                }
              }
            }
          } catch (err) {
            console.error("Failed to parse addon metadata:", err);
          }
        }

        // Referral credit (simplified — no Stripe balance, just mark credited)
        try {
          await creditReferrerIfPending(clientId);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("Referral credit failed:", msg);
        }

        break;
      }

      // ────────────────────────────────────────────────────────
      // SUBSCRIPTION UPDATED — sync status
      // ────────────────────────────────────────────────────────
      case "subscription_updated": {
        const subscriptionId = String(event.data.id);
        const status = mapLsStatus(attrs.status as string);
        const renewsAt = (attrs.renews_at as string) ?? null;

        const { data: subRow } = await supabaseAdmin
          .from("subscriptions")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();

        if (!subRow) break;

        const { error: updateError } = await supabaseAdmin
          .from("subscriptions")
          .update({
            status,
            current_period_end: renewsAt,
          })
          .eq("id", subRow.id);

        if (updateError) {
          console.error("Failed to update subscription:", updateError);
          return NextResponse.json(
            { error: "Database error" },
            { status: 500 },
          );
        }

        // Sync addon statuses
        if (status === "canceled" || status === "expired") {
          await supabaseAdmin
            .from("subscription_addons")
            .update({ status: "canceled" })
            .eq("subscription_id", subRow.id);
        }

        break;
      }

      // ────────────────────────────────────────────────────────
      // SUBSCRIPTION CANCELLED
      // ────────────────────────────────────────────────────────
      case "subscription_cancelled": {
        const subscriptionId = String(event.data.id);

        const { data: subRow } = await supabaseAdmin
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", subscriptionId)
          .select("id")
          .maybeSingle();

        if (subRow) {
          await supabaseAdmin
            .from("subscription_addons")
            .update({ status: "canceled" })
            .eq("subscription_id", subRow.id);
        }

        break;
      }

      // ────────────────────────────────────────────────────────
      // ORDER CREATED — one-time purchases (self-guided programs)
      // ────────────────────────────────────────────────────────
      case "order_created": {
        const clientId = customData.client_id;
        const coachId = customData.coach_id;
        const planId = customData.plan_id;
        const planType = customData.plan_type;

        // Only record for self-guided plans
        if (planType !== "self_guided" || !clientId || !coachId || !planId) {
          break;
        }

        const orderId = String(event.data.id);
        const totalCents = Number(attrs.total) || 0;
        const currency = (attrs.currency as string) ?? "usd";

        const { error: programError } = await supabaseAdmin
          .from("program_purchases")
          .upsert(
            {
              client_id: clientId,
              coach_id: coachId,
              plan_id: planId,
              stripe_payment_intent_id: orderId, // Reusing column for LS order_id
              stripe_checkout_session_id: null,
              stripe_invoice_id: null,
              amount_cents: totalCents,
              currency,
            },
            { onConflict: "stripe_payment_intent_id" },
          );

        if (programError) {
          console.error("Failed to upsert program_purchase:", programError);
        }

        break;
      }

      default:
        // Unhandled event — acknowledge receipt
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Webhook handler error: ${message}`);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}

/**
 * Map LemonSqueezy subscription statuses to our database enum.
 * LS statuses: on_trial, active, paused, past_due, unpaid, cancelled, expired
 */
function mapLsStatus(lsStatus: string): string {
  const map: Record<string, string> = {
    on_trial: "trialing",
    active: "active",
    paused: "paused",
    past_due: "past_due",
    unpaid: "unpaid",
    cancelled: "canceled",
    expired: "canceled",
  };
  return map[lsStatus] ?? "inactive";
}

/**
 * Credit the referrer when referee completes first checkout.
 * Simplified version — instead of Stripe balance transactions, we just
 * mark the referral as credited in our database. James can issue credits
 * manually or through LS discount codes.
 */
async function creditReferrerIfPending(refereeId: string) {
  const { data: referral } = await supabaseAdmin
    .from("referrals")
    .select("id, referrer_id, credit_cents, status")
    .eq("referee_id", refereeId)
    .maybeSingle();

  if (!referral || referral.status !== "pending") return;

  await supabaseAdmin
    .from("referrals")
    .update({
      status: "credited",
      // No Stripe balance txn — credit tracked in our DB only
      stripe_balance_txn_id: `ls_referral_credit_${referral.id}`,
      credited_at: new Date().toISOString(),
    })
    .eq("id", referral.id);

  await supabaseAdmin
    .from("profiles")
    .update({ referral_discount_applied: true })
    .eq("id", refereeId);
}
