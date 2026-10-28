create schema if not exists promptfolio_security;
revoke all on schema promptfolio_security from public, anon, authenticated;

create table if not exists promptfolio_security.allowed_signup_emails (
  email text primary key,
  added_at timestamptz not null default now(),
  note text,
  constraint signup_email_normalized
    check (email = lower(btrim(email)) and length(email) >= 3 and position('@' in email) > 1)
);

-- Keep the allowlist off the API, even in projects with broad default grants.
revoke all on promptfolio_security.allowed_signup_emails from public, anon, authenticated;
alter table promptfolio_security.allowed_signup_emails enable row level security;

-- The Auth hook runs as this special database role, not as a regular app user.
grant usage on schema promptfolio_security to supabase_auth_admin;
grant select on promptfolio_security.allowed_signup_emails to supabase_auth_admin;

drop policy if exists "auth_hook_read_signup_allowlist"
  on promptfolio_security.allowed_signup_emails;
create policy "auth_hook_read_signup_allowlist"
  on promptfolio_security.allowed_signup_emails
  for select to supabase_auth_admin using (true);

-- IMPORTANT: An INVOKER hook with only the above grants is enough.
-- It does not require a privileged SECURITY DEFINER function.
create or replace function public.promptfolio_before_user_created(event jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  requested_email text := lower(btrim(coalesce(event->'user'->>'email', '')));
begin
  if requested_email <> '' and exists (
    select 1
    from promptfolio_security.allowed_signup_emails as a
    where a.email = requested_email
  ) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Registration is invite-only. Ask the Promptfolio administrator for access.'
    )
  );
end;
$$;

-- The function must be callable by Supabase Auth, not from browser RPCs.
revoke execute on function public.promptfolio_before_user_created(jsonb)
  from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.promptfolio_before_user_created(jsonb)
  to supabase_auth_admin;
