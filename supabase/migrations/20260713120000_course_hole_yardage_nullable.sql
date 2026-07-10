-- Lets the course-admin surface save a draft before every tee's distance is
-- filled in. Par always has a real value (the form defaults every hole to
-- par 4, never blank), so it stays not-null — only the four yardage columns
-- need to accept "not entered yet" as null rather than the admin form
-- silently writing 0m for a tee nobody's measured.

alter table course_holes alter column yardage_black drop not null;
alter table course_holes alter column yardage_blue drop not null;
alter table course_holes alter column yardage_white drop not null;
alter table course_holes alter column yardage_red drop not null;
