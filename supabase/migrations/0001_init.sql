-- MicroManus initial schema
-- Run via Supabase MCP (apply_migration) or SQL editor.

-- ============ profiles ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  credits integer not null default 0,
  paywall_passed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: own read" on public.profiles
  for select using (auth.uid() = id);

-- writes go through service role only (credit grants/deductions)

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- atomic credit consumption; returns remaining credits or -1 if insufficient
create or replace function public.consume_credit(p_user_id uuid, p_amount integer default 1)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  remaining integer;
begin
  update public.profiles
     set credits = credits - p_amount, updated_at = now()
   where id = p_user_id and credits >= p_amount
   returning credits into remaining;
  if not found then
    return -1;
  end if;
  return remaining;
end;
$$;

-- ============ api_configs (user's LLM key & endpoint) ============
create table if not exists public.api_configs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  base_url text not null,
  api_key_encrypted text not null, -- AES-256-GCM, never stored in plaintext
  default_model text not null,
  updated_at timestamptz not null default now()
);

alter table public.api_configs enable row level security;
create policy "api_configs: own read" on public.api_configs
  for select using (auth.uid() = user_id);
-- inserts/updates via server (service role) after encryption

-- ============ chats ============
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  model text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chats enable row level security;
create policy "chats: own all" on public.chats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists chats_user_idx on public.chats (user_id, updated_at desc);

-- ============ messages ============
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','tool','system')),
  content jsonb not null, -- {text, tool_calls?, tool_call_id?, steps?}
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;
create policy "messages: own all" on public.messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists messages_chat_idx on public.messages (chat_id, created_at asc);

-- ============ usage_events (per LLM call, for cost & stats) ============
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chat_id uuid references public.chats(id) on delete set null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cached_tokens integer not null default 0,
  cost_input_usd numeric(12,8) not null default 0,
  cost_output_usd numeric(12,8) not null default 0,
  cost_cached_usd numeric(12,8) not null default 0,
  cost_total_usd numeric(12,8) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.usage_events enable row level security;
create policy "usage: own read" on public.usage_events
  for select using (auth.uid() = user_id);
-- inserted by server (service role)

create index if not exists usage_chat_idx on public.usage_events (chat_id);
create index if not exists usage_user_idx on public.usage_events (user_id, created_at desc);

-- ============ payments ============
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'razorpay',
  order_id text not null,
  payment_id text,
  amount integer not null, -- smallest currency unit
  currency text not null,
  status text not null default 'created', -- created | paid | failed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments enable row level security;
create policy "payments: own read" on public.payments
  for select using (auth.uid() = user_id);

create unique index if not exists payments_order_idx on public.payments (order_id);

-- ============ coupon_redemptions ============
create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now(),
  unique (user_id, code)
);

alter table public.coupon_redemptions enable row level security;
create policy "coupons: own read" on public.coupon_redemptions
  for select using (auth.uid() = user_id);

-- ============ artifacts (generated PDFs) ============
create table if not exists public.artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chat_id uuid references public.chats(id) on delete cascade,
  filename text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.artifacts enable row level security;
create policy "artifacts: own read" on public.artifacts
  for select using (auth.uid() = user_id);

-- storage bucket for artifacts (private)
insert into storage.buckets (id, name, public)
values ('artifacts', 'artifacts', false)
on conflict (id) do nothing;
