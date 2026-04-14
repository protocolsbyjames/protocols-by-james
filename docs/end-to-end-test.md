# PBJ Fitness App — End-to-End Launch Test Script

Run this after completing `docs/stripe-go-live.md`. It exercises every paid path in the new 4-tier + VIP add-on lineup, plus the coach portal smoke test.

**Time:** ~60 min (more than the old 3-tier script — there are more flows now)
**Prereqs:**
- Stripe live mode activated (or test mode for first dry-run)
- All env vars set per `docs/stripe-go-live.md` step 3
- Webhook endpoint configured per playbook step 6
- Migrations `00003`, `00004` (and any newer) applied
- Seed `supabase/seed_james_plans.sql` updated to 4-tier structure and run

---

## Setup

Open four browser windows, all in **incognito**:

1. **Window A — your coach Gmail** (jamesquilter@gmail.com). Referrer.
2. **Window B — throwaway #1** (jamesquilter+sizehybrid@gmail.com). Will buy Shortcut to Size.
3. **Window C — throwaway #2** (jamesquilter+elite@gmail.com). Will buy Elite + VIP.
4. **Window D — Supabase + Stripe dashboards** in tabs. Watch data land.

Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC, any zip.

> **Always test in Stripe test mode first.** Only flip to live mode after every test below is green.

---

## Test 1: Coach baseline

Skip if your coach account already exists. Otherwise sign up via Window A, set `role = 'coach'` in `profiles`, and grab your referral code from Settings → Refer a friend.

Note your `profiles.id` — you'll use it as `<coach_id>` throughout.

---

## Test 2: Self-guided hybrid — Shortcut to Size ($39.99 + $14.99/mo)

The hybrid is the trickiest flow because Stripe Checkout has to charge both a one-time line item AND start a subscription in the same session.

In **Window B (sizehybrid email)**:

1. Visit `app.protocolsbyjames.com/signup?ref=<YOUR_REFERRAL_CODE>`
2. Sign up as Client, complete onboarding
3. Pricing → pick **Shortcut to Size**
4. On Stripe Checkout, confirm **two line items appear**:
   - "Shortcut to Size — Program access" $39.99 (one-time)
   - "Shortcut to Size — App access" $14.99/month
5. Confirm the **referral discount line shows -$20** (assumes referral applies to hybrids — see playbook §7 item 4)
6. Pay with `4242 4242 4242 4242`
7. Lands on dashboard → should see program content unlocked

**Verify in Stripe Dashboard:**
- New customer (sizehybrid email)
- One **payment intent** for the $39.99 program (succeeded)
- One **subscription** active at $14.99/mo
- Coach customer has **-$20.00** balance transaction (if referral applies)
- First invoice on the $14.99 sub shows the -$20 coupon (or the discount applied to the $39.99 line — depends on which line you attached the coupon to in `/api/checkout`)

**Verify in Supabase:**
- `profiles` row for sizehybrid: `referred_by = <coach_id>`, `referral_discount_applied = true`
- `subscriptions`: status `active`, product type that distinguishes "self-guided program" from "coaching" (column name TBD per app code change)
- One row in `program_purchases` (or equivalent) for the $39.99 one-time payment
- `referrals` row: `status = 'credited'`, `stripe_balance_txn_id` populated

If checkout fails or only one line item charges → stop. This is the #1 expected bug per playbook §7.

---

## Test 3: Self-guided hybrid — Shortcut to Shred

Repeat Test 2 with a fresh throwaway (`jamesquilter+shredhybrid@gmail.com`), this time picking **Shortcut to Shred**.

Goal is to confirm the second hybrid path doesn't accidentally reuse Size's price IDs. Only difference from Test 2 is product name and price IDs.

Quick verify: Stripe customer has Shred line items (not Size), Supabase shows the Shred SKU.

---

## Test 4: Performance Coaching ($69.99/mo)

In a fresh window (`jamesquilter+performance@gmail.com`):

1. Sign up with referral link
2. Pricing → **Performance Coaching**
3. Stripe Checkout: single $69.99/mo line item, -$20 referral discount → first invoice $49.99
4. Pay, land on dashboard

**Verify:**
- Stripe: subscription active at $69.99, coach has -$20 balance txn
- Supabase: `subscriptions.status = 'active'`, `price_cents = 6999`, type = coaching tier
- Referee: `referral_discount_applied = true`
- `referrals.status = 'credited'`

---

## Test 5: Elite Coaching ($129.99/mo) + VIP auto-unlock

In a fresh window (`jamesquilter+elite@gmail.com`):

1. Sign up with referral link
2. Pricing → **Elite Coaching**
3. Stripe Checkout: $129.99/mo line item + **$0 VIP Community line** (or VIP not shown but auto-granted in app)
4. -$20 referral discount → first invoice $109.99
5. Pay

**Verify in Stripe:**
- Either ONE subscription with two prices ($129.99 Elite + $0 VIP), OR Elite sub only and VIP entitlement granted in-app — depends on which approach the app code takes (decide in #2). Document the choice in `/api/checkout/route.ts`.

**Verify in Supabase:**
- `subscriptions` row for Elite, status active
- VIP entitlement: either a row in `subscription_addons` / `entitlements` table OR a `vip_unlocked_at` column on the Elite subscription. Implementation TBD.
- App: VIP community section visible in sidebar

**Verify in app:**
- Elite client sees VIP community area (not gated)
- Performance/Size/Shred clients do NOT see VIP

---

## Test 6: Add VIP mid-subscription (Performance → Performance + VIP)

This tests upgrading an existing sub by attaching the VIP add-on, without canceling the original.

In **Window from Test 4 (Performance customer)**:

1. Account → Add-ons → **Add VIP Community** ($19.99/mo)
2. Confirm the modal: "VIP Community will be added to your Performance subscription. You'll be charged $19.99 today, then on each renewal."
3. Pay

**Verify in Stripe:**
- The Performance subscription now has TWO line items: $69.99 Performance + $19.99 VIP
- A prorated invoice for partial-month VIP charge
- Customer balance unchanged

**Verify in Supabase:**
- VIP entitlement granted to this client (same shape as Test 5)
- No new `subscriptions` row — the existing Performance sub is updated

**Verify in app:**
- VIP community section now visible in sidebar for Performance client

---

## Test 7: Remove VIP add-on

In the same window:

1. Account → Manage subscription → **Remove VIP**
2. Confirm: "You'll keep VIP access until [end of period], then it won't renew."

**Verify in Stripe:**
- VIP line item marked `cancel_at_period_end = true` (not removed immediately — keep them whole through paid period)

**Verify in app:**
- VIP section still visible until end of billing period
- `entitlements` row has an `expires_at` set to period end

---

## Test 8: Referral credit accounting

Across all the tests above, you should have **5 referrals credited**: Size, Shred, Performance, Elite, and (depending on policy) maybe VIP.

In Window A (coach):
- Settings → Referrals → balance shows correct total
- Stripe coach customer balance shows the matching credit total

If you decided VIP add-ons don't trigger referral (per playbook §7 item 4), then Test 6 should NOT have created a new credit — verify only by checking balance didn't change after the Test 6 charge.

---

## Test 9: Coach portal smoke test

Switch back to **Window A**. The coach should see all 5 test clients in the dashboard.

For each client:
1. Click into client detail
2. Hit **Assign workout plan** → quick 1-day plan, save
3. Verify the client window can see the assigned plan (refresh)

For one client (pick the Performance one):
1. Switch to client window → submit a check-in (weight, energy, notes)
2. Switch back to coach window → Check-ins queue shows it as "Needs feedback"
3. Click in, leave feedback, save
4. Switch to client window → check-in shows coach feedback

**Verify in Supabase:**
- `workout_plans` rows: 5 (one per client)
- `check_ins` row: 1
- `coach_feedback` row: 1, tied to that check-in

---

## Test 10: Subscription cancel paths

For each subscription type, run cancel and verify webhook handling:

| Subscription | Expected on cancel |
|---|---|
| Shortcut to Size hybrid | One-time $39.99 stays charged; $14.99/mo sub cancels at period end; program content stays accessible until period end |
| Shortcut to Shred hybrid | Same as Size |
| Performance | Standard cancel-at-period-end; coaching access until period end |
| Elite | Standard cancel-at-period-end; coaching + VIP access until period end |
| Performance + VIP add-on | Cancel main sub → both lines cancel together at period end |

For each, verify `subscriptions.status` flips to `canceled` (or `cancel_at_period_end = true`) and the app paywall kicks in at the right time.

---

## Test 11: Cleanup

```sql
delete from profiles where email like 'jamesquilter+%@gmail.com';
```

Delete all test customers in Stripe dashboard (test mode only — never delete live customers). Reset coach credit balance if you want a clean slate before going live.

---

## Go-live checklist

- [ ] All tests above green in Stripe **test** mode
- [ ] Toggle Stripe **Test mode → Live mode**
- [ ] Re-create all 5 products + 7 prices + `REFERRAL20` coupon in live mode
- [ ] Update Vercel env vars with **live-mode** price IDs (8 of them — see playbook step 3)
- [ ] Re-add webhook endpoint in live mode, update `STRIPE_WEBHOOK_SECRET`
- [ ] Redeploy
- [ ] Run **one** real transaction on Shortcut to Size with your own card
- [ ] Refund it to yourself
- [ ] Run **one** real Performance subscription test, immediately cancel, refund partial
- [ ] Announce launch

---

## Known edge cases and gotchas

- **Hybrid checkout coupon attachment:** the -$20 coupon must attach to a specific line item in the Checkout Session. If it attaches to the one-time program line, the discount feels like "$20 off the program." If it attaches to the recurring line, it feels like "$20 off your first month of app access." Pick one consistently across Size and Shred — easiest to attach to the recurring line so behavior matches the coaching tiers.
- **Elite VIP grant:** if you model VIP as a separate $0 line item under the Elite sub, you can use Stripe entitlements directly. If you grant VIP via app-side logic, you have to remember to revoke it on Elite cancel. The line-item approach is more idempotent — recommended.
- **Hybrid renewal failure:** if a Size customer's $14.99 renewal fails, the $39.99 program purchase is unaffected. Make sure the app paywall only blocks the recurring app access, not the one-time program PDFs / videos.
- **Referral code case-sensitivity:** stored lowercase, signup query normalizes.
- **Webhook idempotency:** `referrals.status = 'pending'` guard prevents double-credit on duplicate delivery.
- **VIP add-on referral policy:** decide explicitly (playbook §7 item 4). The default in this script assumes VIP add-on does NOT trigger a new referral credit.
