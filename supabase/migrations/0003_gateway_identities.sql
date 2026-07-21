-- Gateway: channel identities, link codes, PATs, device pairings
-- Service-role writes; users can read own rows where useful.

-- External surface identity → MM user
create table if not exists public.channel_identities (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  external_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, external_id)
);

create index if not exists channel_identities_user_idx
  on public.channel_identities (user_id);

alter table public.channel_identities enable row level security;

create policy "channel_identities: own read"
  on public.channel_identities for select
  using (auth.uid() = user_id);

-- Short-lived codes for linking Discord/WA (owner generates on web)
create table if not exists public.link_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists link_codes_user_idx on public.link_codes (user_id);

alter table public.link_codes enable row level security;

create policy "link_codes: own read"
  on public.link_codes for select
  using (auth.uid() = user_id);

-- Personal access tokens (CLI / connector → MM capabilities only)
create table if not exists public.personal_access_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  token_prefix text not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists pats_user_idx on public.personal_access_tokens (user_id);

alter table public.personal_access_tokens enable row level security;

create policy "pats: own read"
  on public.personal_access_tokens for select
  using (auth.uid() = user_id);

-- Device pairings for standalone host (Context B)
create table if not exists public.device_pairings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'device',
  device_secret_hash text not null unique,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.device_pairings enable row level security;

create policy "device_pairings: own read"
  on public.device_pairings for select
  using (auth.uid() = user_id);
