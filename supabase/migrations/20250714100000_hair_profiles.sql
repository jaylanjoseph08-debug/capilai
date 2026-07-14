-- Capil AI — hair profile + questionnaire answers synced per auth user (multi-device)

create table if not exists public.hair_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  profile jsonb,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hair_profiles_updated_at_idx
  on public.hair_profiles (updated_at desc);

alter table public.hair_profiles enable row level security;

drop policy if exists "Users can read own hair profile" on public.hair_profiles;
create policy "Users can read own hair profile"
  on public.hair_profiles
  for select
  using (auth.uid() = user_id);

-- Writes go through the service role API routes (same pattern as subscriptions).

create or replace function public.set_hair_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists hair_profiles_updated_at on public.hair_profiles;
create trigger hair_profiles_updated_at
  before update on public.hair_profiles
  for each row
  execute function public.set_hair_profiles_updated_at();
