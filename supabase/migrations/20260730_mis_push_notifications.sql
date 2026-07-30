create table if not exists public.mis_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mis_push_subscriptions enable row level security;

-- No browser policies are created. The protected Next.js API uses the
-- Supabase secret key to register and deliver MIS subscriptions.
create index if not exists mis_push_subscriptions_updated_idx
  on public.mis_push_subscriptions(updated_at desc);
