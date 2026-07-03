-- Course catalog: clubs, their nines, per-hole par/yardage/stroke-index, and
-- the 18-hole combos a multi-nine club offers. Mirrors src/data/courses.ts.
-- Reference data, managed via the (future) course-admin surface, not by app
-- users — RLS is read-only-to-everyone with no insert/update/delete policy.

create table courses (
  id text primary key,
  name text not null,
  area text not null
);

create table course_nines (
  course_id text not null references courses (id) on delete cascade,
  nine_id text not null,
  name text not null,
  primary key (course_id, nine_id)
);

create table course_holes (
  course_id text not null,
  nine_id text not null,
  hole_n smallint not null check (hole_n between 1 and 9),
  par smallint not null check (par between 3 and 5),
  yardage_black smallint not null,
  yardage_blue smallint not null,
  yardage_white smallint not null,
  yardage_red smallint not null,
  -- stroke index keyed by partner nine_id, e.g. {"puteri": 12, "putera": 11}
  si_by_partner jsonb not null,
  primary key (course_id, nine_id, hole_n),
  foreign key (course_id, nine_id) references course_nines (course_id, nine_id) on delete cascade
);

create table course_combos (
  course_id text not null references courses (id) on delete cascade,
  combo_id text not null,
  label text not null,
  front_nine_id text not null,
  back_nine_id text not null,
  primary key (course_id, combo_id),
  foreign key (course_id, front_nine_id) references course_nines (course_id, nine_id),
  foreign key (course_id, back_nine_id) references course_nines (course_id, nine_id)
);

alter table courses enable row level security;
alter table course_nines enable row level security;
alter table course_holes enable row level security;
alter table course_combos enable row level security;

create policy "Courses are publicly readable" on courses for select using (true);
create policy "Course nines are publicly readable" on course_nines for select using (true);
create policy "Course holes are publicly readable" on course_holes for select using (true);
create policy "Course combos are publicly readable" on course_combos for select using (true);
