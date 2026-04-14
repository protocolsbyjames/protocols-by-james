# Stripe Approval Playbook — PBJ Fitness App Go-Live

Run this the moment Stripe emails you that verification is approved. Total time: ~30–40 min (more than before because of the hybrid program pricing).

**Note:** The canonical version of this doc lives in the fitness-app repo at `docs/stripe-go-live.md`. Update both copies if you change anything.

---

## Product lineup recap

Here's what we're creating in Stripe — five products, one of which is a $0 referral coupon, and some products have multiple prices:

| Product | Price | Type |
|---|---|---|
| Shortcut to Size — program | $39.99 | One-time |
| Shortcut to Size — app access | $14.99/mo | Recurring |
| Shortcut to Shred — program | $39.99 | One-time |
| Shortcut to Shred — app access | $14.99/mo | Recurring |
| Performance Coaching | $69.99/mo | Recurring |
| Elite Coaching | $129.99/mo | Recurring |
| VIP Community add-on | $19.99/mo | Recurring |
| Referral discount | -$20 once | Coupon |

> The hybrid programs (one-time + recurring) are best modeled as **two separate Stripe prices under one product each**. The app's checkout flow will attach both to the same Checkout Session so the customer pays $39.99 today + starts the $14.99/mo subscription.

---

## 1. Create products + prices in Stripe (15 min)

Go to **Stripe Dashboard → Product catalog → Add product** for each.

### Product 1 — Shortcut to Size
- **Name:** Shortcut to Size
- **Price 1:** $39.99, one-time (nickname: "Program access")
- **Price 2:** $14.99, recurring monthly (nickname: "App access")

### Product 2 — Shortcut to Shred
- **Name:** Shortcut to Shred
- **Price 1:** $39.99, one-time
- **Price 2:** $14.99, recurring monthly

### Product 3 — Performance Coaching
- **Name:** Performance Coaching
- **Price:** $69.99, recurring monthly

### Product 4 — Elite Coaching
- **Name:** Elite Coaching
- **Price:** $129.99, recurring monthly

### Product 5 — VIP Community
- **Name:** VIP Community Add-on
- **Price:** $19.99, recurring monthly

After creating each price, copy its ID (`price_1Nxxxxx…`). You'll paste them into env vars in step 3.

---

## 2. Create the referral coupon (2 min)

**Stripe Dashboard → Products → Coupons → New**

- **Amount off:** $20.00 USD
- **Duration:** Once
- **ID (set explicitly):** `REFERRAL20`
- **Redemption limits:** unlimited

---

## 3. Add env vars to Vercel (5 min)

**Vercel Dashboard → pbj-fitness-app → Settings → Environment Variables**

Add (all scopes: Production, Preview, Development):

```
# Self-guided programs
STRIPE_PRICE_SIZE_ONETIME=price_...       (Shortcut to Size $39.99 one-time)
STRIPE_PRICE_SIZE_MONTHLY=price_...       (Shortcut to Size $14.99/mo)
STRIPE_PRICE_SHRED_ONETIME=price_...      (Shortcut to Shred $39.99 one-time)
STRIPE_PRICE_SHRED_MONTHLY=price_...      (Shortcut to Shred $14.99/mo)

# 1:1 coaching
STRIPE_PRICE_PERFORMANCE=price_...        (Performance $69.99/mo)
STRIPE_PRICE_ELITE=price_...              (Elite $129.99/mo)

# Add-ons
STRIPE_PRICE_VIP_COMMUNITY=price_...      (VIP Community $19.99/mo)

# Referral
STRIPE_COUPON_REFEREE=REFERRAL20
```

Click **Save**, then redeploy the latest production build (Deployments → latest → ⋯ → Redeploy).

---

## 4. Run the pending Supabase migrations (5 min)

**Supabase Dashboard → SQL Editor → New query**

Paste migration `00003` (referral schema) and run. Check for errors.
Then paste migration `00004` (referral audit + constraints) and run.

Files live in the repo at `supabase/migrations/00003_*.sql` and `00004_*.sql`.

> **Heads up:** the seed file still assumes the old 3-tier structure. We'll need to update the app's `subscriptions` schema (or the seed) to accommodate 4 coaching tiers + the add-on. Flag for Claude Code session.

---

## 5. Fill in seed SQL placeholders and run (5 min)

Open `supabase/seed_james_plans.sql`. The old version had three plans (Starter/Pro/Elite). We now need to update it to reflect the new lineup.

**If the seed still uses old tiers:** skip for now. Ask Claude Code to regenerate the seed for the new lineup before running it.

**Otherwise:** replace the `REPLACE_ME_*_PRICE` tokens with the new price IDs from step 1 and run.

---

## 6. Stripe webhook endpoint (2 min)

**Stripe Dashboard → Developers → Webhooks → Add endpoint**

- URL: `https://app.protocolsbyjames.com/api/webhooks/stripe`
- Events:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`

Copy the signing secret (`whsec_...`) and add to Vercel as:

```
STRIPE_WEBHOOK_SECRET=whsec_...
```

Redeploy.

---

## 7. App code changes needed before launch

The fitness app's checkout flow was written for single-price subscriptions. These need updates:

1. **Pricing page/signup UI:** add the 4 tiers + add-on option (currently shows 3)
2. **Checkout session builder (`/api/checkout/route.ts`):** for Size/Shred, pass TWO line items (one-time + recurring). For coaching tiers, single line item. Add optional VIP add-on line item.
3. **Subscription webhook handler:** distinguish between program sub + coaching sub (different UX in the app)
4. **Referral coupon logic:** currently applies to all subs. Decide: does the referral apply to Size/Shred monthly? To VIP add-on? Default assumption = only applies to Performance/Elite.

**None of this is on the Cowork side** — it's terminal Claude Code / fitness-app repo work. Flag when you want me to coordinate.

---

## 8. Smoke-test before going public

See `docs/end-to-end-test.md` for the full walkthrough. (Needs updating for the new tier lineup — same note as above.)

---

## If something goes sideways

- **Checkout 500s:** check Vercel function logs for `/api/checkout`. Usually a missing env var.
- **Webhook not firing:** Stripe Dashboard → Webhooks → your endpoint → recent deliveries. Check response body on failures.
- **Migration errors:** send me the error, don't manually "fix" the schema.
- **Referral credit didn't apply:** check webhook logs for `creditReferrerIfPending` in `/api/webhooks/stripe`.
- **Hybrid checkout doesn't charge both prices:** the Checkout Session `line_items` array needs both the one-time and recurring price attached. This is the #1 bug I'd expect in a fresh implementation.

Ping me when approval lands.
