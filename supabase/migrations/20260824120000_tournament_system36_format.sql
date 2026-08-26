-- System 36 scoring format — the handoff scoped in
-- design_handoff_system36/README.md. Adds the one piece of schema that
-- flow needs: a way to record which scoring format a tournament uses.
-- Everything else (S36 points/hole, derived handicap, nett, Stableford) is
-- computed client-side from grossStrokes the same way stroke play's nett
-- is (see data/strokePlay.ts and its forthcoming data/system36.ts sibling)
-- — no new score-storage tables.
--
-- `standings_basis` (nett/gross/both, added in 20260810120000) stays
-- meaningful only for 'stroke_play' — System 36 always ranks by Stableford
-- points off the derived handicap, so that column is simply ignored by the
-- app when scoring_format = 'system_36' rather than widened to cover a
-- concept it doesn't have.
--
-- matches.game_mode (round_scoring_core.sql) is unconstrained free text
-- already, so no migration is needed there — the app just writes
-- 'system_36' instead of 'stroke_play' at tournament-creation time
-- (data/tournaments.ts's createTournamentMatch) once this format is wired.

alter table tournaments
  add column scoring_format text not null default 'stroke_play'
    check (scoring_format in ('stroke_play', 'system_36'));
