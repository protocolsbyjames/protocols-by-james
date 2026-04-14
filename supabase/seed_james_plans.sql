-- =================================================================
-- Seed coaching plans for James — new 4-tier + VIP add-on lineup
-- =================================================================
-- Before running:
--   1) Run migrations 00001–00005. 00005 adds plan_type,
--      stripe_program_price_id, auto_include_addon_id, subscription_addons,
--      and program_purchases — this seed DEPENDS on those columns existing.
--
--   2) In Stripe Dashboard, create 5 products with 7 prices total:
--        Shortcut to Size       — $39.99 one-time + $14.99/mo
--        Shortcut to Shred      — $39.99 one-time + $14.99/mo
--        Performance Coaching   — $69.99/mo
--        Elite Coaching         — $129.99/mo
--        VIP Community Add-on   — $19.99/mo
--
--   3) Replace the REPLACE_ME_* tokens below. Token names match the
--      Vercel env var names exactly, so copy-paste from
--      Vercel Dashboard → Environment Variables → Reveal Value:
--
--        REPLACE_ME_STRIPE_PRICE_SIZE_ONETIME    (Size $39.99 one-time)
--        REPLACE_ME_STRIPE_PRICE_SIZE_MONTHLY    (Size $14.99/mo)
--        REPLACE_ME_STRIPE_PRICE_SHRED_ONETIME   (Shred $39.99 one-time)
--        REPLACE_ME_STRIPE_PRICE_SHRED_MONTHLY   (Shred $14.99/mo)
--        REPLACE_ME_STRIPE_PRICE_PERFORMANCE     (Performance $69.99/mo)
--        REPLACE_ME_STRIPE_PRICE_ELITE           (Elite $129.99/mo)
--        REPLACE_ME_STRIPE_PRICE_VIP_COMMUNITY   (VIP $19.99/mo)
--
--   4) Replace REPLACE_ME_COACH_ID with your coach profile id. Find it via:
--        select id, full_name, role from public.profiles where role='coach';
--      If no row exists yet, sign up as a coach first or flip an existing
--      profile: update public.profiles set role='coach' where id='<uuid>';
--
--   5) Idempotency: this script upserts on stripe_price_id (unique), so
--      re-running after fixing a token is safe. Existing plan rows will be
--      updated in place rather than duplicated.
-- =================================================================

-- ------------------------------------------------------------
-- Step 1 — Insert the VIP Community add-on first. We need its
-- id to wire up Elite's auto_include_addon_id in step 2.
-- ------------------------------------------------------------
insert into public.coaching_plans
  (coach_id, name, description, features, price_cents, interval,
   stripe_price_id, plan_type, sort_order)
values
  (
    'REPLACE_ME_COACH_ID',
    'VIP Community',
    'Private community access, member-only content, and monthly group calls.',
    '["Private community access","Member-only content drops","Monthly group coaching calls","Early access to new programs"]'::jsonb,
    1999,
    'month',
    'REPLACE_ME_STRIPE_PRICE_VIP_COMMUNITY',
    'addon',
    99
  )
on conflict (stripe_price_id) do update set
  name = excluded.name,
  description = excluded.description,
  features = excluded.features,
  price_cents = excluded.price_cents,
  plan_type = excluded.plan_type,
  sort_order = excluded.sort_order;

-- ------------------------------------------------------------
-- Step 2 — Main product lineup. Elite references the VIP add-on id
-- via a subquery so it auto-includes VIP at checkout.
-- ------------------------------------------------------------
insert into public.coaching_plans
  (coach_id, name, description, features, price_cents, interval,
   stripe_price_id, stripe_program_price_id, plan_type,
   auto_include_addon_id, sort_order)
values
  -- Self-guided hybrid: Shortcut to Size
  (
    'REPLACE_ME_COACH_ID',
    'Shortcut to Size',
    'Mass-building hypertrophy program. Structured training, app-delivered workouts, progress tracking.',
    '["8-week mass-building program","App-delivered workouts","Progress tracking","Exercise library with video form cues"]'::jsonb,
    1499,
    'month',
    'REPLACE_ME_STRIPE_PRICE_SIZE_MONTHLY',
    'REPLACE_ME_STRIPE_PRICE_SIZE_ONETIME',
    'self_guided',
    null,
    1
  ),
  -- Self-guided hybrid: Shortcut to Shred
  (
    'REPLACE_ME_COACH_ID',
    'Shortcut to Shred',
    'Cutting program. Fat-loss training split, nutrition framework, app-delivered workouts.',
    '["6-week cutting program","Nutrition framework","App-delivered workouts","Progress tracking"]'::jsonb,
    1499,
    'month',
    'REPLACE_ME_STRIPE_PRICE_SHRED_MONTHLY',
    'REPLACE_ME_STRIPE_PRICE_SHRED_ONETIME',
    'self_guided',
    null,
    2
  ),
  -- 1:1 Coaching: Performance
  (
    'REPLACE_ME_COACH_ID',
    'Performance Coaching',
    'Direct 1:1 coaching with James. Custom programming, check-ins, and feedback.',
    '["Custom workout plan","Custom meal plan","Bi-weekly check-ins with video review","Direct messaging","Plan revisions as you progress"]'::jsonb,
    6999,
    'month',
    'REPLACE_ME_STRIPE_PRICE_PERFORMANCE',
    null,
    'coaching',
    null,
    3
  ),
  -- 1:1 Coaching: Elite (auto-includes VIP via subquery below)
  (
    'REPLACE_ME_COACH_ID',
    'Elite Coaching',
    'Full-service coaching with weekly touchpoints, priority support, and VIP community access.',
    '["Everything in Performance","Weekly check-ins with video review","Priority 1:1 messaging","Quarterly strategy calls"]'::jsonb,
    12999,
    'month',
    'REPLACE_ME_STRIPE_PRICE_ELITE',
    null,
    'coaching',
    (select id from public.coaching_plans
       where stripe_price_id = 'REPLACE_ME_STRIPE_PRICE_VIP_COMMUNITY'),
    4
  )
on conflict (stripe_price_id) do update set
  name = excluded.name,
  description = excluded.description,
  features = excluded.features,
  price_cents = excluded.price_cents,
  interval = excluded.interval,
  stripe_program_price_id = excluded.stripe_program_price_id,
  plan_type = excluded.plan_type,
  auto_include_addon_id = excluded.auto_include_addon_id,
  sort_order = excluded.sort_order;

-- ------------------------------------------------------------
-- Sanity check:
-- ------------------------------------------------------------
-- select name, plan_type, price_cents, stripe_price_id, stripe_program_price_id,
--        auto_include_addon_id, sort_order, is_active
--   from public.coaching_plans
--   where coach_id = 'REPLACE_ME_COACH_ID'
--   order by sort_order;
