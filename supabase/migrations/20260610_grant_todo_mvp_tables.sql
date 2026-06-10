-- Grants for todo MVP tables when "Automatically expose new tables" is disabled.
-- RLS policies still control which rows each user can access.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.goals to authenticated;
grant select, insert, update, delete on public.task_time_sessions to authenticated;
grant select, insert, update, delete on public.daily_reviews to authenticated;
grant select, insert, update, delete on public.todos to authenticated;
