-- Admin category renaming, automatic category registration, and suffixes on personal duplicates.
create or replace function private.register_category_on_save()
returns trigger language plpgsql security definer set search_path = '' as $$
declare new_category text; creator uuid;
begin
  if TG_TABLE_NAME = 'prompt_versions' then
    new_category := btrim(NEW.category);
    creator := NEW.author_id;
  else
    new_category := btrim(coalesce(NEW.proposed_content->>'category','General'));
    creator := NEW.author_id;
  end if;
  if char_length(new_category) not between 2 and 70 then
    raise exception 'Category name must be 2 to 70 characters';
  end if;
  if not exists(select 1 from public.prompt_categories where lower(name)=lower(new_category)) then
    insert into public.prompt_categories(name,created_by)
    values(new_category,creator) on conflict (name) do nothing;
  end if;
  return NEW;
end $$;

create trigger prompt_version_register_category
  after insert on public.prompt_versions for each row
  execute function private.register_category_on_save();
create trigger prompt_proposal_register_category
  after insert on public.improvement_proposals for each row
  execute function private.register_category_on_save();

-- Category names are global metadata. Renaming them also updates historical
-- versions and unreviewed proposals; the content, approval state, and audit
-- records stay intact. Only app administrators can run this RPC.
create or replace function public.rename_category(old_name text, new_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare old_value text:=btrim(old_name); new_value text:=btrim(new_name);
begin
  perform private.require_ready();
  if not private.is_admin() then raise exception 'Administrator required'; end if;
  if char_length(new_value) not between 2 and 70 then
    raise exception 'Category name must be 2 to 70 characters';
  end if;
  lock table public.prompt_categories in share row exclusive mode;
  if not exists(select 1 from public.prompt_categories where name=old_value) then
    raise exception 'Category not found';
  end if;
  if exists(select 1 from public.prompt_categories where lower(name)=lower(new_value) and name<>old_value) then
    raise exception 'Another category already uses that name';
  end if;
  update public.prompt_categories set name=new_value where name=old_value;
  update public.prompt_versions set category=new_value where category=old_value;
  update public.improvement_proposals
    set proposed_content=jsonb_set(proposed_content,'{category}',to_jsonb(new_value),true)
    where proposed_content->>'category'=old_value;
  perform private.log_event('category_renamed',null,null,old_value||' -> '||new_value);
  return new_value;
end $$;
revoke all on function public.rename_category(text,text) from public, anon;
grant execute on function public.rename_category(text,text) to authenticated;

-- Duplicating into one's personal library appends " - copy". Shares into a
-- team keep their original title so ordinary sharing is unaffected.
create or replace function public.copy_prompt(pid uuid, target_team_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare p public.prompts%rowtype; v public.prompt_versions%rowtype; new_id uuid; new_vid uuid;
begin
  perform private.require_ready();
  if not private.can_read_prompt(pid) then raise exception 'No access to source prompt'; end if;
  if target_team_id is not null and not private.is_member(target_team_id) then
    raise exception 'Not a team member';
  end if;
  select * into p from public.prompts where id=pid and deleted_at is null;
  select * into v from public.prompt_versions where id=p.official_version_id;
  if v.id is null then raise exception 'No official version to copy'; end if;
  insert into public.prompts(owner_user_id,owner_team_id,created_by,source_prompt_id)
  values(case when target_team_id is null then auth.uid() end,target_team_id,auth.uid(),pid)
  returning id into new_id;
  new_vid:=private.append_version(new_id,jsonb_build_object(
    'title',case when target_team_id is null then left(v.title,143)||' - copy' else v.title end,
    'description',v.description,'content',v.content,'category',v.category,
    'tags',to_jsonb(v.tags),'usage_instructions',v.usage_instructions,
    'example_inputs',v.example_inputs,'expected_outputs',v.expected_outputs,
    'compatible_models',to_jsonb(v.compatible_models)),
    auth.uid(),'experimental','Copied from '||pid::text);
  update public.prompts set latest_version_id=new_vid,official_version_id=new_vid where id=new_id;
  perform private.log_event('prompt_copied',target_team_id,new_id,'Source '||pid::text);
  return new_id;
end $$;
revoke all on function public.copy_prompt(uuid,uuid) from public,anon;
grant execute on function public.copy_prompt(uuid,uuid) to authenticated;
