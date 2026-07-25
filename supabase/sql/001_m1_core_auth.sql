-- M1 core auth (US-01–US-05) support tables.
-- Run once in Supabase Studio → SQL Editor. No migration tooling wired up yet
-- (see plan: M1 core auth — fully functional, "Architecture decision" section).

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text,
  ip text,
  event_type text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_lockout_idx
  on audit_events (email, ip, event_type, created_at);

create table if not exists consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null,
  granted boolean not null,
  source text not null,
  created_at timestamptz not null default now()
);

alter table audit_events enable row level security;
alter table consent_records enable row level security;

create policy "users read own audit events" on audit_events
  for select using (auth.uid() = user_id);

create policy "users read own consent records" on consent_records
  for select using (auth.uid() = user_id);

-- No insert/update/delete policies for any role: all writes to these two
-- tables happen server-side via the service-role client (lib/supabase/admin.ts),
-- which bypasses RLS by design.
