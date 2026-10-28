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
