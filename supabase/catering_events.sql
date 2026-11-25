-- Run once in the Supabase SQL editor.
-- Separate catering events from SOAs; optional SOA ↔ event link.

create table if not exists public.catering_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catering_event_days (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.catering_events(id) on delete cascade,
  event_date date not null,
  breakfast text,
  am_snacks text,
  lunch text,
  pm_snacks text,
  dinner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, event_date)
);

alter table public.soas
  add column if not exists catering_event_id uuid references public.catering_events(id) on delete set null;

create index if not exists catering_events_client_id_idx on public.catering_events(client_id);
create index if not exists catering_event_days_event_id_idx on public.catering_event_days(event_id);
create index if not exists catering_event_days_event_date_idx on public.catering_event_days(event_date);
create index if not exists soas_catering_event_id_idx on public.soas(catering_event_id);

alter table public.catering_events enable row level security;
alter table public.catering_event_days enable row level security;

drop policy if exists catering_events_staff_all on public.catering_events;
create policy catering_events_staff_all on public.catering_events
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'caterledger_staff') = 'true')
  with check ((auth.jwt() -> 'app_metadata' ->> 'caterledger_staff') = 'true');

drop policy if exists catering_event_days_staff_all on public.catering_event_days;
create policy catering_event_days_staff_all on public.catering_event_days
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'caterledger_staff') = 'true')
  with check ((auth.jwt() -> 'app_metadata' ->> 'caterledger_staff') = 'true');

grant select, insert, update, delete on public.catering_events to authenticated;
grant select, insert, update, delete on public.catering_event_days to authenticated;

drop view if exists public.soa_tracker;

create view public.soa_tracker as
select
  s.id,
  s.client_id,
  s.ref_no,
  s.agency,
  s.soa_date,
  s.due_date,
  s.amount,
  s.paid_at,
  s.event_name,
  s.event_date,
  s.event_end_date,
  s.venue,
  s.catering_event_id,
  s.created_at,
  s.updated_at,
  case
    when s.paid_at is not null then 'Paid'::text
    when s.due_date is not null
      and s.due_date < ((now() at time zone 'Asia/Manila')::date)
      then 'Overdue'::text
    else 'Unpaid'::text
  end as status
from public.soas s;

grant select on public.soa_tracker to authenticated;
