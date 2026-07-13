-- Monthly hair scan usage counters per authenticated user

create table if not exists public.hair_scan_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  period_key text not null,
  scans_used integer not null default 0 check (scans_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, period_key)
);

create index if not exists hair_scan_usage_period_key_idx
  on public.hair_scan_usage (period_key);

alter table public.hair_scan_usage enable row level security;

drop policy if exists "Users can read own hair scan usage" on public.hair_scan_usage;
create policy "Users can read own hair scan usage"
  on public.hair_scan_usage
  for select
  using (auth.uid() = user_id);

-- Writes go through service role (API routes) only.

create or replace function public.set_hair_scan_usage_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists hair_scan_usage_updated_at on public.hair_scan_usage;
create trigger hair_scan_usage_updated_at
  before update on public.hair_scan_usage
  for each row
  execute function public.set_hair_scan_usage_updated_at();

create or replace function public.consume_hair_scan(
  p_user_id uuid,
  p_period_key text,
  p_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current integer;
  v_new integer;
begin
  insert into public.hair_scan_usage (user_id, period_key, scans_used)
  values (p_user_id, p_period_key, 0)
  on conflict (user_id, period_key) do nothing;

  select scans_used into v_current
  from public.hair_scan_usage
  where user_id = p_user_id and period_key = p_period_key
  for update;

  if p_limit is not null and v_current >= p_limit then
    return jsonb_build_object(
      'allowed', false,
      'scans_used', v_current,
      'scans_limit', p_limit
    );
  end if;

  update public.hair_scan_usage
  set scans_used = scans_used + 1
  where user_id = p_user_id and period_key = p_period_key
  returning scans_used into v_new;

  return jsonb_build_object(
    'allowed', true,
    'scans_used', v_new,
    'scans_limit', p_limit
  );
end;
$$;

revoke all on function public.consume_hair_scan(uuid, text, integer) from public;
grant execute on function public.consume_hair_scan(uuid, text, integer) to service_role;
