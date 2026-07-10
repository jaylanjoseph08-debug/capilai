-- Capil AI — persistent Stripe subscriptions linked to Supabase Auth users
-- Run in Supabase SQL Editor or via CLI.

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'premium', 'pro')),
  status text not null default 'inactive' check (
    status in ('active', 'trialing', 'lifetime', 'canceled', 'past_due', 'unpaid', 'inactive')
  ),
  billing_cycle text check (billing_cycle in ('monthly', 'annual')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_stripe_customer_id_idx
  on public.subscriptions (stripe_customer_id);

create index if not exists subscriptions_stripe_subscription_id_idx
  on public.subscriptions (stripe_subscription_id);

alter table public.subscriptions enable row level security;

drop policy if exists "Users can read own subscription" on public.subscriptions;
create policy "Users can read own subscription"
  on public.subscriptions
  for select
  using (auth.uid() = user_id);

-- Service role (webhook) bypasses RLS. No insert/update policy for authenticated users.

create or replace function public.set_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row
  execute function public.set_subscriptions_updated_at();

create or replace function public.get_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

revoke all on function public.get_user_id_by_email(text) from public;
grant execute on function public.get_user_id_by_email(text) to service_role;
