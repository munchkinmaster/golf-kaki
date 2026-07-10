-- Handicap Index: real USGA/WHS-style calculation, auto-computed only (no
-- manual entry path anywhere in the app). Decoupled from Kaki Match Play's
-- stroke allocation (kaki_relationships, game_matchups) — purely an
-- informational stat.
--
-- course_combo_ratings holds Course Rating + Slope Rating per (course,
-- combo, tee) — real WHS ratings vary by tee, not just by course/combo, so
-- this is a separate table rather than flat columns on course_combos (which
-- has no tee concept). Same read-only-to-everyone RLS stance as the rest of
-- the course catalog (see 20260628120000_course_catalog.sql) — managed via
-- the (future) course-admin surface, not by app users.

create table course_combo_ratings (
  course_id text not null,
  combo_id text not null,
  tee_color text not null check (tee_color in ('black', 'blue', 'white', 'red')),
  course_rating numeric(4, 1) not null,
  slope_rating smallint not null check (slope_rating between 55 and 155),
  primary key (course_id, combo_id, tee_color),
  foreign key (course_id, combo_id) references course_combos (course_id, combo_id) on delete cascade
);

alter table course_combo_ratings enable row level security;

create policy "Course combo ratings are publicly readable" on course_combo_ratings for select using (true);

-- Real ratings for Tasik Puteri's three combos. White tee wasn't measured
-- yet for two of the three combos — using 72 / 131 as a placeholder for
-- those specific rows until the course-admin page fills in the real number.
insert into course_combo_ratings (course_id, combo_id, tee_color, course_rating, slope_rating) values
  ('tasik-puteri', 'puteri-putera', 'blue', 70.9, 125),
  ('tasik-puteri', 'puteri-putera', 'white', 72.0, 131),
  ('tasik-puteri', 'tasik-puteri', 'blue', 72.0, 129),
  ('tasik-puteri', 'tasik-puteri', 'white', 72.0, 131),
  ('tasik-puteri', 'putera-tasik', 'blue', 72.3, 130),
  ('tasik-puteri', 'putera-tasik', 'white', 70.5, 126);

-- ---------------------------------------------------------------------------
-- handicap_differentials — one row per (player, finished 18-hole match),
-- computed once at finish time using the Course Handicap the player had
-- BEFORE this round updated their index (matches real WHS behavior: a round
-- is scored against the handicap you carried into it, not retroactively
-- against a later one). Append-only, same shape as the other ledger-style
-- tables in this schema (kaki_relationships, game_matchups).
-- ---------------------------------------------------------------------------

create table handicap_differentials (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references profiles (id) on delete cascade,
  match_id uuid not null references matches (id) on delete cascade,
  differential numeric(4, 1) not null,
  played_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (player_id, match_id)
);

alter table handicap_differentials enable row level security;

create policy "Players can read their own differentials" on handicap_differentials
  for select using (player_id = auth.uid());
create policy "Players can insert their own differentials" on handicap_differentials
  for insert with check (player_id = auth.uid());

grant select, insert on handicap_differentials to authenticated;
