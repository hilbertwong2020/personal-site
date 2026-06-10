-- Backfill profiles for users created before the profile trigger existed.
-- Run this once in Supabase SQL Editor if inserts fail with a profiles foreign key error.

insert into public.profiles (id, email, display_name, approved)
select
  users.id,
  coalesce(users.email, ''),
  coalesce(users.raw_user_meta_data->>'display_name', split_part(coalesce(users.email, ''), '@', 1)),
  false
from auth.users
on conflict (id) do update
set
  email = excluded.email,
  display_name = coalesce(public.profiles.display_name, excluded.display_name);
