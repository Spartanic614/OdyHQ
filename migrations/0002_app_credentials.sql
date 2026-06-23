-- ============================================================
-- Software Links & Logins directory.
-- Run in Supabase → SQL Editor (the MCP was offline when this was added).
-- ============================================================

create table if not exists public.ref_app_credentials (
  id          integer generated always as identity primary key,
  app_name    text,
  category    text,
  url         text,
  username    text,
  password    text,
  notes       text,
  updated_at  timestamptz default now()
);

-- RLS: authenticated team members can read. No anon access.
alter table public.ref_app_credentials enable row level security;

create policy ref_app_credentials_auth_select
  on public.ref_app_credentials
  for select to authenticated
  using (true);
