-- Add is_active column to workout_plans and meal_plans
-- This field indicates which plan is currently assigned to a client (vs. a template)

alter table public.workout_plans
  add column if not exists is_active boolean not null default false;

alter table public.meal_plans
  add column if not exists is_active boolean not null default false;

-- Add missing columns to invites table for tracking acceptance
alter table public.invites
  add column if not exists accepted_by uuid references public.profiles(id),
  add column if not exists accepted_at timestamptz;
