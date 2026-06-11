create table if not exists public.todo_hidden_dates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  todo_id uuid not null references public.todos(id) on delete cascade,
  hidden_on date not null,
  created_at timestamptz not null default now(),
  unique (owner_id, todo_id, hidden_on)
);

alter table public.todo_hidden_dates enable row level security;

grant select, insert, update, delete on public.todo_hidden_dates to authenticated;

drop policy if exists "users can manage their hidden todo dates" on public.todo_hidden_dates;
create policy "users can manage their hidden todo dates"
on public.todo_hidden_dates for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());
