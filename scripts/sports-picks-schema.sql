-- Rocky's Board: daily game picks with auto-grading
-- Run in Supabase SQL editor.

create table if not exists sports_picks (
  id                 uuid primary key default gen_random_uuid(),
  league             text not null,
  team_id            text not null,
  event_id           text not null,
  pick_date          date not null,
  game_date          date not null,
  picked_winner_abbr text not null,
  opponent_abbr      text not null,
  picked_team_abbr   text not null,
  reasoning          text,
  confidence         text check (confidence in ('low','medium','high')),
  result             text check (result in ('win','loss','push')),
  actual_winner_abbr text,
  final_score        text,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create index if not exists sports_picks_game_date_idx on sports_picks (game_date desc);
create unique index if not exists sports_picks_event_idx on sports_picks (event_id);
