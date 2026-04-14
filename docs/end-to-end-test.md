# PBJ Fitness App — End-to-End Launch Test Script

Run this after completing the Stripe approval playbook. It covers every critical user path before you announce the launch.

**Time:** ~30 min
**Prereqs:** Stripe live mode activated, webhook endpoint configured, migrations run, env vars set in Vercel.

---

## Setup

Open three browser windows, all in **incognito** (to avoid cookie pollution):

1. **Window A — your own Gmail** (use jamesquilter@gmail.com or an alias). You'll be the referrer.
2. **Window B — a throwaway test email** (e.g. jamesquilter+testreferee@gmail.com — Gmail treats +suffix as the same inbox). You'll be the referee.
3. **Window C — Supabase dashboard + Stripe dashboard** in separate tabs. You'll be watching data land.

Grab your **Stripe test card:** `4242 4242 4242 4242`, any future expiry, any CVC, any zip.

> **Don't use a real card for the first smoke test.** Stripe sandbox = test cards only until you're sure everything works end-to-end.

---

## Test 1: Coach onboarding (you, already done)

Skip if you're already set up as a coach. Otherwise:

1. Go to app.protocolsbyjames.com/signup
2. Sign up, select **Coach** role during onboarding
3. Verify in Supabase: `select id, role from profiles where email = 'you@example.com';` should show `role = 'coach'`
4. Grab your **referral code** from Client → Settings → Refer a friend

---

## Test 2: Referee signs up with referral link

In **Window B (throwaway email):**

1. Visit `app.protocolsbyjames.com/signup?ref=<YOUR_REFERRAL_CODE>`
2. Confirm page shows "James referred you — you'll get $20 off your first month"
3. Fill out signup form, select **Client** role
4. Complete email confirmation and onboarding

**Verify in Supabase:**
- `select id, referred_by, referral_discount_applied from profiles where email = 'jamesquilter+testreferee@gmail.com';`
- `referred_by` equals your coach profile ID
- `referral_discount_applied` still `false`
- A row exists in `referrals` with `status = 'pending'`, `referrer_id = you`, `referee_id = testreferee`

---

## Test 3: Referee completes checkout

In **Window B**, still signed in as referee:

1. Go to pricing → pick **Pro** ($69.99)
2. On Stripe Checkout, confirm the **discount line shows $20 off**
3. Pay with test card `4242 4242 4242 4242`
4. Redirects back to the app dashboard

**Verify in Stripe Dashboard (test mode):**
- New customer with referee's email
- Subscription active, first invoice total = $49.99
- Your **coach Stripe customer** has a balance transaction of **-$20.00**

**Verify in Supabase:**
- `select status, price_cents from subscriptions where client_id = <testreferee_id>;` → `status = 'active'`, `price_cents = 6999`
- `select status, stripe_balance_txn_id, credited_at from referrals where referee_id = <testreferee_id>;` → `status = 'credited'`
- `select referral_discount_applied from profiles where id = <testreferee_id>;` → `true`

If any fail → stop and debug before testing more.

---

## Test 4: Coach assigns a workout plan

In **Window A (your coach account):**

1. Dashboard → click the testreferee card
2. On client detail page, click **Assign plan** next to Workout Plan
3. Editor opens with referee's name pre-selected
4. Create a simple 2-day plan, save

**Verify in Supabase:**
- `select id, client_id, name from workout_plans where client_id = <testreferee_id>;` → your new plan
- `workout_days` has 2 rows for that plan
- `exercises` has 4 rows across those days

---

## Test 5: Referee sees the assigned plan

Back in **Window B (referee):**

1. Refresh dashboard → Workouts
2. Click into the plan → should see Day 1 and Day 2 with exercises

If it doesn't show: check RLS on `workout_plans` — referee should select their own assigned plan.

---

## Test 6: Referee submits a check-in

In **Window B:**

1. Click Check-in in the sidebar
2. Fill weight, energy, adherence, notes → Submit

**Verify in Supabase:**
- New row in `check_ins` with `client_id = <testreferee_id>`

---

## Test 7: Coach reviews check-in

In **Window A:**

1. Sidebar → Check-ins → queue shows 1 with "Needs feedback" chip
2. Click in, leave feedback, save

**Verify in Supabase:**
- New row in `coach_feedback` tied to the check-in
- Chip flips to "Reviewed"

---

## Test 8: Subscription cancel (optional)

In **Window B:**

1. Account → Cancel subscription
2. Webhook fires → `customer.subscription.updated`

**Verify:**
- `subscriptions.status` flips to `canceled` (or `cancel_at_period_end = true`)
- App: paywall redirect to /onboarding at end of billing period

---

## Test 9: Cleanup

```sql
delete from profiles where email = 'jamesquilter+testreferee@gmail.com';
```
Delete test customer in Stripe (test mode only). Clear your own coach credit balance if you want.

---

## Go-live checklist

- [ ] Toggle Stripe "Test mode" → "Live mode"
- [ ] Re-create 3 prices + `REFERRAL20` coupon in live mode
- [ ] Update Vercel env vars with **live-mode** price IDs + coupon ID
- [ ] Re-add webhook endpoint in live mode, update `STRIPE_WEBHOOK_SECRET`
- [ ] Redeploy
- [ ] Run one real transaction on Starter with your own card
- [ ] Refund it to yourself
- [ ] Announce

---

## Known edge cases

- **Referral code case-sensitivity:** stored lowercase, signup query normalizes
- **Referee changing email later:** doesn't retroactively update `profiles.referred_by`
- **Webhook idempotency:** `referrals.status = 'pending'` guard prevents double-credit on duplicate delivery
