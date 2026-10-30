-- 010: Manager/admin-only team rename
create or replace function public.rename_team(tid uuid, new_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_name text;
  cleaned_name text := btrim(new_name);
begin
  perform private.require_ready();
  if not (private.is_admin() or private.is_manager(tid)) then
    raise exception 'Only a Team Manager or administrator can rename this team';
  end if;
  if cleaned_name is null or char_length(cleaned_name) not between 2 and 80 then
    raise exception 'Team name must be between 2 and 80 characters';
  end if;

  select name into previous_name
    from public.teams
    where id = tid and deleted_at is null
    for update;
  if not found then
    raise exception 'Team not found';
  end if;
  if previous_name = cleaned_name then
    return previous_name;
  end if;
  -- Reject names differing only in case, as well as exact UNIQUE collisions.
  if exists (
    select 1 from public.teams other
    where other.id <> tid and other.deleted_at is null
      and lower(other.name) = lower(cleaned_name)
  ) then
    raise exception 'That team name is already in use';
  end if;
  -- The existing teams.name UNIQUE constraint also handles concurrent renames.
  update public.teams set name = cleaned_name where id = tid;
  perform private.log_event('team_renamed', tid, null,
    format('From "%s" to "%s"', previous_name, cleaned_name));
  return cleaned_name;
end;
$$;

revoke all on function public.rename_team(uuid,text) from public, anon, authenticated;
grant execute on function public.rename_team(uuid,text) to authenticated;
