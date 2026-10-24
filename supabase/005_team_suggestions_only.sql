-- Promptfolio: suggestions-only edits for existing team-owned prompts.
-- Run AFTER migrations 001..004. Applies to both team members and cross-team viewers.
-- Personal prompts remain directly editable by their owner.
-- Existing proposed versions remain available for managers to review.

create or replace function public.save_prompt_version(pid uuid, payload jsonb, note text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.prompts%rowtype; vid uuid; approved boolean; pending boolean;
begin
 perform private.require_ready();
 select * into p from public.prompts where id=pid and deleted_at is null for update;
 if p.owner_team_id is not null then
   raise exception 'Team prompt changes must be submitted as improvement proposals for manager review';
 end if;
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

create or replace function public.restore_prompt_version(pid uuid, source_version_id uuid, note text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.prompts%rowtype; v public.prompt_versions%rowtype; vid uuid; existing text;
begin
 perform private.require_ready();
 select * into p from public.prompts where id=pid and deleted_at is null for update;
 if p.owner_team_id is not null then
   raise exception 'Team prompt changes must be submitted as improvement proposals for manager review';
 end if;
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

create or replace function public.propose_improvement(pid uuid, payload jsonb, explanation text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.prompts%rowtype; proposal_id uuid;
begin
 perform private.require_ready();
 select * into p from public.prompts where id=pid and deleted_at is null;
 if p.id is null or p.owner_team_id is null or p.lifecycle not in ('published','draft')
   or not private.can_read_prompt(pid)
   or not (private.is_member(p.owner_team_id) or
     (p.lifecycle='published' and private.has_team())) then
   raise exception 'You need access to this team prompt to propose an improvement';
 end if;
 perform private.validate_body(payload);
 insert into public.improvement_proposals(prompt_id,author_id,proposed_content,rationale)
 values(pid,auth.uid(),payload,left(explanation,1000)) returning id into proposal_id;
 perform private.notify_team_managers(p.owner_team_id,'proposal','A team prompt improvement has been suggested',pid);
 perform private.log_event('proposal_submitted',p.owner_team_id,pid,'');
 return proposal_id;
end $$;

-- Keep these privileged RPCs callable only by authenticated users;
-- their SECURITY DEFINER bodies enforce both account state and prompt ownership.
revoke execute on function public.save_prompt_version(uuid,jsonb,text),
 public.restore_prompt_version(uuid,uuid,text),public.propose_improvement(uuid,jsonb,text)
 from public,anon;
grant execute on function public.save_prompt_version(uuid,jsonb,text),
 public.restore_prompt_version(uuid,uuid,text),public.propose_improvement(uuid,jsonb,text)
 to authenticated;

-- Let authorised team members resolve the original creator's display name
-- on Published team prompts even after the official version changes author.
-- RLS still hides unrelated profiles from users without team membership.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or
 (private.account_usable() and (private.is_admin() or private.is_any_manager()
  or (private.has_team() and exists(select 1 from public.team_members m
    where m.user_id=public.profiles.id and private.is_member(m.team_id)))
  or (private.has_team() and exists(select 1 from public.prompts p
    join public.prompt_versions v on v.id=p.official_version_id
    where v.author_id=public.profiles.id and p.lifecycle='published'
    and p.owner_team_id is not null and p.deleted_at is null))
  or (private.has_team() and exists(select 1 from public.prompts p
    where p.created_by=public.profiles.id and p.lifecycle='published'
    and p.owner_team_id is not null and p.deleted_at is null)))));
