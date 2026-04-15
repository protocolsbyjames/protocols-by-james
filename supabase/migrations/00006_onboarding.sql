-- Protocols By James — Client onboarding flow
-- Run after 00005. Adds the tables needed for the marketing-site → app handoff:
--   * profiles.onboarding_status               (tracks where the client is in the flow)
--   * profiles.applied_at / applied_age / applied_sex / applied_goal (pre-payment apply form data)
--   * client_agreements table                  (signed consulting & coaching agreement; legal audit trail)
--   * client_intake_submissions table          (in-app post-agreement questionnaire answers)
--   * peptalk_bookings table                   (free 20-min consultation bookings — ALSO gated by agreement)
--
-- Flow overview:
--   Coaching client:  /apply → pay → sign agreement → in-app questionnaire → waiting_for_plan → active
--   Peptalk booker:   /peptalk/book → pick slot → sign agreement → confirmed (gcal event created)
--
-- Both flows share the same client_agreements table. A row can reference EITHER a profile (paid client) OR
-- a peptalk booking (free consult, may not have a full user account yet).

-- ============================================================
-- 1. Extend profiles with onboarding state + pre-payment intake
-- ============================================================
alter table public.profiles
  add column if not exists onboarding_status text not null default 'not_started'
    check (onboarding_status in (
      'not_started',       -- default for coaches / clients who haven't started
      'applied',           -- filled /apply form on marketing site, not yet paid
      'paid',              -- Stripe checkout.session.completed fired
      'agreement_signed',  -- signed the consulting agreement
      'questionnaire_done',-- finished the in-app questionnaire; waiting for James
      'active'             -- James has built their plan; they're training
    )),
  add column if not exists applied_at timestamptz,
  add column if not exists applied_age int check (applied_age is null or (applied_age between 13 and 120)),
  add column if not exists applied_sex text check (applied_sex is null or applied_sex in ('male', 'female', 'other', 'prefer_not_to_say')),
  add column if not exists applied_goal text,
  add column if not exists applied_phone text;

comment on column public.profiles.onboarding_status is
  'Tracks the client through the marketing-site → app handoff. Coach portal uses this to surface "waiting on me" state.';
comment on column public.profiles.applied_age is
  'Age given on the pre-payment /apply form. Stored separately from any later questionnaire data so we keep the original application intact.';

create index if not exists profiles_onboarding_status_idx
  on public.profiles(onboarding_status)
  where role = 'client';

-- ============================================================
-- 2. client_agreements — signed consulting & coaching agreement
--    This is the LEGAL AUDIT TRAIL. Never mutate a row after insert.
--    Includes agreement_text_snapshot so if the contract is updated later
--    we can still prove exactly what each client signed.
-- ============================================================
create table if not exists public.client_agreements (
  id uuid primary key default gen_random_uuid(),
  -- ONE of profile_id or peptalk_booking_id will be set.
  -- profile_id = paid coaching client; peptalk_booking_id = free-consult signer.
  profile_id uuid references public.profiles(id) on delete set null,
  peptalk_booking_id uuid,                          -- FK added after peptalk_bookings below
  agreement_version text not null,                  -- e.g. '2026-01-28'
  agreement_text_snapshot text not null,            -- full rendered text at time of signing
  typed_name text not null,                         -- the legal name the client typed
  signed_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint client_agreements_subject_check
    check ((profile_id is not null) or (peptalk_booking_id is not null))
);

comment on table public.client_agreements is
  'Legal audit trail of signed Consulting & Coaching Agreements. Rows are append-only in spirit — never update or delete once signed.';
comment on column public.client_agreements.agreement_text_snapshot is
  'Full agreement text as it was rendered to the signer at the moment they signed. Preserves the exact legal content even if the template is updated later.';

create index if not exists client_agreements_profile_id_idx
  on public.client_agreements(profile_id);
create index if not exists client_agreements_peptalk_booking_id_idx
  on public.client_agreements(peptalk_booking_id);

alter table public.client_agreements enable row level security;

create policy "Clients read their own agreements"
  on public.client_agreements for select
  using (profile_id = auth.uid());

create policy "Coaches read their clients' agreements"
  on public.client_agreements for select
  using (
    profile_id in (
      select id from public.profiles where coach_id = auth.uid()
    )
  );

-- No insert/update/delete policies — only the service role writes here.
-- The marketing site's server actions use the service role key.

-- ============================================================
-- 3. client_intake_submissions — the deep in-app questionnaire
--    Filled AFTER agreement is signed. Free-form answers go in jsonb
--    so we can evolve the question set without migrations.
-- ============================================================
create table if not exists public.client_intake_submissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  submitted_at timestamptz not null default now(),

  -- Commonly-queried fields promoted to columns for coach-portal filtering
  height_cm numeric(5,2),
  current_weight_kg numeric(5,2),
  goal_weight_kg numeric(5,2),
  training_experience text check (training_experience is null or training_experience in
    ('beginner', 'intermediate', 'advanced', 'competitor')),
  medical_clearance boolean,
  clearance_doctor_name text,

  -- Everything else — training history, medications, supplements, allergies,
  -- sleep, stress, nutrition style, typical day of eating, free-text responses,
  -- uploaded photo paths — lives in answers so we can iterate without migrations.
  answers jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.client_intake_submissions is
  'In-app questionnaire filled after the agreement is signed. The coach uses this to build the client''s custom plan.';
comment on column public.client_intake_submissions.answers is
  'JSONB blob of questionnaire responses. Schema intentionally loose so we can add/remove questions without migrations.';

create index if not exists client_intake_profile_id_idx
  on public.client_intake_submissions(profile_id);
create unique index if not exists client_intake_one_per_client_idx
  on public.client_intake_submissions(profile_id);

alter table public.client_intake_submissions enable row level security;

create policy "Clients read their own intake"
  on public.client_intake_submissions for select
  using (profile_id = auth.uid());

create policy "Clients insert their own intake"
  on public.client_intake_submissions for insert
  with check (profile_id = auth.uid());

create policy "Clients update their own intake"
  on public.client_intake_submissions for update
  using (profile_id = auth.uid());

create policy "Coaches read their clients' intake"
  on public.client_intake_submissions for select
  using (
    profile_id in (
      select id from public.profiles where coach_id = auth.uid()
    )
  );

-- ============================================================
-- 4. peptalk_bookings — free 20-min consultation bookings
--    Peptalkers may not have a profile yet (free consult = lead), so this
--    table stands alone with its own contact info. If they later convert
--    to a paid client, we can link via email match.
-- ============================================================
create table if not exists public.peptalk_bookings (
  id uuid primary key default gen_random_uuid(),
  -- Nullable — most peptalks are cold leads who don't have an app account yet
  profile_id uuid references public.profiles(id) on delete set null,

  -- Contact info (always required, captured on the booking form)
  full_name text not null,
  email text not null,
  phone text not null,
  topic text not null,

  -- Scheduled time (user picks from coach's live gcal availability)
  scheduled_at timestamptz not null,
  duration_minutes int not null default 20,
  timezone text not null default 'America/Los_Angeles',

  -- gcal integration state
  gcal_event_id text,        -- populated after we successfully create the event
  meet_link text,             -- the Google Meet link baked into the gcal event

  -- Lifecycle
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'canceled', 'completed', 'no_show')),

  -- Metadata
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.peptalk_bookings is
  'Free 20-minute consultation bookings. Decoupled from profiles because most peptalkers are cold leads without an account.';
comment on column public.peptalk_bookings.scheduled_at is
  'The time the peptalk will take place, stored in UTC. The user-facing calendar shows this in their local tz (captured in timezone column for reference).';

create index if not exists peptalk_bookings_scheduled_at_idx
  on public.peptalk_bookings(scheduled_at);
create index if not exists peptalk_bookings_status_idx
  on public.peptalk_bookings(status);
create index if not exists peptalk_bookings_email_idx
  on public.peptalk_bookings(email);

alter table public.peptalk_bookings enable row level security;

-- Peptalk bookings are private between the lead and James. No client-side
-- read access from the marketing site — writes happen via service role.
-- Coaches (i.e. James) can read all peptalk bookings.
create policy "Coaches read all peptalk bookings"
  on public.peptalk_bookings for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'coach'
    )
  );

-- Now add the deferred FK from client_agreements → peptalk_bookings
alter table public.client_agreements
  add constraint client_agreements_peptalk_booking_id_fkey
    foreign key (peptalk_booking_id) references public.peptalk_bookings(id) on delete set null;

-- ============================================================
-- 5. Triggers: keep updated_at fresh on rows that get updated
--    Uses public.handle_updated_at() defined in 00001.
-- ============================================================

drop trigger if exists client_intake_submissions_updated_at on public.client_intake_submissions;
create trigger client_intake_submissions_updated_at
  before update on public.client_intake_submissions
  for each row execute function public.handle_updated_at();

drop trigger if exists peptalk_bookings_updated_at on public.peptalk_bookings;
create trigger peptalk_bookings_updated_at
  before update on public.peptalk_bookings
  for each row execute function public.handle_updated_at();
