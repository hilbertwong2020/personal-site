-- Todo AI-ready MVP migration.
-- Run this once in Supabase SQL Editor after the initial schema.sql.

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  start_date date not null default current_date,
  target_date date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.todos
  add column if not exists category text not null default '未分类',
  add column if not exists subcategory text not null default '未分类',
  add column if not exists estimated_minutes integer,
  add column if not exists goal_id uuid references public.goals(id) on delete set null,
  add column if not exists notes text,
  add column if not exists ai_tags text[] not null default '{}';

create table if not exists public.task_time_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  todo_id uuid not null references public.todos(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  review_date date not null default current_date,
  reflection text not null default '',
  ai_summary text,
  ai_suggestions text,
  ai_tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, review_date)
);

alter table public.goals enable row level security;
alter table public.task_time_sessions enable row level security;
alter table public.daily_reviews enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.goals to authenticated;
grant select, insert, update, delete on public.task_time_sessions to authenticated;
grant select, insert, update, delete on public.daily_reviews to authenticated;
grant select, insert, update, delete on public.todos to authenticated;

drop trigger if exists set_goals_updated_at on public.goals;
create trigger set_goals_updated_at
before update on public.goals
for each row execute function public.set_updated_at();

drop trigger if exists set_daily_reviews_updated_at on public.daily_reviews;
create trigger set_daily_reviews_updated_at
before update on public.daily_reviews
for each row execute function public.set_updated_at();

drop policy if exists "users can manage their goals" on public.goals;
create policy "users can manage their goals"
on public.goals for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "users can manage their task time sessions" on public.task_time_sessions;
create policy "users can manage their task time sessions"
on public.task_time_sessions for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "users can manage their daily reviews" on public.daily_reviews;
create policy "users can manage their daily reviews"
on public.daily_reviews for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());
