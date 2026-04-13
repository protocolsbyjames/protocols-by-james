-- =================================================================
-- Seed coaching plans for James — 3 tiers
-- =================================================================
-- Before running:
--   1) Run migration 00003_coaching_plans.sql first.
--   2) In Stripe Dashboard, create ONE product ("Protocols by James
--      Coaching") with THREE recurring monthly prices:
--          $45.99 / mo
--          $69.99 / mo
--          $99.99 / mo
--      Copy each price ID (starts with "price_...") into the
--      placeholders below.
--   3) Replace REPLACE_ME_JAMES_COACH_ID with your own coach profile
--      id. Find it with:
--         select id, full_name, role from public.profiles where role='coach';
--      If no row exists yet, either sign up as a coach via the app or
--      flip your existing profile: update public.profiles
--         set role='coach' where id='<your-auth-user-id>';
--   4) Feel free to rename the tiers and edit the features/descriptions
--      to match what you actually sell.
-- =================================================================

insert into public.coaching_plans
  (coach_id, name, description, features, price_cents, interval, stripe_price_id, sort_order)
values
  (
    'REPLACE_ME_JAMES_COACH_ID',
    'Starter',
    'Foundational coaching to get you moving in the right direction.',
    '["Custom workout plan","Custom meal plan","Monthly check-in","Email support"]'::jsonb,
    4599,   -- $45.99 / month (display only; Stripe is source of truth)
    'month',
    'REPLACE_ME_PRICE_STARTER',
    1
  ),
  (
    'REPLACE_ME_JAMES_COACH_ID',
    'Pro',
    'Our most popular plan — more feedback, more accountability.',
    '["Everything in Starter","Bi-weekly check-ins with video review","Direct messaging","Plan revisions as you progress"]'::jsonb,
    6999,   -- $69.99 / month
    'month',
    'REPLACE_ME_PRICE_PRO',
    2
  ),
  (
    'REPLACE_ME_JAMES_COACH_ID',
    'Elite',
    'Full-service coaching with weekly touchpoints and priority support.',
    '["Everything in Pro","Weekly check-ins with video review","Priority 1:1 messaging","Quarterly strategy calls"]'::jsonb,
    9999,   -- $99.99 / month
    'month',
    'REPLACE_ME_PRICE_ELITE',
    3
  );

-- Sanity check:
-- select name, price_cents, stripe_price_id, sort_order, is_active
--   from public.coaching_plans
--   where coach_id = 'REPLACE_ME_JAMES_COACH_ID'
--   order by sort_order;
