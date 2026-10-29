-- Multi-round tournaments (stroke play · individual) — the handoff scoped in
-- design_handoff_multi_round/README.md. 20260810120000_tournament_stroke_play.sql
-- already left the door open: "a future multi-round tournament is just N
-- `matches` rows sharing one `tournament_id`, no further migration needed on
-- this table." That holds for matches — this migration only adds what a
-- round needs BEFORE its match exists (MR2's schedule: a date and an optional
-- planned course for every round, set up front, while only Round 1 gets a
-- real course/match at creation time).
--
-- Deliberately NOT added:
--   * A tournament-wide roster table. The roster is Round 1's match_players
--     (handoff: "one roster for the whole tournament"; rounds are fixed at
--     MR1 and nobody joins mid-event). Invite/accept/decline/join-by-code all
--     already write there, so a second copy would just be something to keep
--     in sync. A later round's attendance (MR11's "Who's playing") is that
--     round's own match_players; DNS = on Round 1's roster but not seated in
--     that round's match — derived, never stored.
--   * A round status column. MR's planned → setup → live → done is derived
--     from match_id + matches.status (null → planned, lobby → setup,
--     live → live, finished → done), so it can't disagree with the match.
--   * best_n. "Best N of rounds" is shown as SOON in MR1 — standings_mode
--     accepts 'best_n' now (same as play_as accepting 'team') so the column
--     doesn't need a migration when it ships, but only 'aggregate' is wired.

-- ---------------------------------------------------------------------------
-- tournaments
-- ---------------------------------------------------------------------------

-- MR1 "Number of rounds" (2–5); 1 for every single-round tournament.
alter table tournaments add column rounds_count smallint not null default 1 check (rounds_count between 1 and 5);
alter table tournaments add column standings_mode text not null default 'aggregate' check (standings_mode in ('aggregate', 'best_n'));

-- ---------------------------------------------------------------------------
-- tournament_rounds — one row per scheduled round
-- ---------------------------------------------------------------------------

create table tournament_rounds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  round_index smallint not null check (round_index between 1 and 5),
  -- MR2/MR2c — a calendar date only; the handoff explicitly has no tee time.
  round_date date not null,
  -- MR2's "Planned · confirm on the day" course. Optional for Rounds 2+
  -- (Round 1's is required in the UI, and always matches its match's course
  -- at creation). The match's own course_id is what's actually played —
  -- "changed on the day" (MR11 footer, MR13) = matches.course_id differs
  -- from this.
  planned_course_id text,
  planned_combo_id text,
  -- MR2b "Default tee box" — the tee each player is seated on when this
  -- round's match is created (they can still change their own in the lobby).
  -- Same values as match_players.tee_color.
  default_tee text check (default_tee in ('black', 'blue', 'white', 'red')),
  -- Null until the round is set up (Round 1 at creation, later rounds at
  -- MR11 "Confirm & Next"). set null rather than cascade so a deleted match
  -- leaves the schedule intact.
  match_id uuid unique references matches (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tournament_id, round_index),
  foreign key (planned_course_id, planned_combo_id) references course_combos (course_id, combo_id)
);

-- RLS — same shape as tournaments: readable by any signed-in user (players
-- and join-by-code both need the schedule), writable only by the host.
alter table tournament_rounds enable row level security;
grant select, insert, update, delete on tournament_rounds to authenticated;

create policy "Tournament rounds are readable by signed-in users" on tournament_rounds
  for select using (auth.uid() is not null);
create policy "Hosts can add rounds to their tournament" on tournament_rounds
  for insert with check (exists (select 1 from tournaments t where t.id = tournament_id and t.host_id = auth.uid()));
create policy "Hosts can update their tournament's rounds" on tournament_rounds
  for update using (exists (select 1 from tournaments t where t.id = tournament_id and t.host_id = auth.uid()));
create policy "Hosts can remove their tournament's rounds" on tournament_rounds
  for delete using (exists (select 1 from tournaments t where t.id = tournament_id and t.host_id = auth.uid()));

-- Live-round screens subscribe per match today; the lobby/Home need to hear
-- about a round being set up (match_id going from null to a match) too.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tournament_rounds'
  ) then
    alter publication supabase_realtime add table tournament_rounds;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Backfill — every existing (single-round) tournament gets its Round 1 row,
-- so single- and multi-round tournaments share one code path. Date is the
-- local (SGT/MYT, both UTC+8) day the round started, else the day it was
-- created. distinct on guards against any tournament that somehow has more
-- than one match — the earliest one is Round 1.
-- ---------------------------------------------------------------------------

insert into tournament_rounds (tournament_id, round_index, round_date, planned_course_id, planned_combo_id, match_id)
select distinct on (m.tournament_id)
  m.tournament_id,
  1,
  (coalesce(m.started_at, m.created_at) at time zone 'Asia/Singapore')::date,
  m.course_id,
  m.combo_id,
  m.id
from matches m
where m.tournament_id is not null
order by m.tournament_id, m.created_at;
