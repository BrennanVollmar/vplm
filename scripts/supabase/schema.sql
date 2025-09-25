-- VPLM Supabase schema bootstrap
-- Run inside the Supabase SQL editor after creating your project.

create schema if not exists public;

-- Jobs ----------------------------------------------------------------------
create table if not exists public.jobs (
  id uuid primary key,
  client_name text not null,
  site_name text,
  address text,
  city text,
  county text,
  zip text,
  lat double precision,
  lon double precision,
  created_by text,
  created_at timestamptz default timezone('utc', now()) not null,
  updated_at timestamptz default timezone('utc', now()) not null
);

create index if not exists jobs_updated_at_idx on public.jobs(updated_at desc);

-- Notes ---------------------------------------------------------------------
create table if not exists public.notes (
  id uuid primary key,
  job_id uuid references public.jobs(id) on delete cascade,
  text text not null,
  tags text[],
  created_at timestamptz default timezone('utc', now()) not null
);

create index if not exists notes_job_id_idx on public.notes(job_id);

-- Measurements --------------------------------------------------------------
create table if not exists public.measurements (
  id uuid primary key,
  job_id uuid references public.jobs(id) on delete cascade,
  kind text not null,
  unit text not null,
  value double precision not null,
  created_at timestamptz default timezone('utc', now()) not null
);

create index if not exists measurements_job_id_idx on public.measurements(job_id);

-- Photos (metadata only) ----------------------------------------------------
create table if not exists public.photos (
  id uuid primary key,
  job_id uuid references public.jobs(id) on delete cascade,
  server_uri text,
  caption text,
  created_at timestamptz default timezone('utc', now()) not null,
  exif jsonb default '{}'::jsonb
);

create index if not exists photos_job_id_idx on public.photos(job_id);

-- Updated-at trigger to keep timestamps fresh on UPSERT ---------------------
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists jobs_touch_updated_at on public.jobs;
create trigger jobs_touch_updated_at
before update on public.jobs
for each row
execute procedure public.touch_updated_at();

-- Optional: disable row level security for initial integration (enable once auth is in place)
alter table public.jobs disable row level security;
alter table public.notes disable row level security;
alter table public.measurements disable row level security;
alter table public.photos disable row level security;

-- Seed bucket policy reminder ------------------------------------------------
-- After running this script, create a Storage bucket named "photos" and mark it public.
