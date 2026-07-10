-- Guest checkouts (before account creation) — linked on signup/login by email.

create table if not exists public.pending_subscriptions (
  email text primary key,
  plan text not null check (plan in ('free', 'premium', 'pro')),
  status text not null default 'active' check (
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

create index if not exists pending_subscriptions_stripe_customer_id_idx
  on public.pending_subscriptions (stripe_customer_id);

alter table public.pending_subscriptions enable row level security;

create or replace function public.set_pending_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pending_subscriptions_updated_at on public.pending_subscriptions;
create trigger pending_subscriptions_updated_at
  before update on public.pending_subscriptions
  for each row
  execute function public.set_pending_subscriptions_updated_at();
