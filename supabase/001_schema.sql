create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null default 'Contributor',
  created_at timestamptz not null default now()
);
create table public.app_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade
);
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  created_at timestamptz not null default now()
);
create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member','manager')),
  joined_at timestamptz not null default now(),
  primary key(team_id, user_id)
);
create table public.prompts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles(id),
  owner_team_id uuid references public.teams(id),
  created_by uuid not null references public.profiles(id),
  lifecycle text not null default 'draft' check (lifecycle in ('draft','published','archived')),
  official_version_id uuid,
  latest_version_id uuid,
  source_prompt_id uuid references public.prompts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint one_owner check ((owner_user_id is null) <> (owner_team_id is null))
);
create table public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  title text not null check (char_length(title) between 1 and 150),
  description text not null default '',
  content text not null check (char_length(content) between 1 and 30000),
  category text not null default 'General',
  tags text[] not null default '{}',
  usage_instructions text not null default '',
  example_inputs text not null default '',
  expected_outputs text not null default '',
  compatible_models text[] not null default '{}',
  approval_status text not null default 'experimental'
    check (approval_status in ('experimental','under_review','approved','deprecated')),
  decision text not null default '' check (decision in ('','rejected')),
  decision_reason text not null default '',
  change_note text not null default '',
  author_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(prompt_id, version_number),
  unique(prompt_id, id)
);
-- Composite FKs ensure a pointer cannot refer to another prompt's version.
alter table public.prompts add constraint official_version_same_prompt
  foreign key (id,official_version_id) references public.prompt_versions(prompt_id,id)
  deferrable initially deferred;
alter table public.prompts add constraint latest_version_same_prompt
  foreign key (id,latest_version_id) references public.prompt_versions(prompt_id,id)
  deferrable initially deferred;
create table public.improvement_proposals (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.prompts(id),
  author_id uuid not null references public.profiles(id),
  proposed_content jsonb not null,
  rationale text not null default '',
  status text not null default 'open' check (status in ('open','under_review','accepted','rejected')),
  decision_reason text not null default '',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,prompt_id)
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  message text not null,
  prompt_id uuid references public.prompts(id),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  team_id uuid references public.teams(id),
  prompt_id uuid references public.prompts(id),
  event_type text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);
create index on public.team_members(user_id);
create index on public.prompts(owner_team_id,lifecycle) where deleted_at is null;
create index on public.prompts(owner_user_id) where deleted_at is null;
create index on public.prompt_versions(prompt_id,version_number desc);
create index on public.notifications(recipient_id,created_at desc);
create index on public.improvement_proposals(prompt_id,status);

-- New accounts start with ZERO teams. The trigger is the only way to insert
-- profiles from a signup; users cannot assign themselves admin or manager.
create function private.on_user_created() returns trigger language plpgsql
security definer set search_path = '' as $$
begin
  insert into public.profiles(id,email,display_name)
  values(new.id, lower(new.email),
    left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'),''),
      split_part(new.email,'@',1)), 100))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger promptfolio_new_auth_user after insert on auth.users
for each row execute function private.on_user_created();

-- Protected permission checks do not recurse through the RLS policies.
create function private.is_admin() returns boolean language sql stable
security definer set search_path = '' as $$
  select exists(select 1 from public.app_admins a where a.user_id=(select auth.uid()))
$$;
create function private.has_team() returns boolean language sql stable
security definer set search_path = '' as $$
  select exists(select 1 from public.team_members m where m.user_id=(select auth.uid()))
$$;
create function private.is_member(t uuid) returns boolean language sql stable
security definer set search_path = '' as $$
  select exists(select 1 from public.team_members m
    where m.team_id=t and m.user_id=(select auth.uid()))
$$;
create function private.is_manager(t uuid) returns boolean language sql stable
security definer set search_path = '' as $$
  select exists(select 1 from public.team_members m
    where m.team_id=t and m.user_id=(select auth.uid()) and m.role='manager')
$$;
create function private.is_any_manager() returns boolean language sql stable
security definer set search_path = '' as $$
  select exists(select 1 from public.team_members m
    where m.user_id=(select auth.uid()) and m.role='manager')
$$;
create function private.can_read_prompt(pid uuid) returns boolean language sql stable
security definer set search_path = '' as $$
 select exists(select 1 from public.prompts p where p.id=pid and p.deleted_at is null
   and (p.owner_user_id=(select auth.uid())
     or (p.owner_team_id is not null and private.is_member(p.owner_team_id))
     or (p.owner_team_id is not null and p.lifecycle='published'
       and p.official_version_id is not null and private.has_team())))
$$;
create function private.can_edit_prompt(pid uuid) returns boolean language sql stable
security definer set search_path = '' as $$
 select exists(select 1 from public.prompts p where p.id=pid
   and (p.owner_user_id=(select auth.uid())
     or (p.owner_team_id is not null and private.is_member(p.owner_team_id))))
$$;
create function private.log_event(ev text, tm uuid, pid uuid, info text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
 insert into public.audit_events(actor_id,team_id,prompt_id,event_type,description)
 values(auth.uid(),tm,pid,ev,left(info,300));
end $$;
create function private.notify_team_managers(tm uuid, kind text, msg text, pid uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
 insert into public.notifications(recipient_id,kind,message,prompt_id)
 select m.user_id,kind,left(msg,300),pid from public.team_members m
 where m.team_id=tm and m.role='manager' and m.user_id<>auth.uid();
end $$;

-- RLS: explicit grants + policies. Anonymous visitors get no database access.
alter table public.profiles enable row level security;
alter table public.app_admins enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.prompts enable row level security;
alter table public.prompt_versions enable row level security;
alter table public.improvement_proposals enable row level security;
alter table public.favorites enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_events enable row level security;
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles,public.app_admins,public.teams,public.team_members,
  public.prompts,public.prompt_versions,public.improvement_proposals,
  public.favorites,public.notifications,public.audit_events to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant insert,delete on public.favorites to authenticated;
grant update(read_at) on public.notifications to authenticated;

create policy profiles_read on public.profiles for select to authenticated
 using (id=(select auth.uid()) or private.is_admin() or private.is_any_manager()
   or (private.has_team() and exists (
     select 1 from public.team_members m where m.user_id=public.profiles.id
       and private.is_member(m.team_id)))
   or (private.has_team() and exists (
     select 1 from public.prompts p
     join public.prompt_versions v on v.id=p.official_version_id
     where v.author_id=public.profiles.id and p.lifecycle='published'
       and p.owner_team_id is not null and p.deleted_at is null)));

create policy profiles_edit on public.profiles for update to authenticated
 using (id=(select auth.uid())) with check (id=(select auth.uid()));
create policy admins_read on public.app_admins for select to authenticated
 using (user_id=(select auth.uid()));
create policy team_read on public.teams for select to authenticated using
 (private.is_admin() or (private.has_team() and
   (private.is_member(id) or exists (
     select 1 from public.prompts p where p.owner_team_id=public.teams.id and p.lifecycle='published'
       and p.deleted_at is null and p.official_version_id is not null))));
create policy member_read on public.team_members for select to authenticated
 using (private.is_admin() or private.is_member(team_id));
create policy prompt_read on public.prompts for select to authenticated
 using ((deleted_at is null and private.can_read_prompt(id)) or
   (deleted_at >= now()-interval '30 days' and private.can_edit_prompt(id)));
create policy version_read on public.prompt_versions for select to authenticated
 using (exists(select 1 from public.prompts p where p.id=prompt_id and p.deleted_at is null
   and (p.owner_user_id=(select auth.uid())
     or (p.owner_team_id is not null and private.is_member(p.owner_team_id))
     or (p.lifecycle='published' and p.owner_team_id is not null
       and public.prompt_versions.id=p.official_version_id and private.has_team()))));
create policy proposal_read on public.improvement_proposals for select to authenticated
 using ((author_id=(select auth.uid()) and private.can_read_prompt(prompt_id)) or exists(
   select 1 from public.prompts p where p.id=prompt_id and p.owner_team_id is not null
   and private.is_member(p.owner_team_id)));
create policy favorite_read on public.favorites for select to authenticated
 using(user_id=(select auth.uid()) and private.can_read_prompt(prompt_id));
create policy favorite_add on public.favorites for insert to authenticated
 with check(user_id=(select auth.uid()) and private.can_read_prompt(prompt_id));
create policy favorite_remove on public.favorites for delete to authenticated
 using(user_id=(select auth.uid()));
create policy notification_read on public.notifications for select to authenticated
 using(recipient_id=(select auth.uid()));
create policy notification_mark on public.notifications for update to authenticated
 using(recipient_id=(select auth.uid())) with check(recipient_id=(select auth.uid()));
create policy audit_read on public.audit_events for select to authenticated
 using(private.is_admin() or (team_id is not null and private.is_manager(team_id)));

-- Safe JSON field extraction from a front-end editor. All fields are server-controlled
-- except explicitly editable content. Reject malformed prompt bodies.
create function private.validate_body(payload jsonb) returns void language plpgsql
set search_path = '' as $$
begin
 if jsonb_typeof(payload) <> 'object' or
    char_length(btrim(coalesce(payload->>'title',''))) not between 1 and 150 or
    char_length(btrim(coalesce(payload->>'content',''))) not between 1 and 30000 or
    jsonb_typeof(coalesce(payload->'tags','[]'::jsonb)) <> 'array' or
    jsonb_typeof(coalesce(payload->'compatible_models','[]'::jsonb)) <> 'array' then
   raise exception 'Enter a title, prompt text and valid tag/model lists';
 end if;
end $$;
create function private.append_version(pid uuid, payload jsonb, author uuid,
 approval text, note text default '') returns uuid language plpgsql
security definer set search_path = '' as $$
declare vid uuid; n integer;
begin
 perform private.validate_body(payload);
 select coalesce(max(version_number),0)+1 into n from public.prompt_versions where prompt_id=pid;
 insert into public.prompt_versions(prompt_id,version_number,title,description,content,category,
 tags,usage_instructions,example_inputs,expected_outputs,compatible_models,approval_status,
 change_note,author_id)
 values(pid,n,btrim(payload->>'title'),left(coalesce(payload->>'description',''),2000),
 btrim(payload->>'content'),left(coalesce(payload->>'category','General'),80),
 array(select left(value,60) from jsonb_array_elements_text(coalesce(payload->'tags','[]'::jsonb)) as t(value) limit 20),
 left(coalesce(payload->>'usage_instructions',''),3000),
 left(coalesce(payload->>'example_inputs',''),3000),
 left(coalesce(payload->>'expected_outputs',''),3000),
 array(select left(value,80) from jsonb_array_elements_text(coalesce(payload->'compatible_models','[]'::jsonb)) as t(value) limit 12),
 approval,left(note,800),author)
 returning id into vid;
 return vid;
end $$;

-- Public exposed RPCs are SECURE, with explicit role and access checks.
-- Don't expose the private schema via Supabase's Data API.
create function public.create_prompt(payload jsonb, team_id uuid default null,
 publish boolean default false) returns uuid language plpgsql
security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); pid uuid; vid uuid;
begin
 if uid is null then raise exception 'Please sign in'; end if;
 if team_id is not null and not private.is_member(team_id) then
   raise exception 'You are not a member of this team'; end if;
 perform private.validate_body(payload);
 insert into public.prompts(owner_user_id,owner_team_id,created_by,lifecycle)
 values(case when team_id is null then uid end,team_id,uid,
   case when publish then 'published' else 'draft' end) returning id into pid;
 vid:=private.append_version(pid,payload,uid,'experimental','Created prompt');
 update public.prompts set official_version_id=vid,latest_version_id=vid where id=pid;
 perform private.log_event('prompt_created',team_id,pid,'');
 return pid;
end $$;
create function public.save_prompt_version(pid uuid, payload jsonb, note text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.prompts%rowtype; vid uuid; approved boolean;
begin
 select * into p from public.prompts where id=pid and deleted_at is null for update;
 if not found or not private.can_edit_prompt(pid) then raise exception 'No editing access'; end if;
 select (approval_status='approved') into approved from public.prompt_versions
 where id=p.official_version_id;
 vid:=private.append_version(pid,payload,auth.uid(),
   case when coalesce(approved,false) then 'under_review' else 'experimental' end,note);
 update public.prompts set latest_version_id=vid,updated_at=now() where id=pid;
 if approved and p.owner_team_id is not null then
   perform private.notify_team_managers(p.owner_team_id,'review','A proposed version needs approval',pid);
 end if;
 perform private.log_event('version_saved',p.owner_team_id,pid,note);
 return vid;
end $$;
create function public.request_version_review(vid uuid) returns void language plpgsql
security definer set search_path = '' as $$
declare p public.prompts%rowtype; v public.prompt_versions%rowtype;
begin
 select * into v from public.prompt_versions where id=vid;
 select * into p from public.prompts where id=v.prompt_id and deleted_at is null for update;
 if p.id is null or p.owner_team_id is null or not private.is_member(p.owner_team_id)
   or p.latest_version_id<>vid or v.approval_status<>'experimental' then
   raise exception 'This version cannot be submitted'; end if;
 update public.prompt_versions set approval_status='under_review' where id=vid;
 perform private.notify_team_managers(p.owner_team_id,'review','A prompt version is ready for review',p.id);
 perform private.log_event('review_requested',p.owner_team_id,p.id,'');
end $$;
create function public.review_prompt_version(vid uuid, approve boolean, reason text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare p public.prompts%rowtype; v public.prompt_versions%rowtype;
begin
 select * into v from public.prompt_versions where id=vid;
 select * into p from public.prompts where id=v.prompt_id and deleted_at is null for update;
 if p.id is null or p.owner_team_id is null or not private.is_manager(p.owner_team_id)
    or p.latest_version_id<>vid or v.approval_status<>'under_review' then
   raise exception 'Only the owning Team Manager can review the latest pending version'; end if;
 if approve then
   update public.prompt_versions set approval_status='approved',decision='',decision_reason=''
      where id=vid;
   update public.prompts set official_version_id=vid,updated_at=now() where id=p.id;
 else
   if char_length(btrim(reason))<3 then raise exception 'Provide a rejection reason'; end if;
   update public.prompt_versions set approval_status='deprecated',decision='rejected',
     decision_reason=left(reason,800) where id=vid;
 end if;
 insert into public.notifications(recipient_id,kind,message,prompt_id)
 values(v.author_id,'version_decision',case when approve then 'Your prompt version was approved'
   else 'Your proposed version was rejected: '||left(reason,120) end,p.id);
 perform private.log_event('version_reviewed',p.owner_team_id,p.id,
   case when approve then 'Approved' else 'Rejected: '||reason end);
end $$;
create function public.set_prompt_lifecycle(pid uuid, new_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.prompts%rowtype;
begin
 select * into p from public.prompts where id=pid and deleted_at is null for update;
 if p.id is null or not private.can_edit_prompt(pid) or
   new_status not in ('draft','published','archived') then
   raise exception 'Cannot change prompt lifecycle'; end if;
 update public.prompts set lifecycle=new_status,updated_at=now() where id=pid;
 perform private.log_event('lifecycle_changed',p.owner_team_id,pid,new_status);
end $$;
create function public.soft_delete_prompt(pid uuid, recover boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.prompts%rowtype;
begin
 select * into p from public.prompts where id=pid for update;
 if p.id is null or not private.can_edit_prompt(pid) then raise exception 'No editing access'; end if;
 if recover and (p.deleted_at is null or p.deleted_at < now()-interval '30 days') then
  raise exception 'Recovery window expired or prompt is not deleted'; end if;
 update public.prompts set deleted_at=case when recover then null else now() end,updated_at=now() where id=pid;
 perform private.log_event(case when recover then 'prompt_restored' else 'prompt_deleted' end,p.owner_team_id,pid,'');
end $$;
create function public.copy_prompt(pid uuid, target_team_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare p public.prompts%rowtype; v public.prompt_versions%rowtype; new_id uuid; new_vid uuid;
begin
 if not private.can_read_prompt(pid) then raise exception 'No access to source prompt'; end if;
 if target_team_id is not null and not private.is_member(target_team_id) then
  raise exception 'Not a team member'; end if;
 select * into p from public.prompts where id=pid;
 select * into v from public.prompt_versions where id=p.official_version_id;
 if v.id is null then raise exception 'No official version to copy'; end if;
 insert into public.prompts(owner_user_id,owner_team_id,created_by,source_prompt_id)
 values(case when target_team_id is null then auth.uid() end,target_team_id,auth.uid(),pid)
 returning id into new_id;
 new_vid:=private.append_version(new_id,jsonb_build_object('title',v.title,'description',v.description,
 'content',v.content,'category',v.category,'tags',to_jsonb(v.tags),
 'usage_instructions',v.usage_instructions,'example_inputs',v.example_inputs,
 'expected_outputs',v.expected_outputs,'compatible_models',to_jsonb(v.compatible_models)),
 auth.uid(),'experimental','Copied from '||pid::text);
 update public.prompts set latest_version_id=new_vid,official_version_id=new_vid where id=new_id;
 perform private.log_event('prompt_copied',target_team_id,new_id,'Source '||pid::text);
 return new_id;
end $$;
create function public.propose_improvement(pid uuid, payload jsonb, explanation text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.prompts%rowtype; proposal_id uuid;
begin
 select * into p from public.prompts where id=pid and deleted_at is null;
 if p.id is null or p.owner_team_id is null or p.lifecycle<>'published'
   or not private.has_team() or private.is_member(p.owner_team_id)
   or not private.can_read_prompt(pid) then
  raise exception 'Only members of other teams can propose improvements'; end if;
 perform private.validate_body(payload);
 insert into public.improvement_proposals(prompt_id,author_id,proposed_content,rationale)
 values(pid,auth.uid(),payload,left(explanation,1000)) returning id into proposal_id;
 perform private.notify_team_managers(p.owner_team_id,'proposal','A new cross-team improvement proposal arrived',pid);
 perform private.log_event('proposal_submitted',p.owner_team_id,pid,'');
 return proposal_id;
end $$;
create function public.review_improvement_proposal(proposal_id uuid, accept boolean,
 reason text default '') returns uuid language plpgsql security definer set search_path = '' as $$
declare pr public.improvement_proposals%rowtype; p public.prompts%rowtype; vid uuid;
begin
 select * into pr from public.improvement_proposals where id=proposal_id for update;
 select * into p from public.prompts where id=pr.prompt_id and deleted_at is null for update;
 if p.id is null or not private.is_manager(p.owner_team_id) or pr.status not in ('open','under_review') then
   raise exception 'Only owning Team Managers can review open proposals'; end if;
 if accept then
   if exists(select 1 from public.prompt_versions v where v.id=p.latest_version_id
       and v.approval_status='under_review') then
     raise exception 'Review the currently pending version before accepting another proposal'; end if;
   vid:=private.append_version(p.id,pr.proposed_content,pr.author_id,
     'under_review','Accepted cross-team proposal: '||left(pr.rationale,300));
   update public.prompts set latest_version_id=vid,updated_at=now() where id=p.id;
 else
   if char_length(btrim(reason))<3 then raise exception 'Provide a rejection reason'; end if;
 end if;
 update public.improvement_proposals set status=case when accept then 'accepted' else 'rejected' end,
   decision_reason=left(reason,800),reviewed_at=now() where id=proposal_id;
 insert into public.notifications(recipient_id,kind,message,prompt_id)
 values(pr.author_id,'proposal_decision',case when accept then 'Your proposal was accepted for version review'
   else 'Your proposal was rejected: '||left(reason,120) end,p.id);
 perform private.log_event('proposal_reviewed',p.owner_team_id,p.id,
  case when accept then 'Accepted for review' else 'Rejected: '||reason end);
 return vid;
end $$;
create function public.create_team(team_name text, team_description text default '', first_manager uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare tid uuid;
begin
 if not private.is_admin() or first_manager is null or not exists(
    select 1 from public.profiles where id=first_manager) then
  raise exception 'Only an administrator can create a team with an existing manager'; end if;
 if length(btrim(team_name)) < 2 then raise exception 'Enter a team name'; end if;
 insert into public.teams(name,description) values(left(btrim(team_name),80),left(team_description,1000))
 returning id into tid;
 insert into public.team_members(team_id,user_id,role) values(tid,first_manager,'manager');
 perform private.log_event('team_created',tid,null,team_name);
 return tid;
end $$;
create function public.manage_team_member(tid uuid, uid uuid, operation text)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if not(private.is_admin() or private.is_manager(tid)) then raise exception 'Manager access required'; end if;
 if not exists(select 1 from public.profiles where id=uid) then raise exception 'No registered user with that ID'; end if;
 if operation='add' then
   insert into public.team_members(team_id,user_id,role) values(tid,uid,'member')
     on conflict(team_id,user_id) do nothing;
 elsif operation='remove' then
   if exists(select 1 from public.team_members where team_id=tid and user_id=uid and role='manager')
     and (select count(*) from public.team_members where team_id=tid and role='manager')<=1 then
    raise exception 'A team needs at least one manager'; end if;
   delete from public.team_members where team_id=tid and user_id=uid;
 else raise exception 'Invalid operation'; end if;
 perform private.log_event('membership_'||operation,tid,null,uid::text);
end $$;
create function public.set_team_manager(tid uuid, uid uuid, promote boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if not private.is_admin() then raise exception 'Only administrators can change manager roles'; end if;
 if not exists(select 1 from public.team_members where team_id=tid and user_id=uid) then
   raise exception 'Assign this user to the team first'; end if;
 if not promote and (select count(*) from public.team_members where team_id=tid and role='manager')<=1
   and exists(select 1 from public.team_members where team_id=tid and user_id=uid and role='manager') then
  raise exception 'A team needs at least one manager'; end if;
 update public.team_members set role=case when promote then 'manager' else 'member' end
 where team_id=tid and user_id=uid;
 perform private.log_event('manager_role_changed',tid,null,uid::text);
end $$;


-- Sharing a personal prompt creates a separate, published team-owned copy.
-- Personal content remains private; membership is required in the destination.
create function public.share_personal_prompt(pid uuid, target_team_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare p public.prompts%rowtype; new_id uuid;
begin
 select * into p from public.prompts where id=pid and deleted_at is null;
 if p.id is null or p.owner_user_id<>auth.uid() or target_team_id is null
   or not private.is_member(target_team_id) then
   raise exception 'Only your own personal prompt can be shared with one of your teams';
 end if;
 new_id:=public.copy_prompt(pid,target_team_id);
 update public.prompts set lifecycle='published' where id=new_id;
 perform private.log_event('personal_shared_to_team',target_team_id,new_id,'Source '||pid::text);
 return new_id;
end $$;

-- Only the listed exposed functions may be executed by signed-in users.
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin(),private.has_team(),private.is_member(uuid),
 private.is_manager(uuid),private.is_any_manager(),
 private.can_read_prompt(uuid),private.can_edit_prompt(uuid) to authenticated;
grant execute on function public.create_prompt(jsonb,uuid,boolean),
 public.save_prompt_version(uuid,jsonb,text), public.request_version_review(uuid),
 public.review_prompt_version(uuid,boolean,text),public.set_prompt_lifecycle(uuid,text),
 public.soft_delete_prompt(uuid,boolean),public.copy_prompt(uuid,uuid),
 public.propose_improvement(uuid,jsonb,text),public.review_improvement_proposal(uuid,boolean,text),
 public.create_team(text,text,uuid),public.manage_team_member(uuid,uuid,text),
 public.set_team_manager(uuid,uuid,boolean),
 public.share_personal_prompt(uuid,uuid) to authenticated;
