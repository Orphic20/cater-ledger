-- Run once in the Supabase SQL editor.
-- Adds agency contact name + catering event end date.

alter table public.clients
  add column if not exists contact_name text;

alter table public.soas
  add column if not exists event_end_date date;

create or replace view public.soa_tracker as
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
