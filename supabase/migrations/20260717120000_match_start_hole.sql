-- Shotgun starts: the hole a match's roster actually tees off from. Default
-- 1 (identity play order) preserves every existing match's behavior — see
-- src/data/round.ts's buildPlayOrder for how this reorders hole sequencing,
-- the front/back-9 strokes-basis split, and Trophy/streak detection.
alter table matches add column start_hole smallint not null default 1 check (start_hole between 1 and 18);
