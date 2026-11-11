-- Personal prompt impact in Settings.
-- Apply after 014_collections_and_usage_insights.sql (do NOT rerun 014).
-- No individual users' identities or prompt-by-prompt details leave this RPC.

create function public.get_my_prompt_impact(include_self boolean default false, days integer default 30)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform private.require_ready();
  if days is null or days not between 1 and 365 then
    raise exception 'Invalid analytics period';
  end if;

  -- Each accessible, non-trashed prompt appears ONCE, regardless of how many
  -- versions or accepted contributions this account has made. An accepted
  -- improvement proposal counts as a contribution even if its version has
  -- later been removed or superseded.
  with eligible as (
    select p.id, (p.created_by=auth.uid()) as is_creator
    from public.prompts p
    where p.deleted_at is null and private.can_read_prompt(p.id)
      and (
        p.created_by=auth.uid()
        or exists (
          select 1 from public.prompt_versions v
          where v.prompt_id=p.id and v.author_id=auth.uid()
        )
        or exists (
          select 1 from public.improvement_proposals pr
          where pr.prompt_id=p.id and pr.author_id=auth.uid() and pr.status='accepted'
        )
      )
  ),
  work as (
    select count(*) as prompts_total,
      count(*) filter (where is_creator) as prompts_created,
      count(*) filter (where not is_creator) as prompts_contributed
    from eligible
  ),
  activity as (
    select
      count(e.id) filter (where e.event_type='open') as opens,
      count(e.id) filter (where e.event_type='copy') as copies,
      count(e.id) filter (where e.event_type='combine') as combines,
      count(distinct e.actor_id) as unique_users,
      max(e.occurred_at) as last_used
    from eligible p
    left join public.prompt_usage_events e on e.prompt_id=p.id
      and e.occurred_at >= now()-make_interval(days=>get_my_prompt_impact.days)
      and (coalesce(get_my_prompt_impact.include_self,false) or e.actor_id<>auth.uid())
  )
  select jsonb_build_object(
    'prompts_total',w.prompts_total,
    'prompts_created',w.prompts_created,
    'prompts_contributed',w.prompts_contributed,
    'opens',a.opens,
    'copies',a.copies,
    'combines',a.combines,
    'unique_users',a.unique_users,
    'last_used',a.last_used
  ) into result
  from work w cross join activity a;
  return result;
end $$;

revoke all on function public.get_my_prompt_impact(boolean,integer) from public,anon;
grant execute on function public.get_my_prompt_impact(boolean,integer) to authenticated;
