-- Protocols By James — Coaching plans (per-coach pricing tiers)
-- Run after 00002. Adds:
--   * coaching_plans table (one row per tier per coach)
--   * RLS so coaches manage their own plans; everyone can read active ones
--   * A helper view the onboarding page uses to list "published" plans

-- ============================================================
-- COACHING_PLANS
-- ============================================================
create table public.coaching_plans (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,                          -- "Basic", "Pro", etc.
  description text,
  features jsonb not null default '[]'::jsonb, -- ["Weekly check-ins", "Custom meal plan", ...]
  price_cents integer not null,                -- display price; source of truth is Stripe
  currency text not null default 'usd',
  interval text not null default 'month' check (interval in ('month', 'year')),
  stripe_price_id text not null unique,        -- created in Stripe dashboard, pasted in here
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index coaching_plans_coach_id_idx on public.coaching_plans(coach_id);
create index coaching_plans_active_idx on public.coaching_plans(coach_id, is_active);

alter table public.coaching_plans enable row level security;

-- Coaches fully manage their own plans
create policy "Coaches manage their plans"
  on public.coaching_plans for all using (auth.uid() = coach_id);

-- Any authenticated user (i.e. a signed-up client during onboarding) can see active plans
create policy "Authenticated users can read active plans"
  on public.coaching_plans for select
  to authenticated
  using (is_active = true);

create trigger coaching_plans_updated_at before update on public.coaching_plans
  for each row execute function public.handle_updated_at();

-- ============================================================
-- Fix subscriptions schema: webhook writes `price_id` but column
-- is `stripe_price_id`. Rename for clarity + match webhook payload.
-- (Safe no-op if already renamed.)
-- ============================================================
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'stripe_price_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'price_id'
  ) then
    alter table public.subscriptions rename column stripe_price_id to price_id;
  end if;
end $$;

-- Widen status check to include every Stripe subscription status the webhook might emit
alter table public.subscriptions
  drop constraint if exists subscriptions_status_check;

alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in (
    'active', 'inactive', 'past_due', 'canceled',
    'trialing', 'incomplete', 'incomplete_expired', 'unpaid', 'paused'
  ));

-- ============================================================
-- Helper: look up the active subscription for the current user.
-- Used by the dashboard layout paywall gate.
-- ============================================================
create or replace function public.current_user_has_active_subscription()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions
    where client_id = auth.uid()
      and status in ('active', 'trialing')
  );
$$;

grant execute on function public.current_user_has_active_subscription() to authenticated;
