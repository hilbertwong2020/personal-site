-- Wang's Space initial database schema
-- Run this in the Supabase SQL Editor after creating the project.

create type public.profile_role as enum ('owner', 'member');
create type public.content_visibility as enum ('public', 'members', 'private', 'shared');
create type public.permission_level as enum ('view', 'edit');

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, approved)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    false
  );

  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role public.profile_role not null default 'member',
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  email text,
  created_by uuid references public.profiles(id) on delete set null,
  used_by uuid references public.profiles(id) on delete set null,
  used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  slug text not null unique,
  excerpt text,
  content text not null default '',
  visibility public.content_visibility not null default 'public',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  content text not null default '',
  visibility public.content_visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_permissions (
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  level public.permission_level not null default 'view',
  created_at timestamptz not null default now(),
  primary key (document_id, user_id)
);

create table public.todos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  due_on date,
  category text not null default '未分类',
  subcategory text not null default '未分类',
  estimated_minutes integer,
  goal_id uuid,
  notes text,
  ai_tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goals (
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
  add constraint todos_goal_id_fkey foreign key (goal_id) references public.goals(id) on delete set null;

create table public.timer_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  todo_id uuid references public.todos(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer not null default 0,
  note text
);

create table public.task_time_sessions (
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

create table public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  content text not null default '',
  entry_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  visibility public.content_visibility not null default 'private',
  created_at timestamptz not null default now()
);

create table public.daily_reviews (
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

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create trigger set_posts_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

create trigger set_documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

create trigger set_todos_updated_at
before update on public.todos
for each row execute function public.set_updated_at();

create trigger set_goals_updated_at
before update on public.goals
for each row execute function public.set_updated_at();

create trigger set_diary_entries_updated_at
before update on public.diary_entries
for each row execute function public.set_updated_at();

create trigger set_daily_reviews_updated_at
before update on public.daily_reviews
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.invitations enable row level security;
alter table public.posts enable row level security;
alter table public.documents enable row level security;
alter table public.document_permissions enable row level security;
alter table public.todos enable row level security;
alter table public.goals enable row level security;
alter table public.timer_sessions enable row level security;
alter table public.task_time_sessions enable row level security;
alter table public.diary_entries enable row level security;
alter table public.files enable row level security;
alter table public.daily_reviews enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.goals to authenticated;
grant select, insert, update, delete on public.task_time_sessions to authenticated;
grant select, insert, update, delete on public.daily_reviews to authenticated;
grant select, insert, update, delete on public.todos to authenticated;

create policy "profiles are readable by signed-in users"
on public.profiles for select
to authenticated
using (true);

create policy "users can update their own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "owners can manage invitations"
on public.invitations for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'owner'
  )
);

create policy "public posts are readable by everyone"
on public.posts for select
to anon, authenticated
using (visibility = 'public' and published_at is not null);

create policy "members can read members posts"
on public.posts for select
to authenticated
using (visibility in ('public', 'members') or author_id = auth.uid());

create policy "authors can manage their posts"
on public.posts for all
to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

create policy "owners can read their documents"
on public.documents for select
to authenticated
using (
  owner_id = auth.uid()
  or visibility = 'members'
  or exists (
    select 1
    from public.document_permissions
    where document_permissions.document_id = documents.id
      and document_permissions.user_id = auth.uid()
  )
);

create policy "owners can manage their documents"
on public.documents for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "document editors can update shared documents"
on public.documents for update
to authenticated
using (
  exists (
    select 1
    from public.document_permissions
    where document_permissions.document_id = documents.id
      and document_permissions.user_id = auth.uid()
      and document_permissions.level = 'edit'
  )
);

create policy "users can read permissions involving them"
on public.document_permissions for select
to authenticated
using (user_id = auth.uid());

create policy "document owners can manage permissions"
on public.document_permissions for all
to authenticated
using (
  exists (
    select 1
    from public.documents
    where documents.id = document_permissions.document_id
      and documents.owner_id = auth.uid()
  )
);

create policy "users can manage their todos"
on public.todos for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "users can manage their goals"
on public.goals for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "users can manage their timer sessions"
on public.timer_sessions for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "users can manage their task time sessions"
on public.task_time_sessions for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "users can manage their diary entries"
on public.diary_entries for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "users can manage their daily reviews"
on public.daily_reviews for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "public files are readable by everyone"
on public.files for select
to anon, authenticated
using (visibility = 'public');

create policy "users can manage their files"
on public.files for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());
