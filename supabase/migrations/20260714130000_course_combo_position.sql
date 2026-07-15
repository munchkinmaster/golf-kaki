-- course_combos had no explicit ordering, so every reader fell back to
-- whatever order Postgrest's default query plan happened to return —
-- confirmed to be alphabetical by combo_id, not insertion order. That's
-- what silently made "Putera + Tasik" (not "Puteri + Putera", the intended
-- primary combo) the Select Course screen's default (src/data/courses.ts's
-- `combos[0]`, mobile app's SelectCourseScreen.tsx) for Tasik Puteri.
--
-- `position` is set explicitly by the writer (course-admin app's
-- replaceCourseChildren, from the array order it's given — see
-- src/data/courseDraft.ts's deriveCombos) and read back in that same order
-- via `.order('position', { referencedTable: 'course_combos' })`.

alter table course_combos add column position smallint not null default 0;

-- Backfill Tasik Puteri's 3 existing combos to their originally-intended
-- order (see 20260628120001_seed_tasik_puteri.sql's insert order — Puteri +
-- Putera is the club's primary/most-played pairing).
update course_combos set position = 0 where course_id = 'tasik-puteri' and combo_id = 'puteri-putera';
update course_combos set position = 1 where course_id = 'tasik-puteri' and combo_id = 'putera-tasik';
update course_combos set position = 2 where course_id = 'tasik-puteri' and combo_id = 'tasik-puteri';
