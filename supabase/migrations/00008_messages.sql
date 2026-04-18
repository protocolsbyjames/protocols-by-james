-- Direct messages between coach and client
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

-- Users can read messages they sent or received
create policy "Users can read own messages"
  on public.messages for select using (
    auth.uid() = sender_id or auth.uid() = receiver_id
  );

-- Users can send messages (insert where they are sender)
create policy "Users can send messages"
  on public.messages for insert with check (
    auth.uid() = sender_id
  );

-- Receivers can mark messages as read
create policy "Receivers can mark messages read"
  on public.messages for update using (
    auth.uid() = receiver_id
  ) with check (
    auth.uid() = receiver_id
  );

-- Index for fast lookups
create index messages_sender_idx on public.messages(sender_id, created_at desc);
create index messages_receiver_idx on public.messages(receiver_id, created_at desc);
create index messages_pair_idx on public.messages(
  least(sender_id, receiver_id),
  greatest(sender_id, receiver_id),
  created_at desc
);
