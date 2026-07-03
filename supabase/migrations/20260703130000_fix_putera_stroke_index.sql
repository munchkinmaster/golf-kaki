-- Data fix: Putera holes 6-9 (course-card holes 15-18) had a stroke-index
-- transcription error in the original course_catalog seed — hole 6 carried
-- hole 9's old (wrong) value, and holes 7-9 each carried the next hole's
-- index, shifted by one position. Cross-checked against a real scorecard
-- photo and re-verified against 6 recorded pairings from an actual round —
-- corrected values are the complete even set {2,4,6,8,10,12,14,16,18} with
-- no gaps or duplicates across the nine.

update course_holes set si_by_partner = '{"puteri": 18, "tasik": 18}'
  where course_id = 'tasik-puteri' and nine_id = 'putera' and hole_n = 6;

update course_holes set si_by_partner = '{"puteri": 2, "tasik": 2}'
  where course_id = 'tasik-puteri' and nine_id = 'putera' and hole_n = 7;

update course_holes set si_by_partner = '{"puteri": 12, "tasik": 12}'
  where course_id = 'tasik-puteri' and nine_id = 'putera' and hole_n = 8;

update course_holes set si_by_partner = '{"puteri": 8, "tasik": 8}'
  where course_id = 'tasik-puteri' and nine_id = 'putera' and hole_n = 9;
