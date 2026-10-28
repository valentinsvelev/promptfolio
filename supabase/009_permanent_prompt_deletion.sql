-- Permanent deletion of prompts from Trash.
create or replace function public.permanently_delete_prompt(pid uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.prompts%rowtype;
begin
  perform private.require_ready();
  select * into p from public.prompts where id=pid for update;
  if p.id is null or p.deleted_at is null then
    raise exception 'Only prompts already in Trash can be permanently deleted';
  end if;
  if not (
    p.owner_user_id=auth.uid() or
    (p.owner_team_id is not null and (private.is_manager(p.owner_team_id) or private.is_admin()))
  ) then
    raise exception 'Only the owner or an authorised team manager may permanently delete this prompt';
  end if;

  -- Keep independent copies and audit metadata, but detach references to this prompt.
  update public.prompts set source_prompt_id=null where source_prompt_id=pid;
  update public.notifications set prompt_id=null where prompt_id=pid;
  update public.audit_events set prompt_id=null where prompt_id=pid;
  delete from public.improvement_proposals where prompt_id=pid;
  -- Favorites and team recommendations are removed by ON DELETE CASCADE.

  -- Clear circular/composite version pointers before deleting prompt versions.
  update public.prompts set latest_version_id=null, official_version_id=null where id=pid;
  delete from public.prompt_versions where prompt_id=pid;
  delete from public.prompts where id=pid;
  perform private.log_event('prompt_permanently_deleted',p.owner_team_id,null,
    'Removed prompt ' || pid::text);
end $$;
revoke all on function public.permanently_delete_prompt(uuid) from public, anon, authenticated;
grant execute on function public.permanently_delete_prompt(uuid) to authenticated;
