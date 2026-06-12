-- Allow signed-in users to read and save their own private diary entries.
-- RLS still limits access to rows where owner_id = auth.uid().

alter table public.diary_entries enable row level security;

grant select, insert, update, delete on public.diary_entries to authenticated;

drop policy if exists "users can manage their diary entries" on public.diary_entries;
create policy "users can manage their diary entries"
on public.diary_entries for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());
