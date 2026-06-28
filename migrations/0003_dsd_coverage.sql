-- DSD county-level coverage (county → distributor; blank = whitespace).
-- Applied to Supabase project jsdgwrowxgxhswazssji.
create table if not exists public.ref_dsd_coverage (
  id bigint generated always as identity primary key,
  state text,
  county text,
  county_type text,
  distributor text,
  fips text,
  county_state text
);

create index if not exists ref_dsd_coverage_state_idx on public.ref_dsd_coverage (state);
create index if not exists ref_dsd_coverage_distributor_idx on public.ref_dsd_coverage (distributor);

alter table public.ref_dsd_coverage enable row level security;

drop policy if exists "authenticated read dsd coverage" on public.ref_dsd_coverage;
create policy "authenticated read dsd coverage"
  on public.ref_dsd_coverage
  for select
  to authenticated
  using (true);
