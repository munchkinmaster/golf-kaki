-- Longest-ever consecutive-hole streaks (birdie-or-better, exact-par), backing
-- the Trophy Cabinet's "Birdie Streak" / "Par Streak" badges. Recomputed from
-- scratch from the player's full finished-match history at match-finish time
-- (see src/data/streaks.ts) rather than incrementally cursor-tracked, so these
-- are plain derived stats, not a ledger — nullable until a player's first
-- finished, scored match.

alter table profiles add column birdie_streak_best smallint;
alter table profiles add column par_streak_best smallint;
