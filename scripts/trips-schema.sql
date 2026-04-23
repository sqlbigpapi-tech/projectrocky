-- Trips tab: dream list, booked trips, memory lane
-- Run this in Supabase SQL editor.

create table if not exists trips (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  destination     text,
  country         text,
  status          text not null default 'dream'
                    check (status in ('dream', 'booked', 'past')),
  start_date      date,
  end_date        date,
  budget_estimate integer,
  actual_cost     integer,
  who             text not null default 'family'
                    check (who in ('family', 'couple', 'solo', 'david', 'erica', 'kids')),
  vibe            text,
  rating          smallint check (rating between 1 and 5),
  notes           text,
  why             text,
  is_pr_scouting  boolean default false,
  cover_url       text,
  added_by        text default 'david',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists trips_status_idx on trips (status);
create index if not exists trips_start_date_idx on trips (start_date desc);
create index if not exists trips_pr_idx on trips (is_pr_scouting) where is_pr_scouting = true;
