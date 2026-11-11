-- Reusable personal/team collections and private, aggregate-only usage insights.
create table public.prompt_collections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  description text not null default '' check (char_length(description) <= 500),
  owner_user_id uuid references public.profiles(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collection_one_scope check ((owner_user_id is not null) <> (team_id is not null))
);
create index prompt_collections_owner_idx on public.prompt_collections(owner_user_id);
create index prompt_collections_team_idx on public.prompt_collections(team_id);

create table public.prompt_collection_items (
  collection_id uuid not null references public.prompt_collections(id) on delete cascade,
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  sort_order integer not null,
  added_at timestamptz not null default now(),
  primary key (collection_id,prompt_id)
);
create index prompt_collection_items_order_idx on public.prompt_collection_items(collection_id,sort_order);

alter table public.prompt_collections enable row level security;
alter table public.prompt_collection_items enable row level security;
revoke all on public.prompt_collections,public.prompt_collection_items from public,anon,authenticated;
grant select on public.prompt_collections,public.prompt_collection_items to authenticated;

create policy collection_read on public.prompt_collections for select to authenticated
  using (private.account_usable() and (owner_user_id=(select auth.uid()) or
    (team_id is not null and private.is_member(team_id))));
create policy collection_items_read on public.prompt_collection_items for select to authenticated
  using (private.account_usable() and private.can_read_prompt(prompt_id) and exists (
    select 1 from public.prompt_collections c where c.id=collection_id and
      (c.owner_user_id=(select auth.uid()) or (c.team_id is not null and private.is_member(c.team_id)))
      and (c.team_id is null or exists (select 1 from public.prompts p where p.id=prompt_id
        and p.owner_team_id is not null and p.lifecycle='published'
        and p.official_version_id is not null and p.deleted_at is null))
  ));

create function private.can_manage_prompt_collection(cid uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists (select 1 from public.prompt_collections c where c.id=cid and
    (c.owner_user_id=(select auth.uid()) or
      (c.team_id is not null and private.is_manager(c.team_id))));
$$;
revoke all on function private.can_manage_prompt_collection(uuid) from public,anon,authenticated;

create function public.create_prompt_collection(collection_name text, collection_description text default '', collection_team_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid; title text:=btrim(collection_name);
begin
  perform private.require_ready();
  if char_length(title) not between 2 and 80 then raise exception 'Collection name must contain 2–80 characters'; end if;
  if char_length(coalesce(collection_description,''))>500 then raise exception 'Description must be 500 characters or fewer'; end if;
  if collection_team_id is not null and not private.is_manager(collection_team_id) then
    raise exception 'Only team managers can create team collections';
  end if;
  insert into public.prompt_collections(name,description,owner_user_id,team_id,created_by)
  values(title,coalesce(collection_description,''),case when collection_team_id is null then auth.uid() else null end,
    collection_team_id,auth.uid()) returning id into new_id;
  perform private.log_event('collection_created',collection_team_id,null,title);
  return new_id;
end $$;

create function public.update_prompt_collection(cid uuid, collection_name text, collection_description text default '')
returns void language plpgsql security definer set search_path='' as $$
declare title text:=btrim(collection_name); team_uuid uuid;
begin
  perform private.require_ready();
  if not private.can_manage_prompt_collection(cid) then raise exception 'Collection manager access required'; end if;
  if char_length(title) not between 2 and 80 then raise exception 'Collection name must contain 2–80 characters'; end if;
  if char_length(coalesce(collection_description,''))>500 then raise exception 'Description must be 500 characters or fewer'; end if;
  update public.prompt_collections set name=title,description=coalesce(collection_description,''),updated_at=now()
    where id=cid returning team_id into team_uuid;
  perform private.log_event('collection_updated',team_uuid,null,title);
end $$;

create function public.delete_prompt_collection(cid uuid)
returns void language plpgsql security definer set search_path='' as $$
declare title text; team_uuid uuid;
begin
  perform private.require_ready();
  if not private.can_manage_prompt_collection(cid) then raise exception 'Collection manager access required'; end if;
  select name,team_id into title,team_uuid from public.prompt_collections where id=cid;
  delete from public.prompt_collections where id=cid;
  perform private.log_event('collection_deleted',team_uuid,null,coalesce(title,''));
end $$;

create function public.add_prompt_to_collection(cid uuid, pid uuid)
returns void language plpgsql security definer set search_path='' as $$
declare collection_row public.prompt_collections%rowtype; p public.prompts%rowtype; next_sort int;
begin
  perform private.require_ready();
  if not private.can_manage_prompt_collection(cid) then raise exception 'Collection manager access required'; end if;
  select * into collection_row from public.prompt_collections where id=cid for update;
  select * into p from public.prompts where id=pid and deleted_at is null;
  if p.id is null or not private.can_read_prompt(pid) then raise exception 'Prompt not accessible'; end if;
  -- Shared collections must never point to personal, archived, draft, or trashed prompts.
  if collection_row.team_id is not null and
    (p.owner_team_id is null or p.lifecycle<>'published' or p.official_version_id is null) then
    raise exception 'Team collections accept published team prompts only';
  end if;
  select coalesce(max(sort_order),0)+100 into next_sort from public.prompt_collection_items where collection_id=cid;
  insert into public.prompt_collection_items(collection_id,prompt_id,sort_order) values(cid,pid,next_sort)
    on conflict(collection_id,prompt_id) do nothing;
end $$;

create function public.remove_prompt_from_collection(cid uuid, pid uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.require_ready();
  if not private.can_manage_prompt_collection(cid) then raise exception 'Collection manager access required'; end if;
  delete from public.prompt_collection_items where collection_id=cid and prompt_id=pid;
end $$;

create function public.move_prompt_in_collection(cid uuid, pid uuid, move_direction text)
returns void language plpgsql security definer set search_path='' as $$
declare current_sort int; neighbor_id uuid; neighbor_sort int;
begin
  perform private.require_ready();
  if not private.can_manage_prompt_collection(cid) then raise exception 'Collection manager access required'; end if;
  if move_direction not in ('up','down') then raise exception 'Direction must be up or down'; end if;
  -- Serialize concurrent reorders inside this collection.
  perform 1 from public.prompt_collections where id=cid for update;
  select sort_order into current_sort from public.prompt_collection_items where collection_id=cid and prompt_id=pid;
  if current_sort is null then raise exception 'Prompt is not in collection'; end if;
  if move_direction='up' then
    select prompt_id,sort_order into neighbor_id,neighbor_sort from public.prompt_collection_items
      where collection_id=cid and sort_order<current_sort order by sort_order desc limit 1;
  else
    select prompt_id,sort_order into neighbor_id,neighbor_sort from public.prompt_collection_items
      where collection_id=cid and sort_order>current_sort order by sort_order asc limit 1;
  end if;
  if neighbor_id is null then return; end if;
  update public.prompt_collection_items set sort_order=neighbor_sort where collection_id=cid and prompt_id=pid;
  update public.prompt_collection_items set sort_order=current_sort where collection_id=cid and prompt_id=neighbor_id;
end $$;

-- Individual events cannot be read from the app: no SELECT grants or policies.
-- Aggregated RPCs never return actor IDs, names, emails, or event-level rows.
create table public.prompt_usage_events (
  id bigint generated always as identity primary key,
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('open','copy','combine')),
  occurred_at timestamptz not null default now()
);
create index prompt_usage_events_prompt_time_idx on public.prompt_usage_events(prompt_id,occurred_at desc);
create index prompt_usage_events_actor_rate_idx on public.prompt_usage_events(actor_id,prompt_id,event_type,occurred_at desc);
alter table public.prompt_usage_events enable row level security;
revoke all on public.prompt_usage_events from public,anon,authenticated;
-- No direct SELECT/INSERT grants. Only these SECURITY DEFINER functions can access rows.

create function public.record_prompt_usage(pid uuid, usage_action text)
returns void language plpgsql security definer set search_path='' as $$
declare min_gap interval;
begin
  perform private.require_ready();
  if usage_action not in ('open','copy','combine') then raise exception 'Invalid usage action'; end if;
  if not private.can_read_prompt(pid) then raise exception 'Prompt not accessible'; end if;
  min_gap:=case when usage_action='open' then interval '10 seconds' else interval '2 seconds' end;
  if exists (select 1 from public.prompt_usage_events e where e.prompt_id=pid and
      e.actor_id=auth.uid() and e.event_type=usage_action and
      e.occurred_at > now()-min_gap) then return; end if;
  insert into public.prompt_usage_events(prompt_id,actor_id,event_type) values(pid,auth.uid(),usage_action);
end $$;

create function public.get_prompt_usage_insights(pid uuid, include_creator boolean default false, days integer default 30)
returns table(opens bigint,copies bigint,combines bigint,unique_users bigint,last_used timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  perform private.require_ready();
  if not private.can_read_prompt(pid) then raise exception 'Prompt not accessible'; end if;
  if days not between 1 and 365 then raise exception 'Invalid analytics period'; end if;
  return query select
    count(*) filter(where e.event_type='open'),
    count(*) filter(where e.event_type='copy'),
    count(*) filter(where e.event_type='combine'),
    count(distinct e.actor_id),max(e.occurred_at)
  from public.prompts p left join public.prompt_usage_events e on e.prompt_id=p.id
    and e.occurred_at>=now()-make_interval(days=>get_prompt_usage_insights.days)
    and (get_prompt_usage_insights.include_creator or e.actor_id<>p.created_by)
  where p.id=pid;
end $$;

create function public.get_team_usage_insights(tid uuid, include_creator boolean default false, days integer default 30)
returns jsonb language plpgsql security definer set search_path='' as $$
declare totals jsonb; top_prompts jsonb; no_copies integer;
begin
  perform private.require_ready();
  if not private.is_member(tid) then raise exception 'Team access required'; end if;
  if days not between 1 and 365 then raise exception 'Invalid analytics period'; end if;
  -- Distinct users are counted ONCE across the whole team, not summed per prompt.
  select jsonb_build_object(
    'opens',count(*) filter(where e.event_type='open'),
    'copies',count(*) filter(where e.event_type='copy'),
    'combines',count(*) filter(where e.event_type='combine'),
    'unique_users',count(distinct e.actor_id)) into totals
  from public.prompts p left join public.prompt_usage_events e on e.prompt_id=p.id
    and e.occurred_at>=now()-make_interval(days=>get_team_usage_insights.days)
    and (get_team_usage_insights.include_creator or e.actor_id<>p.created_by)
  where p.owner_team_id=tid and p.deleted_at is null and p.lifecycle='published' and p.official_version_id is not null;

  select count(*) into no_copies from public.prompts p where p.owner_team_id=tid and p.deleted_at is null and p.lifecycle='published' and p.official_version_id is not null and
    not exists(select 1 from public.prompt_usage_events e where e.prompt_id=p.id and e.event_type='copy'
      and e.occurred_at>=now()-make_interval(days=>get_team_usage_insights.days)
      and (get_team_usage_insights.include_creator or e.actor_id<>p.created_by));

  select coalesce(jsonb_agg(to_jsonb(s) order by s.copies desc,s.opens desc,s.title), '[]'::jsonb)
    into top_prompts from (
    select p.id as prompt_id,coalesce(v.title,'Untitled prompt') as title,
      count(e.id) filter(where e.event_type='open') as opens,
      count(e.id) filter(where e.event_type='copy') as copies,
      count(e.id) filter(where e.event_type='combine') as combines
    from public.prompts p
    left join public.prompt_versions v on v.id=coalesce(p.official_version_id,p.latest_version_id)
    left join public.prompt_usage_events e on e.prompt_id=p.id
      and e.occurred_at>=now()-make_interval(days=>get_team_usage_insights.days)
      and (get_team_usage_insights.include_creator or e.actor_id<>p.created_by)
    where p.owner_team_id=tid and p.deleted_at is null and p.lifecycle='published' and p.official_version_id is not null
    group by p.id,v.title order by copies desc,opens desc,v.title limit 5
  ) s;
  return jsonb_build_object('summary',totals,'top_prompts',top_prompts,'not_copied',no_copies);
end $$;

-- Admin-only maintenance. Schedule monthly via Supabase Cron if enabled; raw events
-- should not be retained indefinitely. Dashboards themselves are limited to 7/30/90 days.
create function public.purge_old_prompt_usage_events()
returns bigint language plpgsql security definer set search_path='' as $$
declare removed bigint;
begin
  perform private.require_ready();
  if not private.is_admin() then raise exception 'Administrator required'; end if;
  delete from public.prompt_usage_events where occurred_at < now()-interval '180 days';
  get diagnostics removed=row_count;
  return removed;
end $$;

revoke all on function public.create_prompt_collection(text,text,uuid),
  public.update_prompt_collection(uuid,text,text),public.delete_prompt_collection(uuid),
  public.add_prompt_to_collection(uuid,uuid),public.remove_prompt_from_collection(uuid,uuid),
  public.move_prompt_in_collection(uuid,uuid,text),public.record_prompt_usage(uuid,text),
  public.get_prompt_usage_insights(uuid,boolean,integer),public.get_team_usage_insights(uuid,boolean,integer),
  public.purge_old_prompt_usage_events() from public,anon;
grant execute on function public.create_prompt_collection(text,text,uuid),
  public.update_prompt_collection(uuid,text,text),public.delete_prompt_collection(uuid),
  public.add_prompt_to_collection(uuid,uuid),public.remove_prompt_from_collection(uuid,uuid),
  public.move_prompt_in_collection(uuid,uuid,text),public.record_prompt_usage(uuid,text),
  public.get_prompt_usage_insights(uuid,boolean,integer),public.get_team_usage_insights(uuid,boolean,integer),
  public.purge_old_prompt_usage_events() to authenticated;
