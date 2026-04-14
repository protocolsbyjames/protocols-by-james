# Stripe Approval Playbook — PBJ Fitness App Go-Live

Run this the moment Stripe emails you that verification is approved. Total time: ~20–30 min.

---

## 1. Create subscription prices in Stripe (5 min)

Go to **Stripe Dashboard → Product catalog → Add product**.

Create **one product** called "Protocols by James Coaching" with three recurring prices attached:

| Price nickname | Amount | Interval |
|---|---|---|
| Starter | $45.99 | Monthly |
| Pro | $69.99 | Monthly |
| Elite | $129.99 | Monthly |

After creating each price, copy its ID (format: `price_1Nxxxxx…`). You'll need all three in step 3.

> **Note:** Stripe's UI has "product" and "price" as separate concepts. One product with three prices is cleaner than three products.

---

## 2. Create the referral coupon (2 min)

**Stripe Dashboard → Products → Coupons → New**

- **Amount off:** $20.00 USD
- **Duration:** Once
- **ID (set explicitly):** `REFERRAL20` (or whatever — just remember it)
- **Redemption limits:** leave unlimited

Copy the coupon ID for step 3.

---

## 3. Add env vars to Vercel (3 min)

**Vercel Dashboard → pbj-fitness-app → Settings → Environment Variables**

Add (all scopes: Production, Preview, Development):

```
STRIPE_PRICE_STARTER=price_1Nxxxxx...   (Starter price ID from step 1)
STRIPE_PRICE_PRO=price_1Nxxxxx...       (Pro price ID from step 1)
STRIPE_PRICE_ELITE=price_1Nxxxxx...     (Elite price ID from step 1)
STRIPE_COUPON_REFEREE=REFERRAL20        (Coupon ID from step 2)
```

Click **Save**, then redeploy the latest production build so the env vars take effect (Deployments → latest → ⋯ → Redeploy).

---

## 4. Run the pending Supabase migrations (5 min)

**Supabase Dashboard → SQL Editor → New query**

Paste migration `00003` (referral schema) and run. Check for errors.
Then paste migration `00004` (referral audit + constraints) and run.

Files live in the repo at `supabase/migrations/00003_*.sql` and `00004_*.sql`.

> If either errors: stop, screenshot the error, send it to me. Don't force it.

---

## 5. Fill in seed SQL placeholders and run (3 min)

Open `supabase/seed_james_plans.sql` in your editor. Find the four `REPLACE_ME` tokens and replace:

- `REPLACE_ME_STARTER_PRICE` → the Starter price ID from step 1
- `REPLACE_ME_PRO_PRICE` → the Pro price ID from step 1
- `REPLACE_ME_ELITE_PRICE` → the Elite price ID from step 1
- `REPLACE_ME_COACH_ID` → your user ID in `profiles` (grab it by running `select id, full_name from profiles where role = 'coach';` in the SQL editor)

Paste the filled-in SQL into **Supabase SQL Editor** and run.

---

## 6. Stripe webhook endpoint (2 min)

**Stripe Dashboard → Developers → Webhooks → Add endpoint**

- URL: `https://app.protocolsbyjames.com/api/webhooks/stripe`
- Events to send:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`

Copy the **signing secret** (starts with `whsec_`) and add it to Vercel as:

```
STRIPE_WEBHOOK_SECRET=whsec_...
```

Redeploy.

---

## 7. Smoke-test before going public

See `end-to-end-test.md` for the full walkthrough. Quick version:

1. Open app.protocolsbyjames.com in an incognito window
2. Sign up as a test client
3. Hit checkout → use Stripe test card `4242 4242 4242 4242`, any future date, any CVC, any zip
4. Confirm subscription shows "active" in your coach dashboard
5. Confirm a new row appears in the `subscriptions` table in Supabase

If all green → you're live. Announce on whatever channels you want.

---

## If something goes sideways

- **Checkout 500s:** check Vercel function logs for `/api/checkout`. Usually a missing env var.
- **Webhook not firing:** Stripe Dashboard → Webhooks → your endpoint → recent deliveries. If they're 4xx/5xx, log the response body.
- **Migration errors:** send me the error text, don't manually "fix" the schema.
- **Referral credit didn't apply:** check webhook logs for the `creditReferrerIfPending` call in `/api/webhooks/stripe`.

Ping me when approval lands and we'll run it together.
