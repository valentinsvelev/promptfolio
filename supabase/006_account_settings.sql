-- Let authenticated users change their own display name.
create or replace function public.update_my_display_name(new_display_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned text := btrim(coalesce(new_display_name, ''));
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to update your profile';
  end if;
  perform private.require_ready();
  if char_length(cleaned) < 2 or char_length(cleaned) > 80 then
    raise exception 'Name must be between 2 and 80 characters';
  end if;
  update public.profiles
     set display_name = cleaned
   where id = (select auth.uid());
  if not found then
    raise exception 'Profile not found';
  end if;
  return cleaned;
end;
$$;
revoke all on function public.update_my_display_name(text) from public, anon, authenticated;
grant execute on function public.update_my_display_name(text) to authenticated;
