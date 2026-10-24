-- Promptfolio: invite-only signup with exact email allowlisting.
-- Run AFTER 001, 002 and 003 in the Supabase SQL Editor.
-- IMPORTANT: Run the verification and activation steps in SIGNUP_ALLOWLIST_SETUP.md.
-- This migration alone DOES NOT activate the hook in your hosted project.
-- The list starts empty: by default, all new account creation is denied once
-- the Before User Created hook is enabled. Existing users can still sign in.

-- Store approved email addresses OUTSIDE the public Data API schema.
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

-- Do not insert actual email addresses in this migration or a public GitHub
-- repository. Add/remove entries privately in Supabase SQL Editor instead.
-- Example (replace with an email you have verified and want to approve):
-- insert into promptfolio_security.allowed_signup_emails(email, note)
-- values (lower(btrim('approved@example.com')), 'Pilot tester')
-- on conflict (email) do nothing;
