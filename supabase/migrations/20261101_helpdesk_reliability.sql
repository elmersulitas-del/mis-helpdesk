begin;

alter table public.ticket_updates add column if not exists actor text;
alter table public.mis_push_subscriptions
  add column if not exists session_key text,
  add column if not exists expires_at timestamptz;
-- Old subscriptions have no authenticated session lease and are intentionally inactive.

create table if not exists public.ticket_email_jobs (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  kind text not null check (kind in ('ACKNOWLEDGEMENT','RESOLUTION')),
  payload jsonb not null,
  message_id text not null unique,
  subject text not null,
  parent_message_id text,
  state text not null default 'QUEUED' check (state in ('QUEUED','SENDING','SENT','REVIEW')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  claim_token uuid,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique(ticket_id,kind)
);
alter table public.ticket_email_jobs enable row level security;
create index if not exists ticket_email_jobs_queue_idx on public.ticket_email_jobs(state,available_at);
create index if not exists tickets_email_created_idx on public.tickets(reporter_email,created_at desc,id desc);
create index if not exists tickets_updated_idx on public.tickets(updated_at,id);

create or replace function public.queue_ticket_email() returns trigger
language plpgsql security definer set search_path = '' as $$
declare original public.ticket_email_jobs; title text;
begin
  if new.reporter_email is null then return new; end if;
  title := case when new.source = 'WALK_IN' then 'MIS assistance receipt' else 'MIS support request received' end || ' — ' || new.ticket_number;
  if TG_OP = 'INSERT' then
    insert into public.ticket_email_jobs(ticket_id,kind,payload,message_id,subject)
    values(new.id,'ACKNOWLEDGEMENT',to_jsonb(new),'<ack.' || new.id || '@mis-helpdesk.local>',title)
    on conflict(ticket_id,kind) do nothing;
  elsif new.status = 'RESOLVED' and old.status <> 'RESOLVED' and new.source <> 'WALK_IN' then
    -- Legacy SENT/SENDING receipts have no recoverable Message-ID: do not invent a parent.
    if new.receipt_status in ('NOT_SENT','FAILED') then
      insert into public.ticket_email_jobs(ticket_id,kind,payload,message_id,subject)
      values(new.id,'ACKNOWLEDGEMENT',to_jsonb(old),'<ack.' || new.id || '@mis-helpdesk.local>',title)
      on conflict(ticket_id,kind) do nothing;
    end if;
    select * into original from public.ticket_email_jobs where ticket_id=new.id and kind='ACKNOWLEDGEMENT';
    insert into public.ticket_email_jobs(ticket_id,kind,payload,message_id,subject,parent_message_id)
    values(new.id,'RESOLUTION',to_jsonb(new),'<resolved.' || new.id || '@mis-helpdesk.local>',
      case when original.id is not null then 'Re: ' || original.subject else 'MIS support request resolved — ' || new.ticket_number end,
      original.message_id)
    on conflict(ticket_id,kind) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists queue_ticket_email on public.tickets;
create trigger queue_ticket_email after insert or update of status on public.tickets
for each row execute function public.queue_ticket_email();

create or replace function public.transition_ticket(
  p_id uuid, p_expected public.ticket_status, p_status public.ticket_status,
  p_assigned text, p_notes text, p_actor text
) returns public.tickets language plpgsql security invoker set search_path = '' as $$
declare current_ticket public.tickets; result public.tickets;
begin
  select * into current_ticket from public.tickets where id=p_id for update;
  if not found then raise exception 'Ticket not found' using errcode='P0002'; end if;
  if current_ticket.status <> p_expected then raise exception 'Ticket changed; refresh and try again' using errcode='40001'; end if;
  if not (
    (current_ticket.status='PENDING' and p_status in ('ACCEPTED','RESOLVED','CANCELLED')) or
    (current_ticket.status='ACCEPTED' and p_status in ('IN_PROGRESS','RESOLVED','CANCELLED')) or
    (current_ticket.status='IN_PROGRESS' and p_status in ('RESOLVED','CANCELLED'))
  ) then raise exception 'Invalid status transition' using errcode='22023'; end if;
  if p_status <> 'CANCELLED' and coalesce(trim(p_assigned),'')='' then
    raise exception 'Technician is required' using errcode='22023'; end if;
  if p_status='RESOLVED' and coalesce(trim(p_notes),'')='' then
    raise exception 'Resolution notes are required' using errcode='22023'; end if;
  update public.tickets set status=p_status, assigned_to=nullif(trim(p_assigned),''),
    resolution_notes=nullif(trim(p_notes),''), updated_at=clock_timestamp(),
    accepted_at=case when p_status='ACCEPTED' then coalesce(accepted_at,clock_timestamp()) else accepted_at end,
    started_at=case when p_status='IN_PROGRESS' then coalesce(started_at,clock_timestamp()) else started_at end,
    resolved_at=case when p_status='RESOLVED' then coalesce(resolved_at,clock_timestamp()) else resolved_at end
    where id=p_id returning * into result;
  insert into public.ticket_updates(ticket_id,old_status,new_status,remarks,actor)
    values(p_id,current_ticket.status,p_status,nullif(trim(p_notes),''),p_actor);
  return result;
end $$;

create or replace function public.claim_ticket_email(p_ticket_id uuid default null)
returns setof public.ticket_email_jobs language plpgsql security invoker set search_path = '' as $$
begin
  -- SMTP acceptance cannot safely be inferred after a crashed worker. Never blindly resend.
  update public.ticket_email_jobs set state='REVIEW',last_error='Delivery interrupted. Check SMTP logs before retrying.'
  where state='SENDING' and lease_until < now();
  return query
  with candidate as (
    select j.id from public.ticket_email_jobs j
    where j.state='QUEUED' and j.available_at<=now()
      and (p_ticket_id is null or j.ticket_id=p_ticket_id)
      and (j.parent_message_id is null or exists (
        select 1 from public.ticket_email_jobs parent where parent.message_id=j.parent_message_id and parent.state='SENT'))
    order by j.created_at,j.id for update skip locked limit 1
  )
  update public.ticket_email_jobs j set state='SENDING',attempts=j.attempts+1,
    claim_token=gen_random_uuid(),lease_until=now()+interval '5 minutes'
  from candidate where j.id=candidate.id returning j.*;
end $$;

-- Server-only: no browser or employee JWT may execute privileged workflow functions.
revoke all on function public.queue_ticket_email() from public,anon,authenticated;
revoke all on function public.transition_ticket(uuid,public.ticket_status,public.ticket_status,text,text,text) from public,anon,authenticated;
revoke all on function public.claim_ticket_email(uuid) from public,anon,authenticated;
grant execute on function public.transition_ticket(uuid,public.ticket_status,public.ticket_status,text,text,text) to service_role;
grant execute on function public.claim_ticket_email(uuid) to service_role;
grant all on public.ticket_email_jobs to service_role;
-- Cache validators change whenever any ticket changes. No full-history download on idle polls.
create or replace function public.touch_ticket() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := clock_timestamp(); return new; end $$;
drop trigger if exists touch_ticket on public.tickets;
create trigger touch_ticket before update on public.tickets for each row execute function public.touch_ticket();
create or replace function public.ticket_history_revision(p_email text default null) returns text
language sql stable security invoker set search_path = '' as $$
  select md5(count(*)::text || ':' || coalesce(max(updated_at)::text,'') || ':' || coalesce(p_email,''))
  from public.tickets where p_email is null or reporter_email=p_email;
$$;
revoke all on function public.ticket_history_revision(text) from public,anon,authenticated;
grant execute on function public.ticket_history_revision(text) to service_role;
commit;
