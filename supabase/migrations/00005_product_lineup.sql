-- Protocols By James — Product lineup restructure (4 tiers + VIP add-on)
-- Run after 00004. Adds:
--   * coaching_plans.plan_type        (self_guided | coaching | addon)
--   * coaching_plans.stripe_program_price_id  (one-time half of hybrid plans)
--   * coaching_plans.auto_include_addon_id    (Elite auto-grants VIP)
--   * subscription_addons table       (VIP attached to a coaching sub)
--   * program_purchases table         (one-time $39.99 program access charge)
--   * subscriptions.stripe_customer_id (column the webhook was already writing)
--   * current_user_has_vip_access()   (helper for the VIP community gate)

-- ============================================================
-- 1. Extend coaching_plans
-- ============================================================
alter table public.coaching_plans
  add column if not exists plan_type text not null default 'coaching'
    check (plan_type in ('self_guided', 'coaching', 'addon')),
  add column if not exists stripe_program_price_id text unique,
  add column if not exists auto_include_addon_id uuid references public.coaching_plans(id);

comment on column public.coaching_plans.plan_type is
  'self_guided = hybrid one-time + recurring program (Size/Shred). coaching = pure monthly subscription (Performance/Elite). addon = attachable add-on (VIP).';
comment on column public.coaching_plans.stripe_program_price_id is
  'For self_guided plans only: the Stripe price ID for the one-time program access charge. NULL for coaching and addon plans.';
comment on column public.coaching_plans.auto_include_addon_id is
  'For coaching plans that auto-bundle an add-on (e.g. Elite auto-includes VIP Community). NULL if no auto-include.';

-- ============================================================
-- 2. Backfill plan_type for existing rows (safety for partial deploys)
-- ============================================================
-- Existing plans from the old 3-tier seed (Starter/Pro/Elite) are all "coaching".
-- If the seed hasn't been run yet, this is a no-op.
update public.coaching_plans set plan_type = 'coaching' where plan_type is null;

-- ============================================================
-- 3. subscription_addons: an add-on (VIP) attached to a coaching sub
-- ============================================================
create table if not exists public.subscription_addons (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  addon_plan_id uuid not null references public.coaching_plans(id),
  stripe_subscription_item_id text unique,
  stripe_price_id text not null,
  status text not null default 'active'
    check (status in ('active', 'canceled', 'past_due', 'paused')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscription_addons_subscription_id_idx
  on public.subscription_addons(subscription_id);

create unique index if not exists subscription_addons_sub_addon_unique
  on public.subscription_addons(subscription_id, addon_plan_id);

alter table public.subscription_addons enable row level security;

create policy "Clients read their own addons"
  on public.subscription_addons for select
  using (
    exists (
      select 1 from public.subscriptions s
      where s.id = subscription_id and s.client_id = auth.uid()
    )
  );

create policy "Coaches read addons for their clients"
  on public.subscription_addons for select
  using (
    exists (
      select 1 from public.subscriptions s
      where s.id = subscription_id and s.coach_id = auth.uid()
    )
  );

create policy "System manages addons"
  on public.subscription_addons for all using (true);

create trigger subscription_addons_updated_at
  before update on public.subscription_addons
  for each row execute function public.handle_updated_at();

-- ============================================================
-- 4. program_purchases: one-time $39.99 hybrid program charges
-- ============================================================
create table if not exists public.program_purchases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.coaching_plans(id),
  stripe_payment_intent_id text unique,
  stripe_checkout_session_id text,
  stripe_invoice_id text,
  amount_cents integer not null,
  currency text not null default 'usd',
  created_at timestamptz not null default now()
);

create index if not exists program_purchases_client_id_idx
  on public.program_purchases(client_id);
create index if not exists program_purchases_coach_id_idx
  on public.program_purchases(coach_id);

alter table public.program_purchases enable row level security;

create policy "Clients read their own program purchases"
  on public.program_purchases for select
  using (auth.uid() = client_id);

create policy "Coaches read their clients' program purchases"
  on public.program_purchases for select
  using (auth.uid() = coach_id);

create policy "System manages program purchases"
  on public.program_purchases for all using (true);

-- ============================================================
-- 5. subscriptions.stripe_customer_id (webhook was already writing this)
-- ============================================================
alter table public.subscriptions
  add column if not exists stripe_customer_id text;

create index if not exists subscriptions_stripe_customer_id_idx
  on public.subscriptions(stripe_customer_id);

-- ============================================================
-- 6. Helper: does the current user have VIP access?
-- Single source of truth: an active row in subscription_addons
-- whose parent subscription is also active/trialing.
-- ============================================================
create or replace function public.current_user_has_vip_access()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscription_addons sa
    join public.subscriptions s on s.id = sa.subscription_id
    join public.coaching_plans cp on cp.id = sa.addon_plan_id
    where s.client_id = auth.uid()
      and s.status in ('active', 'trialing')
      and sa.status = 'active'
      and cp.plan_type = 'addon'
  );
$$;

grant execute on function public.current_user_has_vip_access() to authenticated;
