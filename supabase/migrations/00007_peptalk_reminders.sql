-- Peptalk reminder tracking columns.
--
-- Adds two timestamptz columns to peptalk_bookings that the marketing
-- site's /api/cron/peptalk-reminders route uses to drive idempotent
-- email reminders:
--
--   * reminder_24h_sent_at — filled the moment the 24h-before email is
--                            successfully delivered. Null = not yet sent.
--   * reminder_1h_sent_at  — same, but for the 1h-before email.
--
-- Partial indexes make the cron query cheap even as the table grows —
-- we only scan rows that still need a reminder.
--
-- Safe to re-run (idempotent).

alter table public.peptalk_bookings
  add column if not exists reminder_24h_sent_at timestamptz,
  add column if not exists reminder_1h_sent_at  timestamptz;

comment on column public.peptalk_bookings.reminder_24h_sent_at is
  '24-hour-before reminder email send timestamp. Null = not yet sent. Set by /api/cron/peptalk-reminders.';
comment on column public.peptalk_bookings.reminder_1h_sent_at is
  '1-hour-before reminder email send timestamp. Null = not yet sent. Set by /api/cron/peptalk-reminders.';

-- Partial index for the 24h cron sweep.
create index if not exists peptalk_bookings_pending_24h_idx
  on public.peptalk_bookings(scheduled_at)
  where reminder_24h_sent_at is null and status = 'confirmed';

-- Partial index for the 1h cron sweep.
create index if not exists peptalk_bookings_pending_1h_idx
  on public.peptalk_bookings(scheduled_at)
  where reminder_1h_sent_at is null and status = 'confirmed';
