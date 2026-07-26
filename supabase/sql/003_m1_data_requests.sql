-- M1 account deletion (US-12) support table. Run once in Supabase Studio
-- → SQL Editor. Also the entity US-11 (data export, not built yet) would
-- reuse later.

create table if not exists data_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz
);

alter table data_requests enable row level security;

create policy "users read own data requests" on data_requests
  for select using (auth.uid() = user_id);

-- No insert/update/delete policies for any role: all writes go through
-- the service-role client server-side, same pattern as the other tables.
