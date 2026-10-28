create table if not exists public.app_settings (
  id boolean primary key default true check(id),
  retention_days int not null default 30 check(retention_days between 1 and 365),
  temporary_password_hours int not null default 48 check(temporary_password_hours between 1 and 168),
  updated_at timestamptz not null default now()
);
insert into public.app_settings(id) values(true) on conflict do nothing;
create table if not exists public.account_controls (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  disabled boolean not null default false,
  must_change_password boolean not null default false,
  temporary_password_expires_at timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists public.prompt_categories (
  name text primary key check(length(btrim(name)) between 2 and 70),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
insert into public.prompt_categories(name) values ('Writing'),('Research'),('Analysis'),('Engineering'),('Marketing'),('Productivity'),('General') on conflict do nothing;
create table if not exists public.team_recommendations (
  team_id uuid not null references public.teams(id),
  prompt_id uuid primary key references public.prompts(id) on delete cascade,
  recommended_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.teams add column if not exists deleted_at timestamptz;
alter table public.app_settings enable row level security;
alter table public.account_controls enable row level security;
alter table public.prompt_categories enable row level security;
alter table public.team_recommendations enable row level security;
grant select on public.app_settings,public.account_controls,public.prompt_categories,public.team_recommendations to authenticated;
create policy settings_read on public.app_settings for select to authenticated using(true);
create policy account_control_read on public.account_controls for select to authenticated using(user_id=auth.uid() or private.is_admin());
create policy categories_read on public.prompt_categories for select to authenticated using(true);
create policy recommendations_read on public.team_recommendations for select to authenticated using(private.can_read_prompt(prompt_id));

create function private.account_usable() returns boolean language sql stable security definer set search_path = '' as $$
 select not exists(select 1 from public.account_controls c where c.user_id=auth.uid()
   and (c.disabled or c.must_change_password));
$$;
grant execute on function private.account_usable() to authenticated;
-- Prevent accounts awaiting a compulsory password change from reading company data,
-- including via direct REST requests. Password change uses an Edge Function.
drop policy if exists prompt_read on public.prompts;
create policy prompt_read on public.prompts for select to authenticated using(private.account_usable() and
 ((deleted_at is null and private.can_read_prompt(id)) or
 (deleted_at >= now() - ((select retention_days from public.app_settings where id=true)::text || ' days')::interval and private.can_edit_prompt(id))));
drop policy if exists version_read on public.prompt_versions;
create policy version_read on public.prompt_versions for select to authenticated using(private.account_usable() and exists(
 select 1 from public.prompts p where p.id=prompt_id and
 (p.deleted_at is null or (p.deleted_at >= now() - ((select retention_days from public.app_settings where id=true)::text || ' days')::interval
       and private.can_edit_prompt(p.id))) and
 (p.owner_user_id=auth.uid() or (p.owner_team_id is not null and private.is_member(p.owner_team_id))
  or (p.lifecycle='published' and p.owner_team_id is not null and public.prompt_versions.id=p.official_version_id and private.has_team()))));
drop policy if exists team_read on public.teams;
create policy team_read on public.teams for select to authenticated using(private.account_usable() and deleted_at is null and
 (private.is_admin() or (private.has_team() and (private.is_member(id) or exists (
   select 1 from public.prompts p where p.owner_team_id=public.teams.id and p.lifecycle='published'
   and p.deleted_at is null and p.official_version_id is not null)))));
-- Profiles and team membership data must not leak during compulsory password change.
drop policy if exists member_read on public.team_members;
create policy member_read on public.team_members for select to authenticated using(private.account_usable() and
 (private.is_admin() or private.is_member(team_id)));
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or
 (private.account_usable() and (private.is_admin() or private.is_any_manager()
  or (private.has_team() and exists(select 1 from public.team_members m
    where m.user_id=public.profiles.id and private.is_member(m.team_id)))
  or (private.has_team() and exists(select 1 from public.prompts p
    join public.prompt_versions v on v.id=p.official_version_id
    where v.author_id=public.profiles.id and p.lifecycle='published'
    and p.owner_team_id is not null and p.deleted_at is null)))));

-- Every exposed mutation below requires an active, fully activated account.
-- Existing functions from 001 are also guarded through a dedicated SQL entry check
-- in the next deploy of 001 or by restricting their EXECUTE privileges while locked.
create function private.require_ready() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.account_usable() then
   raise exception 'Account disabled or password change required';
 end if;
end $$;

create function public.update_app_settings(days int, password_hours int) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_ready();
 if not private.is_admin() then raise exception 'Administrator required'; end if;
 update public.app_settings set retention_days=days,temporary_password_hours=password_hours,updated_at=now() where id=true;
 perform private.log_event('settings_changed',null,null,format('retention=%s temp_hours=%s',days,password_hours));
end $$;
create function public.create_category(category_name text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_ready();
 if length(btrim(category_name)) not between 2 and 70 then raise exception 'Category length invalid'; end if;
 insert into public.prompt_categories(name,created_by) values(initcap(btrim(category_name)),auth.uid()) on conflict do nothing;
 perform private.log_event('category_created',null,null,category_name);
end $$;
create function public.remove_team(tid uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_ready();
 if not private.is_admin() then raise exception 'Administrator required'; end if;
 if not exists(select 1 from public.teams where id=tid and deleted_at is null) then raise exception 'Team not found'; end if;
 -- Keep prompt/version/audit history intact; archive team-owned prompts and revoke membership.
 update public.prompts set lifecycle='archived',updated_at=now() where owner_team_id=tid;
 delete from public.team_members where team_id=tid;
 update public.teams set deleted_at=now() where id=tid;
 perform private.log_event('team_removed',tid,null,'Team disabled, prompts archived, members removed');
end $$;
create function public.set_proposal_under_review(proposal_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare t uuid;
begin
 perform private.require_ready();
 select p.owner_team_id into t from public.improvement_proposals i join public.prompts p on p.id=i.prompt_id
 where i.id=proposal_id and i.status='open' for update of i;
 if t is null or not private.is_manager(t) then raise exception 'Only owning Team Managers may review open proposals'; end if;
 update public.improvement_proposals set status='under_review' where id=proposal_id;
 perform private.log_event('proposal_in_review',t,null,proposal_id::text);
end $$;
create function public.restore_prompt_version(pid uuid, source_version_id uuid, note text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.prompts%rowtype; v public.prompt_versions%rowtype; vid uuid; existing text;
begin
 perform private.require_ready();
 select * into p from public.prompts where id=pid and deleted_at is null for update;
 if p.id is null or not private.can_edit_prompt(pid) then raise exception 'Cannot restore prompt'; end if;
 select * into v from public.prompt_versions where id=source_version_id and prompt_id=pid;
 if v.id is null then raise exception 'Version must belong to this prompt'; end if;
 update public.prompt_versions set approval_status='deprecated',decision='rejected',decision_reason='Superseded by restored version'
 where id=p.latest_version_id and approval_status='under_review';
 select approval_status into existing from public.prompt_versions where id=p.official_version_id;
 vid:=private.append_version(pid,jsonb_build_object('title',v.title,'description',v.description,
  'content',v.content,'category',v.category,'tags',to_jsonb(v.tags),
  'usage_instructions',v.usage_instructions,'example_inputs',v.example_inputs,
  'expected_outputs',v.expected_outputs,'compatible_models',to_jsonb(v.compatible_models)),auth.uid(),
  case when p.owner_team_id is not null and existing='approved' then 'under_review' else 'experimental' end,
  'Restored from v'||v.version_number||': '||left(note,500));
 update public.prompts set latest_version_id=vid,updated_at=now() where id=pid;
 if p.owner_user_id is not null or coalesce(existing,'') <> 'approved' then
   update public.prompts set official_version_id=vid where id=pid;
 end if;
 if p.owner_team_id is not null and existing='approved' then
   perform private.notify_team_managers(p.owner_team_id,'review','An older version was restored for approval',pid);
 end if;
 perform private.log_event('version_restored',p.owner_team_id,pid,'From version '||v.version_number);
 return vid;
end $$;
create function public.deprecate_team_prompt(pid uuid, reason text) returns void language plpgsql
security definer set search_path='' as $$
declare p public.prompts%rowtype;
begin
 perform private.require_ready();
 select * into p from public.prompts where id=pid and deleted_at is null for update;
 if p.id is null or p.owner_team_id is null or not private.is_manager(p.owner_team_id) then
  raise exception 'Only the owning Team Manager can deprecate a prompt'; end if;
 if length(btrim(reason)) < 3 then raise exception 'Provide a reason'; end if;
 update public.prompt_versions set approval_status='deprecated',decision_reason=left(reason,800)
 where id=p.official_version_id;
 update public.prompts set lifecycle='archived',updated_at=now() where id=pid;
 perform private.log_event('prompt_deprecated',p.owner_team_id,pid,reason);
end $$;
create function public.set_team_recommendation(pid uuid, recommend boolean) returns void language plpgsql
security definer set search_path='' as $$
declare p public.prompts%rowtype;
begin
 perform private.require_ready();
 select * into p from public.prompts where id=pid and deleted_at is null;
 if p.id is null or p.owner_team_id is null or not private.is_manager(p.owner_team_id)
  or p.lifecycle<>'published' then raise exception 'Manager access to published team prompt required'; end if;
 if recommend then
   insert into public.team_recommendations(team_id,prompt_id,recommended_by)
   values(p.owner_team_id,pid,auth.uid()) on conflict(prompt_id) do nothing;
 else delete from public.team_recommendations where prompt_id=pid;
 end if;
 perform private.log_event('recommendation_changed',p.owner_team_id,pid,recommend::text);
end $$;
-- Permit notification read status updates only through a narrow RPC.
create function public.mark_notification_read(nid uuid default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_ready();
 update public.notifications set read_at=now() where recipient_id=auth.uid() and read_at is null
  and (nid is null or id=nid);
end $$;

-- Fix edited published experimental prompts: the official pointer should move forward
-- whenever there is no protected approved version; pending approved versions remain frozen.
create or replace function public.save_prompt_version(pid uuid, payload jsonb, note text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.prompts%rowtype; vid uuid; approved boolean; pending boolean;
begin
 perform private.require_ready();
 select * into p from public.prompts where id=pid and deleted_at is null for update;
 if not found or not private.can_edit_prompt(pid) then raise exception 'No editing access'; end if;
 select (approval_status='approved') into approved from public.prompt_versions where id=p.official_version_id;
 select (approval_status='under_review') into pending from public.prompt_versions where id=p.latest_version_id;
 if pending then
   update public.prompt_versions set approval_status='deprecated',decision='rejected',decision_reason='Superseded by a newer proposed version'
   where id=p.latest_version_id;
 end if;
 vid:=private.append_version(pid,payload,auth.uid(),
   case when coalesce(approved,false) or coalesce(pending,false) then 'under_review' else 'experimental' end,note);
 update public.prompts set latest_version_id=vid,updated_at=now() where id=pid;
 if not coalesce(approved,false) then update public.prompts set official_version_id=vid where id=pid; end if;
 if (approved or pending) and p.owner_team_id is not null then
   perform private.notify_team_managers(p.owner_team_id,'review','A proposed version needs approval',pid);
 end if;
 perform private.log_event('version_saved',p.owner_team_id,pid,note);
 return vid;
end $$;

-- Protect legacy RPCs against bypassing forced-change state through the REST API.
-- After creation all 001 public RPCs run through this wrapper check using a schema-level
-- SECURITY DEFINER authorization probe. The app should never treat UI-only gating as sufficient.
-- Enforce active-user status by replacing the permission helpers used by legacy RPCs.
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select private.account_usable() and exists(select 1 from public.app_admins where user_id=auth.uid())
$$;
create or replace function private.is_manager(t uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.account_usable() and exists(select 1 from public.team_members where team_id=t and user_id=auth.uid() and role='manager')
$$;
create or replace function private.is_member(t uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.account_usable() and exists(select 1 from public.team_members where team_id=t and user_id=auth.uid())
$$;
create or replace function private.has_team() returns boolean language sql stable security definer set search_path='' as $$
 select private.account_usable() and exists(select 1 from public.team_members where user_id=auth.uid())
$$;
create or replace function private.can_edit_prompt(pid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.account_usable() and exists(select 1 from public.prompts p where p.id=pid
   and (p.owner_user_id=auth.uid() or (p.owner_team_id is not null and private.is_member(p.owner_team_id))))
$$;
create or replace function private.can_read_prompt(pid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.account_usable() and exists(select 1 from public.prompts p where p.id=pid and p.deleted_at is null
   and (p.owner_user_id=auth.uid() or (p.owner_team_id is not null and private.is_member(p.owner_team_id))
        or (p.owner_team_id is not null and p.lifecycle='published' and p.official_version_id is not null and private.has_team())))
$$;
-- A no-team user still can create personal prompts; legacy create_prompt did not call permission checks.
create or replace function public.create_prompt(payload jsonb, team_id uuid default null,
 publish boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); pid uuid; vid uuid;
begin
 perform private.require_ready();
 if team_id is not null and not private.is_member(team_id) then raise exception 'Not a member of this team'; end if;
 perform private.validate_body(payload);
 insert into public.prompts(owner_user_id,owner_team_id,created_by,lifecycle)
 values(case when team_id is null then uid end,team_id,uid,case when publish then 'published' else 'draft' end) returning id into pid;
 vid:=private.append_version(pid,payload,uid,'experimental','Created prompt');
 update public.prompts set official_version_id=vid,latest_version_id=vid where id=pid;
 perform private.log_event('prompt_created',team_id,pid,'');return pid;
end $$;
-- Additional 001 mutations are protected through private.can_edit_prompt / private.can_read_prompt /
-- private.is_member / private.is_manager / private.is_admin and their existing checks.
-- User-specific favorite policies still require private.can_read_prompt.

revoke all on all functions in schema public from public,anon,authenticated;
grant execute on function public.create_prompt(jsonb,uuid,boolean),public.save_prompt_version(uuid,jsonb,text),
 public.request_version_review(uuid),public.review_prompt_version(uuid,boolean,text),
 public.set_prompt_lifecycle(uuid,text),public.soft_delete_prompt(uuid,boolean),public.copy_prompt(uuid,uuid),
 public.propose_improvement(uuid,jsonb,text),public.review_improvement_proposal(uuid,boolean,text),
 public.create_team(text,text,uuid),public.manage_team_member(uuid,uuid,text),
 public.set_team_manager(uuid,uuid,boolean),public.share_personal_prompt(uuid,uuid),
 public.create_category(text),public.update_app_settings(int,int),public.remove_team(uuid),
 public.set_proposal_under_review(uuid),public.restore_prompt_version(uuid,uuid,text),
 public.deprecate_team_prompt(uuid,text),public.set_team_recommendation(uuid,boolean),
 public.mark_notification_read(uuid) to authenticated;

-- Match soft-deletion recovery enforcement to the configured retention period.
create or replace function public.soft_delete_prompt(pid uuid, recover boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare p public.prompts%rowtype; days int;
begin
 perform private.require_ready();
 select * into p from public.prompts where id=pid for update;
 if p.id is null or not private.can_edit_prompt(pid) then raise exception 'No editing access'; end if;
 select retention_days into days from public.app_settings where id=true;
 if recover and (p.deleted_at is null or p.deleted_at < now() - (days::text || ' days')::interval) then
   raise exception 'Recovery window expired or prompt is not deleted'; end if;
 update public.prompts set deleted_at=case when recover then null else now() end,updated_at=now() where id=pid;
 perform private.log_event(case when recover then 'prompt_restored' else 'prompt_deleted' end,p.owner_team_id,pid,'');
end $$;
-- Deprecated prompts cannot be made public again without a new approved version.
create or replace function public.set_prompt_lifecycle(pid uuid,new_status text) returns void
language plpgsql security definer set search_path='' as $$
declare p public.prompts%rowtype; approval text;
begin
 perform private.require_ready();
 select * into p from public.prompts where id=pid and deleted_at is null for update;
 if p.id is null or not private.can_edit_prompt(pid) or new_status not in ('draft','published','archived') then
   raise exception 'Cannot change prompt lifecycle'; end if;
 select approval_status into approval from public.prompt_versions where id=p.official_version_id;
 if new_status='published' and approval='deprecated' then
   raise exception 'A deprecated prompt must receive a newly approved version before republishing';end if;
 update public.prompts set lifecycle=new_status,updated_at=now() where id=pid;
 perform private.log_event('lifecycle_changed',p.owner_team_id,pid,new_status);
end $$;
