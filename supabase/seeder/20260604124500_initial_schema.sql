create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  plan text not null default 'free',
  subscription_status text not null default 'inactive',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  make text not null,
  model text not null,
  year int not null,
  engine text,
  plate text,
  vin text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scan_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  adapter_name text,
  adapter_address text,
  obd_protocol text,
  battery_voltage numeric,
  status text not null default 'open',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.live_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.scan_sessions(id) on delete cascade,
  pid text not null,
  name text not null,
  value numeric not null,
  unit text not null,
  raw_response text,
  recorded_at timestamptz not null default now()
);

create table if not exists public.dtc_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.scan_sessions(id) on delete cascade,
  code text not null,
  description text,
  status text not null,
  raw_response text,
  cleared boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.scan_sessions(id) on delete cascade,
  summary text,
  pdf_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicle_fingerprints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  session_id uuid references public.scan_sessions(id) on delete set null,
  vin text,
  protocol text,
  supported_pids_01 text,
  supported_pids_21 text,
  calibration_ids text[] not null default '{}',
  cvns text[] not null default '{}',
  ecu_names text[] not null default '{}',
  likely_make text,
  likely_model text,
  likely_year int,
  confidence text not null default 'none',
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.scan_sessions enable row level security;
alter table public.live_readings enable row level security;
alter table public.dtc_codes enable row level security;
alter table public.reports enable row level security;
alter table public.vehicle_fingerprints enable row level security;

create policy "profiles_select_own" on public.profiles for select using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles for insert with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "vehicles_select_own" on public.vehicles for select using (user_id = auth.uid());
create policy "vehicles_insert_own" on public.vehicles for insert with check (user_id = auth.uid());
create policy "vehicles_update_own" on public.vehicles for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "vehicles_delete_own" on public.vehicles for delete using (user_id = auth.uid());

create policy "scan_sessions_select_own" on public.scan_sessions for select using (user_id = auth.uid());
create policy "scan_sessions_insert_own" on public.scan_sessions for insert with check (user_id = auth.uid());
create policy "scan_sessions_update_own" on public.scan_sessions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "scan_sessions_delete_own" on public.scan_sessions for delete using (user_id = auth.uid());

create policy "live_readings_select_own" on public.live_readings for select using (user_id = auth.uid());
create policy "live_readings_insert_own" on public.live_readings for insert with check (user_id = auth.uid());
create policy "live_readings_delete_own" on public.live_readings for delete using (user_id = auth.uid());

create policy "dtc_codes_select_own" on public.dtc_codes for select using (user_id = auth.uid());
create policy "dtc_codes_insert_own" on public.dtc_codes for insert with check (user_id = auth.uid());
create policy "dtc_codes_update_own" on public.dtc_codes for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "dtc_codes_delete_own" on public.dtc_codes for delete using (user_id = auth.uid());

create policy "reports_select_own" on public.reports for select using (user_id = auth.uid());
create policy "reports_insert_own" on public.reports for insert with check (user_id = auth.uid());
create policy "reports_update_own" on public.reports for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reports_delete_own" on public.reports for delete using (user_id = auth.uid());

create policy "vehicle_fingerprints_select_own" on public.vehicle_fingerprints for select using (user_id = auth.uid());
create policy "vehicle_fingerprints_insert_own" on public.vehicle_fingerprints for insert with check (user_id = auth.uid());
create policy "vehicle_fingerprints_update_own" on public.vehicle_fingerprints for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "vehicle_fingerprints_delete_own" on public.vehicle_fingerprints for delete using (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
