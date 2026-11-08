-- Remove unused categories and allow admins to delete them.
create or replace function private.prune_unused_categories()
returns integer language plpgsql security definer set search_path = '' as $$
declare removed_count integer;
begin
  lock table public.prompt_versions, public.improvement_proposals in share mode;
  lock table public.prompt_categories in share row exclusive mode;
  with removed as (
    delete from public.prompt_categories c
    where not exists (
      select 1 from public.prompt_versions v
      where lower(btrim(v.category)) = lower(btrim(c.name))
    ) and not exists (
      select 1 from public.improvement_proposals p
      where lower(btrim(p.proposed_content->>'category')) = lower(btrim(c.name))
    )
    returning c.name
  )
  select count(*)::integer into removed_count from removed;
  return removed_count;
end $$;
revoke all on function private.prune_unused_categories() from public, anon, authenticated;

create or replace function public.delete_category(category_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare existing_name text;
begin
  perform private.require_ready();
  if not private.is_admin() then raise exception 'Administrator required'; end if;
  if category_name is null or btrim(category_name) = '' then
    raise exception 'Choose a category to delete';
  end if;
  lock table public.prompt_versions, public.improvement_proposals in share mode;
  lock table public.prompt_categories in share row exclusive mode;
  select name into existing_name from public.prompt_categories
    where name = btrim(category_name);
  if existing_name is null then raise exception 'Category not found'; end if;
  if exists (
    select 1 from public.prompt_versions v
    where lower(btrim(v.category)) = lower(btrim(existing_name))
  ) or exists (
    select 1 from public.improvement_proposals p
    where lower(btrim(p.proposed_content->>'category')) = lower(btrim(existing_name))
  ) then
    raise exception 'Category is in use by a saved version or improvement proposal';
  end if;
  delete from public.prompt_categories where name = existing_name;
  perform private.log_event('category_deleted', null, null, existing_name);
  return existing_name;
end $$;
revoke all on function public.delete_category(text) from public, anon, authenticated;
grant execute on function public.delete_category(text) to authenticated;

create or replace function public.delete_unused_categories()
returns integer language plpgsql security definer set search_path = '' as $$
declare removed_count integer;
begin
  perform private.require_ready();
  if not private.is_admin() then raise exception 'Administrator required'; end if;
  removed_count := private.prune_unused_categories();
  perform private.log_event('unused_categories_deleted', null, null, removed_count::text || ' unused categories');
  return removed_count;
end $$;
revoke all on function public.delete_unused_categories() from public, anon, authenticated;
grant execute on function public.delete_unused_categories() to authenticated;

-- One-time cleanup as part of installing this migration. Only unreferenced
-- category rows are removed; run it via the Supabase SQL Editor once.
select private.prune_unused_categories() as categories_removed;
