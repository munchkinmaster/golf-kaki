-- "Broke 80" — a one-off per-round moment (a complete 18-hole round with
-- gross strokes under 80), detected and peer-attested the same way as
-- Hole-in-One/Eagle (see 20260714120000_moment_badges.sql). Reuses
-- badge_moments rather than a new table: hole_number = 0 is the "whole
-- round, not a specific hole" sentinel, kept NOT NULL (rather than nullable)
-- so the existing (player_id, match_id, badge_type, hole_number) unique
-- constraint keeps deduping correctly with a plain equality index.

alter table badge_moments drop constraint badge_moments_badge_type_check;
alter table badge_moments add constraint badge_moments_badge_type_check
  check (badge_type in ('hole_in_one', 'eagle', 'broke_80'));

alter table badge_moments drop constraint badge_moments_hole_number_check;
alter table badge_moments add constraint badge_moments_hole_number_check
  check (hole_number = 0 or hole_number between 1 and 18);

alter table badge_attestations drop constraint badge_attestations_badge_type_check;
alter table badge_attestations add constraint badge_attestations_badge_type_check
  check (badge_type in ('birdie_streak', 'par_streak', 'hole_in_one', 'eagle', 'broke_80'));
