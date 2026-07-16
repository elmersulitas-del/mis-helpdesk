create extension if not exists pgcrypto;

create type ticket_priority as enum ('LOW','MEDIUM','HIGH','URGENT');
create type ticket_status as enum ('PENDING','ACCEPTED','IN_PROGRESS','RESOLVED','CANCELLED');

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text unique not null,
  public_token text unique not null,
  reporter_name text not null,
  reporter_email text,
  contact_number text,
  department text not null,
  location text not null,
  category text not null,
  subject text not null,
  description text not null,
  priority ticket_priority not null default 'MEDIUM',
  status ticket_status not null default 'PENDING',
  assigned_to text,
  resolution_notes text,
  accepted_at timestamptz,
  started_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_updates (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  old_status ticket_status,
  new_status ticket_status not null,
  remarks text,
  created_at timestamptz not null default now()
);

alter table public.tickets enable row level security;
alter table public.ticket_updates enable row level security;
-- No anon policies are intentionally created. All access goes through protected Next.js server routes using SUPABASE_SECRET_KEY.

create index if not exists tickets_status_created_idx on public.tickets(status, created_at desc);
create index if not exists tickets_public_token_idx on public.tickets(public_token);
