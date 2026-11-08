create table if not exists public.explore_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_tab text not null default 'All prompts',
  tab_order text[] not null default array[
    'All prompts', 'Personal', 'My teams', 'Other teams', 'Favorites'
  ]::text[],
  updated_at timestamptz not null default now(),
  constraint explore_default_tab_valid check (
    default_tab in ('All prompts', 'Personal', 'My teams', 'Other teams', 'Favorites')
  ),
  constraint explore_tab_order_valid check (
    cardinality(tab_order) = 5
    and tab_order @> array[
      'All prompts', 'Personal', 'My teams', 'Other teams', 'Favorites'
    ]::text[]
    and tab_order <@ array[
      'All prompts', 'Personal', 'My teams', 'Other teams', 'Favorites'
    ]::text[]
  )
);

alter table public.explore_preferences enable row level security;
revoke all on public.explore_preferences from anon;
revoke all on public.explore_preferences from authenticated;
grant select, insert, update on public.explore_preferences to authenticated;

-- Idempotent policies for re-applying this migration safely.
drop policy if exists "Read own explore preferences" on public.explore_preferences;
create policy "Read own explore preferences"
  on public.explore_preferences for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Insert own explore preferences" on public.explore_preferences;
create policy "Insert own explore preferences"
  on public.explore_preferences for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Update own explore preferences" on public.explore_preferences;
create policy "Update own explore preferences"
  on public.explore_preferences for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
