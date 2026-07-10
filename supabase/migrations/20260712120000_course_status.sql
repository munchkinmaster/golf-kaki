-- Draft/published status on courses, so the course-admin surface can save
-- work in progress without it showing up in the mobile app's course picker.
-- Existing rows are backfilled to 'published' — they're real, already-live
-- data (see 20260628120000_course_catalog.sql seed), not works in progress.
--
-- Child tables (course_nines/holes/combos/ratings) have no status of their
-- own; their public readability now follows the parent course's status,
-- with admins able to see everything (including their own drafts) via
-- is_admin() from 20260711130000_admin_auth.sql.

alter table courses add column status text not null default 'draft' check (status in ('draft', 'published'));
update courses set status = 'published';

drop policy "Courses are publicly readable" on courses;
create policy "Published courses are publicly readable, drafts admin-only" on courses
  for select using (status = 'published' or is_admin());

drop policy "Course nines are publicly readable" on course_nines;
create policy "Course nines follow parent course visibility" on course_nines
  for select using (
    is_admin() or exists (select 1 from courses c where c.id = course_nines.course_id and c.status = 'published')
  );

drop policy "Course holes are publicly readable" on course_holes;
create policy "Course holes follow parent course visibility" on course_holes
  for select using (
    is_admin() or exists (select 1 from courses c where c.id = course_holes.course_id and c.status = 'published')
  );

drop policy "Course combos are publicly readable" on course_combos;
create policy "Course combos follow parent course visibility" on course_combos
  for select using (
    is_admin() or exists (select 1 from courses c where c.id = course_combos.course_id and c.status = 'published')
  );

drop policy "Course combo ratings are publicly readable" on course_combo_ratings;
create policy "Course combo ratings follow parent course visibility" on course_combo_ratings
  for select using (
    is_admin() or exists (select 1 from courses c where c.id = course_combo_ratings.course_id and c.status = 'published')
  );
