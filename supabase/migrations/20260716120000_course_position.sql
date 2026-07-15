-- Same problem as course_combos before this: courses had no explicit ordering, so the
-- catalog fell back to Postgrest's default (alphabetical by id), with no way for an admin
-- to control which course shows first in the app's course picker.
--
-- Backfilled to current alphabetical order so existing display order doesn't jump around
-- the moment this ships — admins can then drag-reorder from the Courses list page.

alter table courses add column position smallint not null default 0;

update courses set position = sub.rn - 1
from (select id, row_number() over (order by id) as rn from courses) sub
where courses.id = sub.id;
