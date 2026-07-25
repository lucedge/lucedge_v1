-- M1 account & profile (US-07 onboarding, US-08 profile edit, US-09 password
-- change) support table. Run once in Supabase Studio → SQL Editor.

create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text,
  display_currency text not null default 'USD',
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table users enable row level security;

create policy "users manage own row" on users
  for all using (auth.uid() = id) with check (auth.uid() = id);
