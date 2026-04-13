-- =================================================================
-- Seed coaching plans for James
-- =================================================================
-- Before running:
--   1) Run migration 00003_coaching_plans.sql first.
--   2) In Stripe Dashboard, create two recurring prices under a single
--      product ("Protocols by James Coaching") — one for Basic, one for
--      Pro. Copy each price ID (starts with "price_...") and paste into
--      the placeholders below.
--   3) Replace the JAMES_COACH_ID value with your own coach profile's
--      id. You can find it with:
--         select id, full_name, role from public.profiles where role = 'coach';
--      If there is no coach row for you yet, create one by signing up
--      as a coach (or run an UPDATE to flip your existing profile row's
--      role to 'coach').
-- =================================================================

-- Paste Stripe price IDs here:
-- price for Basic plan  →  REPLACE_ME_PRICE_BASIC
-- price for Pro plan    →  REPLACE_ME_PRICE_PRO

insert into public.coaching_plans
  (coach_id, name, description, features, price_cents, interval, stripe_price_id, sort_order)
values
  (
    'REPLACE_ME_JAMES_COACH_ID',
    'Basic',
    'Foundational coaching with structured check-ins.',
    '["Custom workout plan", "Custom meal plan", "Monthly check-ins", "Email support"]'::jsonb,
    9900,   -- $99 / month (display only; Stripe is source of truth)
    'month',
    'REPLACE_ME_PRICE_BASIC',
    1
  ),
  (
    'REPLACE_ME_JAMES_COACH_ID',
    'Pro',
    'Everything in Basic plus weekly feedback and priority messaging.',
    '["Everything in Basic", "Weekly check-ins with video review", "Priority messaging", "Quarterly plan revisions"]'::jsonb,
    19900,  -- $199 / month
    'month',
    'REPLACE_ME_PRICE_PRO',
    2
  );

-- Sanity check:
-- select name, price_cents, stripe_price_id, is_active
--   from public.coaching_plans
--   where coach_id = 'REPLACE_ME_JAMES_COACH_ID';
