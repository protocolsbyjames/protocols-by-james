/**
 * LemonSqueezy SDK wrapper — replaces the old Stripe integration.
 *
 * Env vars required:
 *   LEMONSQUEEZY_API_KEY       — API key from LS dashboard → Settings → API
 *   LEMONSQUEEZY_STORE_ID      — Your store ID (number)
 *   LEMONSQUEEZY_WEBHOOK_SECRET — Webhook signing secret
 *
 * The coaching_plans table continues to use the same columns but now stores
 * LemonSqueezy variant IDs instead of Stripe price IDs:
 *   stripe_price_id          → LS variant ID for the recurring subscription
 *   stripe_program_price_id  → LS variant ID for self-guided one-time purchase (if separate)
 */

import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";

const LS_API_BASE = "https://api.lemonsqueezy.com/v1";

function apiKey(): string {
  const key = process.env.LEMONSQUEEZY_API_KEY;
  if (!key) throw new Error("LEMONSQUEEZY_API_KEY is not set");
  return key;
}

function storeId(): string {
  const id = process.env.LEMONSQUEEZY_STORE_ID;
  if (!id) throw new Error("LEMONSQUEEZY_STORE_ID is not set");
  return id;
}

/**
 * Make an authenticated request to the LemonSqueezy API.
 */
async function lsApi<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${LS_API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey()}`,
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LemonSqueezy API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ────────────────────────────────────────────────────────────────
// Checkout
// ────────────────────────────────────────────────────────────────

type CreateCheckoutParams = {
  variantId: string;
  customerEmail: string;
  customerName?: string;
  successUrl: string;
  cancelUrl?: string;
  customData?: Record<string, string>;
  discountCode?: string;
};

type CheckoutResponse = {
  data: {
    id: string;
    attributes: {
      url: string;
      [key: string]: unknown;
    };
  };
};

/**
 * Create a LemonSqueezy checkout session and return the checkout URL.
 */
export async function createCheckout(
  params: CreateCheckoutParams,
): Promise<string> {
  const body = {
    data: {
      type: "checkouts" as const,
      attributes: {
        checkout_data: {
          email: params.customerEmail,
          name: params.customerName ?? undefined,
          custom: params.customData ?? {},
          discount_code: params.discountCode ?? undefined,
        },
        product_options: {
          redirect_url: params.successUrl,
        },
      },
      relationships: {
        store: {
          data: { type: "stores" as const, id: storeId() },
        },
        variant: {
          data: { type: "variants" as const, id: params.variantId },
        },
      },
    },
  };

  const result = await lsApi<CheckoutResponse>("/checkouts", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return result.data.attributes.url;
}

// ────────────────────────────────────────────────────────────────
// Subscriptions
// ────────────────────────────────────────────────────────────────

type LsSubscription = {
  data: {
    id: string;
    attributes: {
      store_id: number;
      customer_id: number;
      order_id: number;
      product_id: number;
      variant_id: number;
      status: string;
      card_brand: string | null;
      card_last_four: string | null;
      renews_at: string | null;
      ends_at: string | null;
      created_at: string;
      updated_at: string;
      urls: {
        update_payment_method: string;
        customer_portal: string;
      };
      first_subscription_item: {
        id: number;
        price_id: number;
      } | null;
      [key: string]: unknown;
    };
  };
};

export async function getSubscription(
  subscriptionId: string,
): Promise<LsSubscription> {
  return lsApi<LsSubscription>(`/subscriptions/${subscriptionId}`);
}

// ────────────────────────────────────────────────────────────────
// Customers
// ────────────────────────────────────────────────────────────────

type LsCustomer = {
  data: {
    id: string;
    attributes: {
      store_id: number;
      name: string;
      email: string;
      created_at: string;
      urls: {
        customer_portal: string;
      };
      [key: string]: unknown;
    };
  };
};

type LsCustomerList = {
  data: LsCustomer["data"][];
};

export async function getCustomerByEmail(
  email: string,
): Promise<LsCustomer["data"] | null> {
  const result = await lsApi<LsCustomerList>(
    `/customers?filter[store_id]=${storeId()}&filter[email]=${encodeURIComponent(email)}`,
  );
  return result.data.length > 0 ? result.data[0] : null;
}

// ────────────────────────────────────────────────────────────────
// Orders (for one-time purchases / self-guided programs)
// ────────────────────────────────────────────────────────────────

type LsOrder = {
  data: {
    id: string;
    attributes: {
      store_id: number;
      customer_id: number;
      status: string;
      total: number;
      currency: string;
      created_at: string;
      urls: {
        receipt: string;
      };
      first_order_item: {
        variant_id: number;
        price_id: number;
      } | null;
      [key: string]: unknown;
    };
  };
};

export async function getOrder(orderId: string): Promise<LsOrder> {
  return lsApi<LsOrder>(`/orders/${orderId}`);
}

// ────────────────────────────────────────────────────────────────
// Webhook verification
// ────────────────────────────────────────────────────────────────

/**
 * Verify that a webhook request came from LemonSqueezy.
 * Returns the parsed event body if valid, throws otherwise.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
): unknown {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) throw new Error("LEMONSQUEEZY_WEBHOOK_SECRET is not set");

  const hmac = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  if (hmac !== signature) {
    throw new Error("Invalid webhook signature");
  }

  return JSON.parse(rawBody);
}

// ────────────────────────────────────────────────────────────────
// Customer management (mirrors old getOrCreateStripeCustomer)
// ────────────────────────────────────────────────────────────────

/**
 * Get or store the LemonSqueezy customer ID for a user.
 *
 * Note: LemonSqueezy creates customers automatically when they check out.
 * We store the LS customer_id in profiles.stripe_customer_id (reusing the
 * column to avoid a migration). On the first checkout, the webhook writes
 * this back after the customer is created.
 */
export async function getStoredCustomerId(
  userId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();
  return data?.stripe_customer_id ?? null;
}

export async function storeCustomerId(
  userId: string,
  customerId: string,
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ stripe_customer_id: customerId })
    .eq("id", userId);
}
