-- Lat/lng on courses, laying the groundwork for "courses near me" sorting on
-- SelectCourseScreen. Nullable — not every course has coordinates yet (the
-- existing tasik-puteri row doesn't), and the mobile-side distance
-- filter/permission flow isn't built yet either; this is schema + admin-form
-- only for now, filled in via the course-admin surface.

alter table courses add column latitude numeric(9, 6) check (latitude between -90 and 90);
alter table courses add column longitude numeric(9, 6) check (longitude between -180 and 180);
