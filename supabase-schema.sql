create extension if not exists pgcrypto;

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  area text not null,
  category text not null,
  entry_date timestamptz not null,
  next_due_date timestamptz,
  repeat_interval_days integer check (repeat_interval_days is null or repeat_interval_days > 0),
  metadata jsonb not null default '{}'::jsonb,
  price numeric(12, 2),
  notes text,
  reminder_enabled boolean not null default false,
  reminder_time text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.entries
  add column if not exists repeat_interval_days integer
  check (repeat_interval_days is null or repeat_interval_days > 0);

alter table public.entries
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.entries
  drop constraint if exists entries_area_check;

alter table public.entries
  drop constraint if exists entries_category_check;

create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.entry_logs (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_date timestamptz not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.plan_sessions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_date timestamptz not null,
  session_type text not null check (session_type in ('learn', 'practice', 'habit', 'reflection')),
  title text not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'missed', 'rescheduled', 'skipped')),
  completed_at timestamptz,
  score integer check (score is null or (score >= 0 and score <= 100)),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null check (key in ('history_months')),
  value integer not null,
  primary key (user_id, key)
);

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

alter table public.entries enable row level security;
alter table public.entry_logs enable row level security;
alter table public.plan_sessions enable row level security;
alter table public.settings enable row level security;
alter table public.areas enable row level security;
alter table public.categories enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reminder_deliveries enable row level security;

create policy "Users can read their entries"
  on public.entries for select
  using (auth.uid() = user_id);

create policy "Users can create their entries"
  on public.entries for insert
  with check (auth.uid() = user_id);

create policy "Users can update their entries"
  on public.entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their entries"
  on public.entries for delete
  using (auth.uid() = user_id);

create policy "Users can read their logs"
  on public.entry_logs for select
  using (auth.uid() = user_id);

create policy "Users can create logs for their entries"
  on public.entry_logs for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.entries
      where entries.id = entry_logs.entry_id
        and entries.user_id = auth.uid()
    )
  );

create policy "Users can update their logs"
  on public.entry_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their logs"
  on public.entry_logs for delete
  using (auth.uid() = user_id);

create policy "Users can read their plan sessions"
  on public.plan_sessions for select
  using (auth.uid() = user_id);

create policy "Users can create sessions for their entries"
  on public.plan_sessions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.entries
      where entries.id = plan_sessions.entry_id
        and entries.user_id = auth.uid()
    )
  );

create policy "Users can update their plan sessions"
  on public.plan_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their plan sessions"
  on public.plan_sessions for delete
  using (auth.uid() = user_id);

create policy "Users can read their settings"
  on public.settings for select
  using (auth.uid() = user_id);

create policy "Users can upsert their settings"
  on public.settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their settings"
  on public.settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read their areas"
  on public.areas for select
  using (auth.uid() = user_id);

create policy "Users can create their areas"
  on public.areas for insert
  with check (auth.uid() = user_id);

create policy "Users can update their areas"
  on public.areas for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read their categories"
  on public.categories for select
  using (auth.uid() = user_id);

create policy "Users can create their categories"
  on public.categories for insert
  with check (auth.uid() = user_id);

create policy "Users can update their categories"
  on public.categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read their push subscriptions"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can create their push subscriptions"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their push subscriptions"
  on public.push_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their push subscriptions"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

create policy "Users can read their reminder deliveries"
  on public.reminder_deliveries for select
  using (auth.uid() = user_id);
