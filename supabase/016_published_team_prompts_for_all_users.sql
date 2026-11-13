-- Published team prompts are discoverable by every active signed-in user.
begin;

-- This helper is used by prompt RLS, favorites, recommendations, and RPCs.
-- Preserve its SECURITY DEFINER and account-activation checks.
create or replace function private.can_read_prompt(pid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.account_usable() and exists (
    select 1 from public.prompts p
    where p.id = pid and p.deleted_at is null
      and (
        p.owner_user_id = (select auth.uid())
        or (p.owner_team_id is not null and private.is_member(p.owner_team_id))
        or (p.owner_team_id is not null
            and p.lifecycle = 'published'
            and p.official_version_id is not null)
      )
  );
$$;

-- Only a prompt's official version is public to nonmembers. Other versions,
-- including drafts/reviews/previous history, remain visible to team members.
drop policy if exists version_read on public.prompt_versions;
create policy version_read on public.prompt_versions for select to authenticated
using (
  private.account_usable()
  and exists (
    select 1 from public.prompts p
    where p.id = prompt_id
      and (
        p.deleted_at is null
        or (
          p.deleted_at >= now() - (
            (select retention_days from public.app_settings where id = true)::text || ' days'
          )::interval
          and private.can_edit_prompt(p.id)
        )
      )
      and (
        p.owner_user_id = (select auth.uid())
        or (p.owner_team_id is not null and private.is_member(p.owner_team_id))
        or (p.deleted_at is null
            and p.owner_team_id is not null
            and p.lifecycle = 'published'
            and public.prompt_versions.id = p.official_version_id)
      )
  )
);

-- Let authorized users also resolve the owning team's name, even when
-- they are not members of that team. No membership records are exposed.
drop policy if exists team_read on public.teams;
create policy team_read on public.teams for select to authenticated
using (
  private.account_usable()
  and deleted_at is null
  and (
    private.is_admin()
    or private.is_member(id)
    or exists (
      select 1 from public.prompts p
      where p.owner_team_id = public.teams.id
        and p.deleted_at is null
        and p.lifecycle = 'published'
        and p.official_version_id is not null
    )
  )
);

commit;
