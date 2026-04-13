-- Protocols By James — Referral program
-- Adds:
--   * profiles.referral_code (auto-generated, unique per user)
--   * profiles.referred_by (who referred them; set once at signup)
--   * profiles.referral_discount_applied (so the referee discount only
--     fires on their first paid checkout, not every checkout)
--   * referrals table (one row per successful referral; source of truth
--     for who earned credit and when)
--   * handle_new_user trigger updated to capture ?ref= codes from
--     signup metadata

-- ============================================================
-- PROFILES: referral columns
-- ============================================================

-- Short, shareable slug. First ten hex chars of a fresh uuid is plenty
-- of entropy (16^10 ≈ 1T combinations) for a coaching business.
alter table public.profiles
  add column if not exists referral_code text unique
    default lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

alter table public.profiles
  add column if not exists referred_by uuid references public.profiles(id)
    on delete set null;

alter table public.profiles
  add column if not exists referral_discount_applied boolean not null default false;

-- Backfill codes for any profiles created before this migration.
update public.profiles
  set referral_code = lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  where referral_code is null;

-- Make the column non-null now that every row has one.
alter table public.profiles
  alter column referral_code set not null;

create index if not exists profiles_referred_by_idx
  on public.profiles(referred_by);

-- ============================================================
-- REFERRALS: audit trail of who credited whom and when
-- ============================================================
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referee_id uuid not null unique references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'credited', 'void')),
  credit_cents integer not null default 2000,  -- $20.00
  stripe_balance_txn_id text,                   -- Stripe balance transaction id after crediting
  created_at timestamptz not null default now(),
  credited_at timestamptz
);

create index if not exists referrals_referrer_id_idx
  on public.referrals(referrer_id);

alter table public.referrals enable row level security;

create policy "Users can read their own referrals (as referrer)"
  on public.referrals for select
  using (auth.uid() = referrer_id);

create policy "Users can read their own referrals (as referee)"
  on public.referrals for select
  using (auth.uid() = referee_id);

-- ============================================================
-- TRIGGER: handle_new_user — also capture referral_code metadata
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  referrer_profile_id uuid;
  submitted_referral_code text;
begin
  submitted_referral_code := lower(
    coalesce(new.raw_user_meta_data->>'referral_code', '')
  );

  if submitted_referral_code <> '' then
    select id into referrer_profile_id
      from public.profiles
      where lower(referral_code) = submitted_referral_code
      limit 1;
  end if;

  insert into public.profiles (id, email, full_name, role, referred_by)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'client'),
    referrer_profile_id
  )
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, public.profiles.full_name),
        role = coalesce(excluded.role, public.profiles.role),
        referred_by = coalesce(public.profiles.referred_by, excluded.referred_by);

  -- Record a pending referral if we captured a referrer (and one isn't
  -- already on file for this referee).
  if referrer_profile_id is not null and referrer_profile_id <> new.id then
    insert into public.referrals (referrer_id, referee_id)
    values (referrer_profile_id, new.id)
    on conflict (referee_id) do nothing;
  end if;

  return new;
end;
$$;
