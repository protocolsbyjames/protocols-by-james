import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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
        )) as unknown as Stripe.Subscription;

        const clientId = session.metadata?.client_id;
        const coachId = session.metadata?.coach_id;

        if (!clientId || !coachId) {
          console.error("Missing client_id or coach_id in session metadata");
          break;
        }

        const { error } = await supabaseAdmin.from("subscriptions").upsert(
          {
            stripe_subscription_id: subscription.id,
            stripe_customer_id: session.customer as string,
            client_id: clientId,
            coach_id: coachId,
            status: subscription.status,
            price_id: subscription.items.data[0]?.price.id,
            current_period_end: subscription.items.data[0]?.current_period_end
              ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
              : null,
          },
          { onConflict: "stripe_subscription_id" },
        );

        if (error) {
          console.error("Failed to upsert subscription:", error);
          return NextResponse.json(
            { error: "Database error" },
            { status: 500 },
          );
        }

        // ----------------------------------------------------------
        // Referral credit: if this referee was referred, credit the
        // referrer $20 to their Stripe customer balance. Guarded on
        // referrals.status='pending' so replaying the webhook is safe.
        // ----------------------------------------------------------
        try {
          await creditReferrerIfPending(clientId);
        } catch (err) {
          // Don't fail the whole webhook if referral crediting blows up —
          // the subscription itself is already recorded. Log + continue.
          const msg = err instanceof Error ? err.message : String(err);
          console.error("Referral credit failed:", msg);
        }

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as unknown as Stripe.Subscription;

        const { error } = await supabaseAdmin
          .from("subscriptions")
          .update({
            status: subscription.status,
            price_id: subscription.items.data[0]?.price.id,
            current_period_end: subscription.items.data[0]?.current_period_end
              ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
              : null,
          })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          console.error("Failed to update subscription:", error);
          return NextResponse.json(
            { error: "Database error" },
            { status: 500 },
          );
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as unknown as Stripe.Subscription;

        const { error } = await supabaseAdmin
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          console.error("Failed to mark subscription canceled:", error);
          return NextResponse.json(
            { error: "Database error" },
            { status: 500 },
          );
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
 *
 * Effects when a pending referral exists for `refereeId`:
 *  1. Ensures the referrer has a Stripe customer record.
 *  2. Creates a negative balance transaction on that customer (= credit
 *     that will auto-apply to their next invoice).
 *  3. Marks the referrals row as 'credited'.
 *  4. Marks the referee's `profiles.referral_discount_applied = true` so
 *     they don't get the referee coupon on any subsequent checkout.
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

  // Negative amount = credit to the customer's balance.
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
