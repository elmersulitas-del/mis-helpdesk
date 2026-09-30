alter table public.tickets
  add column if not exists source text not null default 'ONLINE' check (source in ('ONLINE', 'WALK_IN')),
  add column if not exists receipt_status text not null default 'NOT_SENT' check (receipt_status in ('NOT_SENT', 'SENDING', 'SENT', 'FAILED')),
  add column if not exists receipt_sent_at timestamptz;
