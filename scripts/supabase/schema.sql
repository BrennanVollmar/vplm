-- VPLM Supabase schema bootstrap (full dataset)
-- Paste this into Supabase SQL Editor after creating your project.

create schema if not exists public;

-- ---------------------------------------------------------------------------
-- Utility: keep updated_at fresh on updates
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- Core job data
-- ---------------------------------------------------------------------------
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
drop trigger if exists jobs_touch_updated_at on public.jobs;
create trigger jobs_touch_updated_at
before update on public.jobs
for each row execute procedure public.touch_updated_at();
create index if not exists jobs_updated_at_idx on public.jobs(updated_at desc);

create table if not exists public.notes (
  id uuid primary key,
  job_id uuid references public.jobs(id) on delete cascade,
  text text not null,
  tags text[],
  created_at timestamptz default timezone('utc', now()) not null
);
create index if not exists notes_job_id_idx on public.notes(job_id);

create table if not exists public.measurements (
  id uuid primary key,
  job_id uuid references public.jobs(id) on delete cascade,
  kind text not null,
  unit text not null,
  value double precision not null,
  created_at timestamptz default timezone('utc', now()) not null
);
create index if not exists measurements_job_id_idx on public.measurements(job_id);

create table if not exists public.photos (
  id uuid primary key,
  job_id uuid references public.jobs(id) on delete cascade,
  server_uri text,
  caption text,
  created_at timestamptz default timezone('utc', now()) not null,
  exif jsonb default '{}'::jsonb
);
create index if not exists photos_job_id_idx on public.photos(job_id);

create table if not exists public.calc_results (
  id uuid primary key,
  job_id uuid references public.jobs(id) on delete cascade,
  result_type text not null,
  inputs jsonb not null default '{}'::jsonb,
  outputs jsonb not null default '{}'::jsonb,
  created_at timestamptz default timezone('utc', now()) not null
);

create table if not exists public.chem_products (
  id uuid primary key,
  brand text not null,
  active text,
  form text,
  strength text,
  label_notes text,
  dose_rules jsonb not null default '[]'::jsonb
);

create table if not exists public.chem_labels (
  id uuid primary key,
  product_id uuid references public.chem_products(id) on delete cascade,
  filename text not null,
  mime_type text,
  size integer,
  created_at timestamptz default timezone('utc', now()) not null
);

-- ---------------------------------------------------------------------------
-- Field data (tracks, water, checklists, misc points)
-- ---------------------------------------------------------------------------
create table if not exists public.tracks (
  id uuid primary key,
  job_id uuid references public.jobs(id) on delete cascade,
  points jsonb not null default '[]'::jsonb,
  created_at timestamptz default timezone('utc', now()) not null
);

create table if not exists public.water_quality (
  id uuid primary key,
  job_id uuid references public.jobs(id) on delete cascade,
  kind text not null,
  value double precision not null,
  unit text not null,
  depth_ft double precision,
  created_at timestamptz default timezone('utc', now()) not null
);
create index if not exists water_quality_job_id_idx on public.water_quality(job_id);

create table if not exists public.checklists (
  id uuid primary key,
  job_id uuid references public.jobs(id) on delete cascade,
  kind text not null,
  items jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz default timezone('utc', now()) not null
);

create table if not exists public.misc_points (
  id uuid primary key,
  job_id uuid references public.jobs(id) on delete cascade,
  lat double precision not null,
  lon double precision not null,
  name text not null,
  note text,
  created_at timestamptz default timezone('utc', now()) not null
);
create index if not exists misc_points_job_id_idx on public.misc_points(job_id);

create table if not exists public.depth_points (
  id uuid primary key,
  job_id uuid references public.jobs(id) on delete cascade,
  lat double precision not null,
  lon double precision not null,
  depth_ft double precision not null,
  note text,
  pond_id uuid,
  created_at timestamptz default timezone('utc', now()) not null
);
create index if not exists depth_points_job_id_idx on public.depth_points(job_id);

create table if not exists public.ponds (
  id uuid primary key,
  job_id uuid references public.jobs(id) on delete cascade,
  name text,
  polygon jsonb not null default '[]'::jsonb,
  color text,
  created_at timestamptz default timezone('utc', now()) not null
);
create index if not exists ponds_job_id_idx on public.ponds(job_id);

-- ---------------------------------------------------------------------------
-- Audio notes (metadata) – store actual audio in storage bucket
-- ---------------------------------------------------------------------------
create table if not exists public.audio_notes (
  id uuid primary key,
  job_id uuid references public.jobs(id) on delete cascade,
  storage_path text,
  duration_sec double precision,
  transcript text,
  mime_type text,
  lang text,
  stop_id uuid,
  promoted_note_id uuid,
  created_at timestamptz default timezone('utc', now()) not null
);
create index if not exists audio_notes_job_id_idx on public.audio_notes(job_id);

-- ---------------------------------------------------------------------------
-- Scheduling & tasks
-- ---------------------------------------------------------------------------
create table if not exists public.time_entries (
  id uuid primary key,
  job_id uuid references public.jobs(id) on delete cascade,
  work_date date not null,
  arrival_at timestamptz not null,
  departure_at timestamptz
);
create index if not exists time_entries_job_id_idx on public.time_entries(job_id);

create table if not exists public.tasks (
  id uuid primary key,
  job_id uuid references public.jobs(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  created_at timestamptz default timezone('utc', now()) not null
);
create index if not exists tasks_job_id_idx on public.tasks(job_id);

-- ---------------------------------------------------------------------------
-- Fish runs / fisheries
-- ---------------------------------------------------------------------------
create table if not exists public.fish_runs (
  id uuid primary key,
  title text,
  notes text,
  planned_at timestamptz,
  created_at timestamptz default timezone('utc', now()) not null
);

create table if not exists public.fish_stops (
  id uuid primary key,
  run_id uuid references public.fish_runs(id) on delete cascade,
  seq integer not null,
  client text,
  site text,
  address text,
  lat double precision,
  lon double precision,
  species text,
  count integer,
  weight_lb double precision,
  tank_temp_f double precision,
  pond_temp_f double precision,
  note text,
  created_at timestamptz default timezone('utc', now()) not null
);
create index if not exists fish_stops_run_id_idx on public.fish_stops(run_id);

create table if not exists public.fish_sessions (
  id uuid primary key,
  job_id uuid references public.jobs(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz
);

create table if not exists public.fish_counts (
  id uuid primary key,
  session_id uuid references public.fish_sessions(id) on delete cascade,
  species text not null,
  co
