-- Store each user's Listify preference in Supabase.
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  listified boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

revoke all on public.user_preferences from anon;
revoke all on public.user_preferences from authenticated;
grant select, insert, update on public.user_preferences to authenticated;

create policy "Read own preferences"
  on public.user_preferences for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Insert own preferences"
  on public.user_preferences for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Update own preferences"
  on public.user_preferences for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
