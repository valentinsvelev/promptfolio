-- Promptfolio UX: aggregate saved counts as likes without leaking personal favorites.
-- Run after 001_schema.sql and 002_phase1_completion.sql.
-- Guest sessions intentionally receive NO database permissions. The frontend
-- shows a fixed sample catalogue, preserving Phase 1's membership isolation.
create or replace function public.prompt_like_counts()
returns table(prompt_id uuid, likes bigint)
language sql stable security definer set search_path = ''
as $$
 select f.prompt_id, count(*)::bigint as likes
 from public.favorites f
 join public.prompts p on p.id=f.prompt_id
 where (select auth.uid()) is not null and private.can_read_prompt(p.id)
 group by f.prompt_id
$$;
revoke all on function public.prompt_like_counts() from public, anon, authenticated;
grant execute on function public.prompt_like_counts() to authenticated;
create index if not exists favorites_by_prompt on public.favorites(prompt_id);
