-- Real courses occasionally carry a par 6 hole (rare but not invalid) — the
-- original check (par between 3 and 5) rejected it outright. Widened to 6,
-- not further, since par 6 is the practical ceiling clubs actually use.

alter table course_holes drop constraint course_holes_par_check;
alter table course_holes add constraint course_holes_par_check check (par between 3 and 6);
