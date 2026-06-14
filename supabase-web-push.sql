create extension if not exists pgcrypto;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  subscription jsonb not null,
  user_agent text,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create table if not exists public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id uuid not null references public.entries(id) on delete cascade,
  push_subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  reminder_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (entry_id, push_subscription_id, reminder_at)
);

alter table public.push_subscriptions enable row level security;
alter table public.reminder_deliveries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'Users can read their push subscriptions'
  ) then
    create policy "Users can read their push subscriptions"
      on public.push_subscriptions for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'Users can create their push subscriptions'
  ) then
    create policy "Users can create their push subscriptions"
      on public.push_subscriptions for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'Users can update their push subscriptions'
  ) then
    create policy "Users can update their push subscriptions"
      on public.push_subscriptions for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'Users can delete their push subscriptions'
  ) then
    create policy "Users can delete their push subscriptions"
      on public.push_subscriptions for delete
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reminder_deliveries' and policyname = 'Users can read their reminder deliveries'
  ) then
    create policy "Users can read their reminder deliveries"
      on public.reminder_deliveries for select
      using (auth.uid() = user_id);
  end if;
end $$;
