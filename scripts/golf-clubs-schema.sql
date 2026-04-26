-- Bag persistence for /golf. Run once in Supabase SQL editor.
-- /api/golf/clubs auto-seeds DAVID_CLUBS on the first GET if the table is empty.

create table if not exists golf_clubs (
  id          uuid primary key default gen_random_uuid(),
  position    int  not null,
  club        text not null,
  loft        text not null,
  carry       int  not null,
  total       int  not null,
  model       text not null default '',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists golf_clubs_position_idx on golf_clubs(position);
