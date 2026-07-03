-- Seed data for the course catalog, transcribed from the Tasik Puteri
-- scorecard and verified against its printed OUT totals. Keep this in sync
-- with src/data/courses.ts by hand until the app reads from Supabase instead.

insert into courses (id, name, area) values
  ('tasik-puteri', 'Tasik Puteri Golf & Country Club', 'Rawang');

insert into course_nines (course_id, nine_id, name) values
  ('tasik-puteri', 'puteri', 'Puteri'),
  ('tasik-puteri', 'putera', 'Putera'),
  ('tasik-puteri', 'tasik', 'Tasik');

insert into course_holes (course_id, nine_id, hole_n, par, yardage_black, yardage_blue, yardage_white, yardage_red, si_by_partner) values
  ('tasik-puteri', 'puteri', 1, 4, 362, 344, 324, 311, '{"putera": 5, "tasik": 5}'),
  ('tasik-puteri', 'puteri', 2, 4, 392, 365, 342, 325, '{"putera": 1, "tasik": 1}'),
  ('tasik-puteri', 'puteri', 3, 3, 150, 139, 122, 102, '{"putera": 17, "tasik": 17}'),
  ('tasik-puteri', 'puteri', 4, 5, 450, 432, 416, 400, '{"putera": 9, "tasik": 9}'),
  ('tasik-puteri', 'puteri', 5, 4, 359, 335, 312, 294, '{"putera": 11, "tasik": 11}'),
  ('tasik-puteri', 'puteri', 6, 4, 388, 363, 330, 305, '{"putera": 13, "tasik": 13}'),
  ('tasik-puteri', 'puteri', 7, 5, 465, 450, 422, 386, '{"putera": 15, "tasik": 15}'),
  ('tasik-puteri', 'puteri', 8, 3, 192, 188, 155, 130, '{"putera": 3, "tasik": 3}'),
  ('tasik-puteri', 'puteri', 9, 4, 329, 324, 315, 292, '{"putera": 7, "tasik": 7}'),

  ('tasik-puteri', 'putera', 1, 4, 402, 383, 365, 351, '{"puteri": 4, "tasik": 4}'),
  ('tasik-puteri', 'putera', 2, 4, 347, 344, 327, 312, '{"puteri": 6, "tasik": 6}'),
  ('tasik-puteri', 'putera', 3, 4, 372, 343, 322, 305, '{"puteri": 10, "tasik": 10}'),
  ('tasik-puteri', 'putera', 4, 5, 442, 413, 386, 366, '{"puteri": 16, "tasik": 16}'),
  ('tasik-puteri', 'putera', 5, 3, 143, 125, 116, 92, '{"puteri": 14, "tasik": 14}'),
  ('tasik-puteri', 'putera', 6, 4, 370, 347, 327, 307, '{"puteri": 18, "tasik": 18}'),
  ('tasik-puteri', 'putera', 7, 5, 498, 488, 443, 416, '{"puteri": 2, "tasik": 2}'),
  ('tasik-puteri', 'putera', 8, 3, 212, 191, 169, 152, '{"puteri": 12, "tasik": 12}'),
  ('tasik-puteri', 'putera', 9, 4, 333, 318, 302, 288, '{"puteri": 8, "tasik": 8}'),

  ('tasik-puteri', 'tasik', 1, 4, 424, 410, 370, 357, '{"puteri": 12, "putera": 11}'),
  ('tasik-puteri', 'tasik', 2, 5, 512, 497, 486, 445, '{"puteri": 6, "putera": 5}'),
  ('tasik-puteri', 'tasik', 3, 4, 444, 431, 400, 371, '{"puteri": 10, "putera": 9}'),
  ('tasik-puteri', 'tasik', 4, 3, 218, 197, 186, 168, '{"puteri": 2, "putera": 1}'),
  ('tasik-puteri', 'tasik', 5, 4, 397, 375, 361, 348, '{"puteri": 14, "putera": 13}'),
  ('tasik-puteri', 'tasik', 6, 3, 181, 146, 134, 118, '{"puteri": 16, "putera": 15}'),
  ('tasik-puteri', 'tasik', 7, 4, 388, 368, 351, 336, '{"puteri": 8, "putera": 7}'),
  ('tasik-puteri', 'tasik', 8, 4, 427, 401, 383, 358, '{"puteri": 4, "putera": 3}'),
  ('tasik-puteri', 'tasik', 9, 5, 498, 485, 476, 466, '{"puteri": 18, "putera": 17}');

insert into course_combos (course_id, combo_id, label, front_nine_id, back_nine_id) values
  ('tasik-puteri', 'puteri-putera', 'Puteri + Putera', 'puteri', 'putera'),
  ('tasik-puteri', 'putera-tasik', 'Putera + Tasik', 'putera', 'tasik'),
  ('tasik-puteri', 'tasik-puteri', 'Tasik + Puteri', 'tasik', 'puteri');
