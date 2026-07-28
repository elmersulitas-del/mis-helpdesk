create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  sender_type text not null check (sender_type in ('EMPLOYEE', 'MIS')),
  sender_name text not null,
  sender_email text,
  message text not null check (
    char_length(trim(message)) between 1 and 2000
  ),
  created_at timestamptz not null default now()
);

alter table public.ticket_messages enable row level security;

-- No anon policies are created. Conversation access is validated by
-- protected Next.js server routes, which use the server-only Supabase key.

create index if not exists ticket_messages_ticket_created_idx
  on public.ticket_messages(ticket_id, created_at);
