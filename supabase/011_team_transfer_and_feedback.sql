alter table public.improvement_proposals
  add column if not exists target_team_id uuid references public.teams(id);

-- Only the author may suggest transferring a prompt to a team they belong to.
-- The existing proposal still requires approval from the source manager.
create or replace function public.propose_improvement_with_team(
  pid uuid, payload jsonb, explanation text, target_team_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.prompts%rowtype; proposal_id uuid; chosen_team uuid:=target_team_id;
begin
  perform private.require_ready();
  select * into p from public.prompts where id=pid and deleted_at is null;
  if p.id is null or p.owner_team_id is null then
    raise exception 'Only team prompts can be suggested for reassignment';
  end if;
  if target_team_id is null then raise exception 'Choose a team'; end if;
  if target_team_id is distinct from p.owner_team_id then
    if not private.is_member(target_team_id) or not exists (
      select 1 from public.teams where id=target_team_id and deleted_at is null
    ) then raise exception 'You must be a member of the proposed destination team'; end if;
  end if;
  proposal_id := public.propose_improvement(pid,payload,explanation);
  if target_team_id is distinct from p.owner_team_id then
    update public.improvement_proposals set target_team_id=chosen_team
      where id=proposal_id;
    perform private.log_event('transfer_proposed',p.owner_team_id,pid,'Destination '||target_team_id::text);
  end if;
  return proposal_id;
end $$;

-- Existing personal owners can move their own prompt to one of their teams.
-- Saving the version and changing ownership happen in one transaction.
create or replace function public.save_personal_prompt_and_team(
  pid uuid, payload jsonb, note text, target_team_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.prompts%rowtype; vid uuid;
begin
  perform private.require_ready();
  select * into p from public.prompts where id=pid and deleted_at is null for update;
  if p.id is null or p.owner_user_id is distinct from auth.uid() or p.owner_team_id is not null then
    raise exception 'Only the owner can move a personal prompt';
  end if;
  if target_team_id is not null and (not private.is_member(target_team_id) or not exists (
    select 1 from public.teams where id=target_team_id and deleted_at is null
  )) then raise exception 'You must belong to the destination team'; end if;
  vid := public.save_prompt_version(pid,payload,note);
  if target_team_id is not null then
    update public.prompts set owner_user_id=null,owner_team_id=target_team_id,updated_at=now()
      where id=pid;
    perform private.log_event('prompt_transferred',target_team_id,pid,'Personal to team');
  end if;
  return vid;
end $$;

-- The proposal content is reviewed in the usual workflow. A team change can
-- only be accepted by a manager/admin authorised in BOTH the source and target
-- teams. This prevents a source manager from moving a prompt into a team they
-- do not control or a suggester from bypassing the approval process.
create or replace function public.review_improvement_proposal(
  proposal_id uuid, accept boolean, reason text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare pr public.improvement_proposals%rowtype; p public.prompts%rowtype; vid uuid;
begin
  perform private.require_ready();
  select * into pr from public.improvement_proposals where id=proposal_id for update;
  if pr.id is null then raise exception 'Proposal not found'; end if;
  select * into p from public.prompts where id=pr.prompt_id and deleted_at is null for update;
  if p.id is null or not (private.is_manager(p.owner_team_id) or private.is_admin())
      or pr.status not in ('open','under_review') then
    raise exception 'Only the owning Team Manager can review open proposals';
  end if;
  if accept then
    if pr.target_team_id is not null and pr.target_team_id is distinct from p.owner_team_id then
      if not exists(select 1 from public.teams where id=pr.target_team_id and deleted_at is null)
          or not (private.is_manager(pr.target_team_id) or private.is_admin()) then
        raise exception 'The reviewer must also manage the destination team to approve reassignment';
      end if;
    end if;
    if exists(select 1 from public.prompt_versions v where v.id=p.latest_version_id
      and v.approval_status='under_review') then
      raise exception 'Review the currently pending version before accepting another proposal';
    end if;
    vid:=private.append_version(p.id,pr.proposed_content,pr.author_id,
      'under_review','Accepted improvement proposal: '||left(pr.rationale,300));
    update public.prompts set latest_version_id=vid,updated_at=now() where id=p.id;
    if pr.target_team_id is not null and pr.target_team_id is distinct from p.owner_team_id then
      update public.prompts set owner_team_id=pr.target_team_id,owner_user_id=null where id=p.id;
      perform private.log_event('prompt_transferred',pr.target_team_id,p.id,'Approved from '||p.owner_team_id::text);
      perform private.notify_team_managers(pr.target_team_id,'review','A transferred prompt version needs approval',p.id);
    end if;
  else
    if char_length(btrim(reason))<3 then raise exception 'Provide a rejection reason'; end if;
  end if;
  update public.improvement_proposals
    set status=case when accept then 'accepted' else 'rejected' end,
    decision_reason=left(reason,800),reviewed_at=now()
    where id=proposal_id;
  insert into public.notifications(recipient_id,kind,message,prompt_id)
    values(pr.author_id,'proposal_decision',
      case when accept then 'Your proposal was accepted for version review'
      else 'Your proposal was rejected: '||left(reason,120) end,p.id);
  perform private.log_event('proposal_reviewed',p.owner_team_id,p.id,
    case when accept then 'Accepted for review' else 'Rejected: '||reason end);
  return vid;
end $$;

-- Submissions are reserved per authenticated user in 20-minute windows.
-- Only the Edge Function service role reads/writes this table.
create table if not exists public.github_issue_feedback_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket_start timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id,bucket_start)
);
alter table public.github_issue_feedback_limits enable row level security;
revoke all on public.github_issue_feedback_limits from public, anon, authenticated;
grant select,insert,delete on public.github_issue_feedback_limits to service_role;

revoke all on function public.propose_improvement_with_team(uuid,jsonb,text,uuid),
  public.save_personal_prompt_and_team(uuid,jsonb,text,uuid),
  public.review_improvement_proposal(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.propose_improvement_with_team(uuid,jsonb,text,uuid),
  public.save_personal_prompt_and_team(uuid,jsonb,text,uuid),
  public.review_improvement_proposal(uuid,boolean,text) to authenticated;
