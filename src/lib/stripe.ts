import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
});

/**
 * Get an existing Stripe customer ID for a user, or create a new customer
 * and persist the ID back to the profiles table.
 */
export async function getOrCreateStripeCustomer(userId: string) {
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email, full_name")
    .eq("id", userId)
    .single();

  if (error) throw error;

  if (profile.stripe_customer_id) {
    return profile.stripe_customer_id as string;
  }

  const customer = await stripe.customers.create({
    email: profile.email ?? undefined,
    name: profile.full_name ?? undefined,
    metadata: { supabase_user_id: userId },
  });

  await supabase
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  return customer.id;
}
