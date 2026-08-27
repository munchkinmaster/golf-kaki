-- Stableford scoring format — the handoff scoped in
-- design_handoff_stableford_flow/README.md. Widens the scoring_format check
-- constraint (added in 20260824120000_tournament_system36_format.sql) to
-- also accept 'stableford'. Same reasoning as that migration: points/hole,
-- nett, and standings are all computed client-side from grossStrokes (see
-- the forthcoming data/stableford.ts), so no new score-storage tables or
-- columns are needed — just this one new allowed value.
--
-- Unlike System 36, Stableford DOES use standings_basis-adjacent state the
-- same way stroke play does (an upfront Playing Handicap, not a derived
-- one) — it just always ranks by points rather than nett-to-par, so
-- standings_basis stays meaningful only for 'stroke_play' exactly as the
-- prior migration already notes, and tie_break_rule (countback/shared_place,
-- added in 20260810120000) applies unchanged, just compared over points
-- instead of nett strokes.

alter table tournaments
  drop constraint tournaments_scoring_format_check;

alter table tournaments
  add constraint tournaments_scoring_format_check
    check (scoring_format in ('stroke_play', 'system_36', 'stableford'));
