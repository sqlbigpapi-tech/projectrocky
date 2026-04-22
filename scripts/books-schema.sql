-- Reading tab: audiobooks library
-- Run this in Supabase SQL editor.

create table if not exists books (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  author          text,
  cover_url       text,
  isbn            text,
  length_minutes  integer,                    -- audiobook duration, optional
  rating          smallint check (rating between 1 and 5),
  status          text not null default 'wishlist'
                    check (status in ('listening', 'finished', 'wishlist', 'dismissed')),
  started_at      date,
  finished_at     date,
  listened_minutes integer default 0,         -- progress for currently listening
  notes           text,
  rec_reason      text,                       -- why Rocky recommended it, if applicable
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists books_status_idx on books (status);
create index if not exists books_finished_at_idx on books (finished_at desc);
create index if not exists books_isbn_idx on books (isbn) where isbn is not null;
