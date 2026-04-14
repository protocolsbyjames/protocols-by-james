import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type CoachingPlanRow = {
  id: string;
  plan_type: "self_guided" | "coaching" | "addon";
  stripe_price_id: string;
  stripe_program_price_id: string | null;
  price_cents: number;
  currency: string;
};

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Webhook signature verification failed: ${message}`);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode !== "subscription" || !session.subscription) {
          break;
        }

        const subscription = (await stripe.subscriptions.retrieve(
          session.subscription as string,
          { expand: ["items.data.price"] },
        )) as unknown as Stripe.Subscription;

        const clientId = session.metadata?.client_id;
        const coachId = session.metadata?.coach_id;
        const mainPlanId = session.metadata?.plan_id;
        const mainPlanType = session.metadata?.plan_type as
          | "self_guided"
          | "coaching"
          | undefined;

        if (!clientId || !coachId || !mainPlanId || !mainPlanType) {
          console.error("Missing required metadata in checkout session");
          break;
        }

        // Load the main plan to learn which stripe_price_id is the primary
        // recurring price and which (for self_guided) is the one-time program
        // price. We need this to correctly bucket each subscription item below.
        const { data: mainPlan } = await supabaseAdmin
          .from("coaching_plans")
          .select(
            "id, plan_type, stripe_price_id, stripe_program_price_id, price_cents, currency",
          )
          .eq("id", mainPlanId)
          .maybeSingle<CoachingPlanRow>();

        if (!mainPlan) {
          console.error(`Main plan ${mainPlanId} not found`);
          break;
        }

        // Find the subscription item that represents the main recurring price.
        // This is what we store in subscriptions.price_id — NOT any add-on line.
        const mainItem = subscription.items.data.find(
          (item) => item.price.id === mainPlan.stripe_price_id,
        );

        if (!mainItem) {
          console.error(
            `Main plan price ${mainPlan.stripe_price_id} not present on subscription`,
          );
          break;
        }

        const { data: insertedSub, error: subError } = await supabaseAdmin
          .from("subscriptions")
          .upsert(
            {
              stripe_subscription_id: subscription.id,
              stripe_customer_id: session.customer as string,
              client_id: clientId,
              coach_id: coachId,
              status: subscription.status,
              price_id: mainItem.price.id,
              price_cents: mainPlan.price_cents,
              current_period_end: mainItem.current_period_end
                ? new Date(mainItem.current_period_end * 1000).toISOString()
                : null,
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

        // ----------------------------------------------------------
        // Add-ons: any attached_addon_plan_ids from metadata become
        // subscription_addons rows. Each one is matched against a
        // subscription item so we can store its stripe_subscription_item_id
        // (needed later for mid-cycle attach/remove flows).
        // ----------------------------------------------------------
        const addonIdsRaw = session.metadata?.attached_addon_plan_ids;
        if (addonIdsRaw) {
          try {
            const addonPlanIds = JSON.parse(addonIdsRaw) as string[];
            if (Array.isArray(addonPlanIds) && addonPlanIds.length > 0) {
              const { data: addonPlans } = await supabaseAdmin
                .from("coaching_plans")
                .select("id, stripe_price_id")
                .in("id", addonPlanIds)
                .returns<{ id: string; stripe_price_id: string }[]>();

              for (const addonPlan of addonPlans ?? []) {
                const addonItem = subscription.items.data.find(
                  (item) => item.price.id === addonPlan.stripe_price_id,
                );
                if (!addonItem) continue;

                const { error: addonError } = await supabaseAdmin
                  .from("subscription_addons")
                  .upsert(
                    {
                      subscription_id: insertedSub.id,
                      addon_plan_id: addonPlan.id,
                      stripe_subscription_item_id: addonItem.id,
                      stripe_price_id: addonPlan.stripe_price_id,
                      status: "active",
                      current_period_end: addonItem.current_period_end
                        ? new Date(
                            addonItem.current_period_end * 1000,
                          ).toISOString()
                        : null,
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

        // ----------------------------------------------------------
        // Self-guided hybrid: record the one-time program purchase.
        // Stripe bills the one-time line on the subscription's first invoice.
        // We look it up via the session's invoice object.
        // ----------------------------------------------------------
        if (
          mainPlanType === "self_guided" &&
          mainPlan.stripe_program_price_id &&
          session.invoice
        ) {
          try {
            const invoice = (await stripe.invoices.retrieve(
              session.invoice as string,
              { expand: ["payment_intent"] },
            )) as unknown as Stripe.Invoice & {
              payment_intent?: Stripe.PaymentIntent | string | null;
            };

            // Find the one-time line on this invoice. In Stripe's modern API
            // the price ID lives at line.pricing.price_details.price (may be
            // a string id or an expanded Price object).
            const oneTimeLine = invoice.lines.data.find((line) => {
              const priceRef = line.pricing?.price_details?.price;
              const priceId =
                typeof priceRef === "string" ? priceRef : priceRef?.id ?? null;
              return priceId === mainPlan.stripe_program_price_id;
            });

            if (oneTimeLine) {
              const paymentIntentId =
                typeof invoice.payment_intent === "string"
                  ? invoice.payment_intent
                  : invoice.payment_intent?.id ?? null;

              const { error: programError } = await supabaseAdmin
                .from("program_purchases")
                .upsert(
                  {
                    client_id: clientId,
                    coach_id: coachId,
                    plan_id: mainPlanId,
                    stripe_payment_intent_id: paymentIntentId,
                    stripe_checkout_session_id: session.id,
                    stripe_invoice_id: invoice.id,
                    amount_cents: oneTimeLine.amount,
                    currency: oneTimeLine.currency,
                  },
                  { onConflict: "stripe_payment_intent_id" },
                );

              if (programError) {
                console.error(
                  "Failed to upsert program_purchase:",
                  programError,
                );
              }
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("Program purchase recording failed:", msg);
          }
        }

        // ----------------------------------------------------------
        // Referral credit: wrapped in try/catch so referral failures never
        // fail the whole webhook — the subscription is already recorded.
        // ----------------------------------------------------------
        try {
          await creditReferrerIfPending(clientId);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("Referral credit failed:", msg);
        }

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as unknown as Stripe.Subscription;

        // Find the main subscription row. We need to sync its status and
        // also sync every add-on row against the current line items so
        // mid-cycle attach/remove reflects immediately.
        const { data: subRow } = await supabaseAdmin
          .from("subscriptions")
          .select("id, price_id")
          .eq("stripe_subscription_id", subscription.id)
          .maybeSingle();

        if (!subRow) {
          // Unknown sub — nothing to sync.
          break;
        }

        const mainItem = subscription.items.data.find(
          (item) => item.price.id === subRow.price_id,
        );

        const { error: updateError } = await supabaseAdmin
          .from("subscriptions")
          .update({
            status: subscription.status,
            current_period_end: mainItem?.current_period_end
              ? new Date(mainItem.current_period_end * 1000).toISOString()
              : null,
          })
          .eq("id", subRow.id);

        if (updateError) {
          console.error("Failed to update subscription:", updateError);
          return NextResponse.json(
            { error: "Database error" },
            { status: 500 },
          );
        }

        // Sync every add-on row: if the Stripe subscription still has the
        // add-on line, update it; if it's gone, mark it canceled.
        const { data: existingAddons } = await supabaseAdmin
          .from("subscription_addons")
          .select("id, stripe_subscription_item_id, stripe_price_id")
          .eq("subscription_id", subRow.id);

        for (const addon of existingAddons ?? []) {
          const stripeItem = subscription.items.data.find(
            (item) => item.id === addon.stripe_subscription_item_id,
          );

          if (stripeItem) {
            await supabaseAdmin
              .from("subscription_addons")
              .update({
                status: "active",
                current_period_end: stripeItem.current_period_end
                  ? new Date(stripeItem.current_period_end * 1000).toISOString()
                  : null,
              })
              .eq("id", addon.id);
          } else {
            await supabaseAdmin
              .from("subscription_addons")
              .update({ status: "canceled" })
              .eq("id", addon.id);
          }
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as unknown as Stripe.Subscription;

        const { data: subRow } = await supabaseAdmin
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", subscription.id)
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

      default:
        // Unhandled event type — acknowledge receipt
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
 * Credit the referrer $20 (via Stripe customer balance) on the referee's
 * first successful paid checkout. Idempotent: only acts on referrals rows
 * whose status is still 'pending'.
 */
async function creditReferrerIfPending(refereeId: string) {
  const { data: referral } = await supabaseAdmin
    .from("referrals")
    .select("id, referrer_id, credit_cents, status")
    .eq("referee_id", refereeId)
    .maybeSingle();

  if (!referral || referral.status !== "pending") return;

  const { data: referrer } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, stripe_customer_id")
    .eq("id", referral.referrer_id)
    .maybeSingle();

  if (!referrer) {
    console.error("Referrer profile missing for referral", referral.id);
    return;
  }

  let referrerCustomerId = referrer.stripe_customer_id as string | null;

  if (!referrerCustomerId) {
    const customer = await stripe.customers.create({
      email: referrer.email ?? undefined,
      name: referrer.full_name ?? undefined,
      metadata: { supabase_user_id: referrer.id },
    });
    referrerCustomerId = customer.id;

    await supabaseAdmin
      .from("profiles")
      .update({ stripe_customer_id: referrerCustomerId })
      .eq("id", referrer.id);
  }

  const balanceTxn = await stripe.customers.createBalanceTransaction(
    referrerCustomerId,
    {
      amount: -Math.abs(referral.credit_cents),
      currency: "usd",
      description: `Referral credit for referring user ${refereeId}`,
      metadata: {
        referral_id: referral.id,
        referrer_id: referral.referrer_id,
        referee_id: refereeId,
      },
    },
  );

  await supabaseAdmin
    .from("referrals")
    .update({
      status: "credited",
      stripe_balance_txn_id: balanceTxn.id,
      credited_at: new Date().toISOString(),
    })
    .eq("id", referral.id);

  await supabaseAdmin
    .from("profiles")
    .update({ referral_discount_applied: true })
    .eq("id", refereeId);
}
