-- Protocols By James — Initial Schema
-- Run this in Supabase SQL Editor or via supabase db push

-- ============================================================
-- PROFILES
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('coach', 'client')),
  coach_id uuid references public.profiles(id),
  full_name text not null,
  email text not null,
  avatar_url text,
  bio text,
  stripe_customer_id text,
  stripe_account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Coaches can read their clients"
  on public.profiles for select using (
    auth.uid() = coach_id or auth.uid() = id
  );

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- ============================================================
-- INVITES
-- ============================================================
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  token text not null unique default gen_random_uuid()::text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  created_at timestamptz not null default now()
);

alter table public.invites enable row level security;

create policy "Coaches can manage their invites"
  on public.invites for all using (auth.uid() = coach_id);

create policy "Anyone can read invite by token"
  on public.invites for select using (true);

-- ============================================================
-- WORKOUT PLANS
-- ============================================================
create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid references public.profiles(id) on delete set null,
  name text not null,
  description text,
  weeks integer not null default 4,
  days_per_week integer not null default 5,
  is_template boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workout_plans enable row level security;

create policy "Coaches can manage their workout plans"
  on public.workout_plans for all using (auth.uid() = coach_id);

create policy "Clients can read their assigned plans"
  on public.workout_plans for select using (auth.uid() = client_id);

-- ============================================================
-- WORKOUT DAYS
-- ============================================================
create table public.workout_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans(id) on delete cascade,
  day_number integer not null,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.workout_days enable row level security;

create policy "Coaches can manage workout days"
  on public.workout_days for all using (
    exists (
      select 1 from public.workout_plans
      where id = workout_days.plan_id and coach_id = auth.uid()
    )
  );

create policy "Clients can read their workout days"
  on public.workout_days for select using (
    exists (
      select 1 from public.workout_plans
      where id = workout_days.plan_id and client_id = auth.uid()
    )
  );

-- ============================================================
-- EXERCISES
-- ============================================================
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.workout_days(id) on delete cascade,
  name text not null,
  sets integer not null default 3,
  reps text not null default '10',
  rest_seconds integer not null default 60,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.exercises enable row level security;

create policy "Coaches can manage exercises"
  on public.exercises for all using (
    exists (
      select 1 from public.workout_days wd
      join public.workout_plans wp on wp.id = wd.plan_id
      where wd.id = exercises.day_id and wp.coach_id = auth.uid()
    )
  );

create policy "Clients can read their exercises"
  on public.exercises for select using (
    exists (
      select 1 from public.workout_days wd
      join public.workout_plans wp on wp.id = wd.plan_id
      where wd.id = exercises.day_id and wp.client_id = auth.uid()
    )
  );

-- ============================================================
-- EXERCISE COMPLETIONS (client marks exercises done)
-- ============================================================
create table public.exercise_completions (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (exercise_id, client_id, completed_at::date)
);

alter table public.exercise_completions enable row level security;

create policy "Clients can manage their completions"
  on public.exercise_completions for all using (auth.uid() = client_id);

create policy "Coaches can read client completions"
  on public.exercise_completions for select using (
    exists (
      select 1 from public.profiles
      where id = exercise_completions.client_id and coach_id = auth.uid()
    )
  );

-- ============================================================
-- MEAL PLANS
-- ============================================================
create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid references public.profiles(id) on delete set null,
  name text not null,
  description text,
  is_template boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meal_plans enable row level security;

create policy "Coaches can manage their meal plans"
  on public.meal_plans for all using (auth.uid() = coach_id);

create policy "Clients can read their assigned meal plans"
  on public.meal_plans for select using (auth.uid() = client_id);

-- ============================================================
-- MEALS
-- ============================================================
create table public.meals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.meal_plans(id) on delete cascade,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  name text not null,
  description text,
  calories integer,
  protein_g integer,
  carbs_g integer,
  fat_g integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.meals enable row level security;

create policy "Coaches can manage meals"
  on public.meals for all using (
    exists (
      select 1 from public.meal_plans
      where id = meals.plan_id and coach_id = auth.uid()
    )
  );

create policy "Clients can read their meals"
  on public.meals for select using (
    exists (
      select 1 from public.meal_plans
      where id = meals.plan_id and client_id = auth.uid()
    )
  );

-- ============================================================
-- CHECK-INS
-- ============================================================
create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  week_of date not null,
  weight_lbs numeric(5,1),
  measurements jsonb default '{}',
  energy_level integer check (energy_level between 1 and 5),
  adherence_rating integer check (adherence_rating between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.check_ins enable row level security;

create policy "Clients can manage their check-ins"
  on public.check_ins for all using (auth.uid() = client_id);

create policy "Coaches can read their clients check-ins"
  on public.check_ins for select using (
    exists (
      select 1 from public.profiles
      where id = check_ins.client_id and coach_id = auth.uid()
    )
  );

-- ============================================================
-- CHECK-IN PHOTOS
-- ============================================================
create table public.check_in_photos (
  id uuid primary key default gen_random_uuid(),
  check_in_id uuid not null references public.check_ins(id) on delete cascade,
  photo_url text not null,
  pose_type text not null check (pose_type in ('front', 'side', 'back')),
  created_at timestamptz not null default now()
);

alter table public.check_in_photos enable row level security;

create policy "Clients can manage their photos"
  on public.check_in_photos for all using (
    exists (
      select 1 from public.check_ins
      where id = check_in_photos.check_in_id and client_id = auth.uid()
    )
  );

create policy "Coaches can view client photos"
  on public.check_in_photos for select using (
    exists (
      select 1 from public.check_ins ci
      join public.profiles p on p.id = ci.client_id
      where ci.id = check_in_photos.check_in_id and p.coach_id = auth.uid()
    )
  );

-- ============================================================
-- COACH FEEDBACK
-- ============================================================
create table public.coach_feedback (
  id uuid primary key default gen_random_uuid(),
  check_in_id uuid not null references public.check_ins(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coach_feedback enable row level security;

create policy "Coaches can manage their feedback"
  on public.coach_feedback for all using (auth.uid() = coach_id);

create policy "Clients can read feedback on their check-ins"
  on public.coach_feedback for select using (
    exists (
      select 1 from public.check_ins
      where id = coach_feedback.check_in_id and client_id = auth.uid()
    )
  );

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text not null default 'inactive' check (status in ('active', 'inactive', 'past_due', 'canceled')),
  price_cents integer not null default 0,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "Coaches can read their subscriptions"
  on public.subscriptions for select using (auth.uid() = coach_id);

create policy "Clients can read their own subscriptions"
  on public.subscriptions for select using (auth.uid() = client_id);

create policy "System can manage subscriptions"
  on public.subscriptions for all using (true);

-- ============================================================
-- HELPER: auto-update updated_at
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger workout_plans_updated_at before update on public.workout_plans
  for each row execute function public.handle_updated_at();

create trigger meal_plans_updated_at before update on public.meal_plans
  for each row execute function public.handle_updated_at();

create trigger check_ins_updated_at before update on public.check_ins
  for each row execute function public.handle_updated_at();

create trigger coach_feedback_updated_at before update on public.coach_feedback
  for each row execute function public.handle_updated_at();

create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.handle_updated_at();

-- ============================================================
-- STORAGE: progress photos bucket
-- ============================================================
insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false);

create policy "Clients can upload their photos"
  on storage.objects for insert with check (
    bucket_id = 'progress-photos' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can view authorized photos"
  on storage.objects for select using (
    bucket_id = 'progress-photos' and (
      auth.uid()::text = (storage.foldername(name))[1]
      or exists (
        select 1 from public.profiles
        where id::text = (storage.foldername(name))[1] and coach_id = auth.uid()
      )
    )
  );
