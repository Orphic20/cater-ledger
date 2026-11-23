-- Run once in the Supabase SQL editor.
-- The staff policy already allows deletes, but the table grants do not.

grant delete on public.clients, public.soas to authenticated;
