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
