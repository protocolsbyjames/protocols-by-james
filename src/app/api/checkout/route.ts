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
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { priceId, coachId } = await request.json();

    if (!priceId || !coachId) {
      return NextResponse.json(
        { error: "Missing required fields: priceId and coachId" },
        { status: 400 },
      );
    }

    const customerId = await getOrCreateStripeCustomer(user.id);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/dashboard?checkout=canceled`,
      metadata: {
        client_id: user.id,
        coach_id: coachId,
      },
      subscription_data: {
        metadata: {
          client_id: user.id,
          coach_id: coachId,
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
