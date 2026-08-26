-- Tournament (stroke play + optional Skins) schema — the handoff scoped in
-- design_handoff_tournament_flow/README.md. Rides on the existing matches/
-- match_players tables per the note already left in round_scoring_core.sql:
-- "Tournaments (multi-round series with shared standings) deliberately
-- aren't modeled here — structurally distinct, additive later via a
-- `tournaments` table + nullable `matches.tournament_id`." This is that.
--
-- A tournament is always exactly 1:1 with a single `matches` row today
-- (single-round only, per the handoff's stated scope) — the FK is nullable
-- and unconstrained-cardinality on purpose, so a future multi-round
-- tournament is just N `matches` rows sharing one `tournament_id`, no
-- further migration needed on this table.
--
-- Side-game (Skins) config and participation deliberately do NOT get their
-- own tables — they live in the existing `matches.game_settings` jsonb,
-- which round_scoring_core.sql already earmarked for exactly this ("e.g.
-- {"skin_value": 5} for Skins"). Shape (see data/skins.ts for the typed
-- version):
--   game_settings = {
--     "sideGames": [
--       {
--         "type": "skins",
--         "stakePerHole": 5,
--         "tiedHoleRule": "carryover",
--         "basis": "nett",
--         "participantIds": ["<player_id>", ...]
--       }
--     ]
--   }
-- `sideGames` is an array so later side-game types (Nassau, Banker, Snake —
-- all "coming soon" per S5) slot in without another migration.

-- ---------------------------------------------------------------------------
-- tournaments
-- ---------------------------------------------------------------------------

create or replace function generate_tournament_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..4 loop
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from tournaments where tournament_code = code);
  end loop;
  return code;
end;
$$;

create table tournaments (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references profiles (id),
  name text not null,
  tournament_code text not null unique default generate_tournament_code(),
  -- 'team' is the S1 "Play as" SOON option — column exists now so it doesn't
  -- need a migration when that ships; only 'individual' is buildable today.
  play_as text not null default 'individual' check (play_as in ('individual', 'team')),
  -- 'multi' is the S1 "Round structure" SOON option — this is the field a
  -- future multi-round tournament flips; single-round is all that's wired.
  round_structure text not null default 'single' check (round_structure in ('single', 'multi')),
  -- S3 "Rank standings by". Every downstream screen in the handoff (S9, S10)
  -- only ever renders nett — 'gross' and 'both' are accepted here so the
  -- rules screen isn't lying about the choice, but the leaderboard/finish
  -- UI only needs to implement the 'nett' path for v1.
  standings_basis text not null default 'nett' check (standings_basis in ('nett', 'gross', 'both')),
  handicap_allowance_pct smallint not null default 100 check (handicap_allowance_pct between 0 and 100),
  tie_break_rule text not null default 'countback' check (tie_break_rule in ('countback', 'shared_place')),
  -- Mirrors matches.status exactly (same three values) since v1 is always
  -- 1:1 with one match — kept as its own column rather than derived so a
  -- future multi-round tournament can hold a status independent of any one
  -- round's.
  status text not null default 'lobby' check (status in ('lobby', 'live', 'finished')),
  created_at timestamptz not null default now()
);

alter table matches add column tournament_id uuid references tournaments (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- match_players — per-round tee + playing handicap
-- ---------------------------------------------------------------------------

-- Mirrors courses.ts's TeeColor union (black/blue/white/red) — kept as a
-- plain checked text column rather than a Postgres enum, matching every
-- other constrained-choice column in this schema (status, game_mode, etc.).
alter table match_players add column tee_color text check (tee_color in ('black', 'blue', 'white', 'red'));

-- Course/playing handicap for this round — computed client-side from
-- handicap_at_time + the player's tee rating/slope (computeCourseHandicap in
-- handicap.ts) and written here, OR manually overridden by the host from
-- S4b. `handicap_override` distinguishes the two so the UI can show/clear
-- the "manual override active" state without losing the auto-computed value
-- (the app recomputes and rewrites playing_handicap on every tee change
-- unless handicap_override is true).
alter table match_players add column playing_handicap smallint check (playing_handicap is null or playing_handicap >= 0);
alter table match_players add column handicap_override boolean not null default false;

-- ---------------------------------------------------------------------------
-- RLS — tournaments follows the exact same shape as matches: permissive
-- read for any signed-in user (join-by-code needs to work for non-friends),
-- writable only by the host.
-- ---------------------------------------------------------------------------

alter table tournaments enable row level security;
grant select, insert, update on tournaments to authenticated;

create policy "Tournaments are readable by signed-in users" on tournaments
  for select using (auth.uid() is not null);
create policy "Hosts can create tournaments" on tournaments
  for insert with check (auth.uid() = host_id);
create policy "Hosts can update their tournament" on tournaments
  for update using (auth.uid() = host_id);

-- match_players already lets a player delete their OWN seat
-- (20260706100000_match_invite_status.sql), for leaving/declining an
-- invite — nothing let the HOST remove someone else's seat, which S6b's
-- swipe-to-remove needs (the host pulling a player who joined by mistake,
-- or un-inviting one who hasn't accepted yet). Same host-scoped shape as
-- the existing game_matchups policies.
create policy "Host can remove a player from their match" on match_players
  for delete using (exists (select 1 from matches m where m.id = match_id and m.host_id = auth.uid()));
