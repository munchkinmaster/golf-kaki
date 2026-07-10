/**
 * Course catalog types + Supabase access for the admin tool. Mirrors the
 * mobile app's src/data/courses.ts read model (courses / course_nines /
 * course_holes / course_combos), plus course_combo_ratings which the app
 * reads but only this admin surface writes.
 *
 * Unlike the mobile app's read (published-only), this surface reads every
 * status — RLS lets admins see their own drafts alongside published
 * courses. Writes (create/update) require an admin session; see
 * supabase/migrations/20260711130000_admin_auth.sql and
 * 20260712120000_course_status.sql.
 */

import { supabase } from '../lib/supabase';

export type TeeColor = 'black' | 'blue' | 'white' | 'red';
export const TEE_COLORS: TeeColor[] = ['black', 'blue', 'white', 'red'];

export const TEE_SWATCH: Record<TeeColor, { name: string; color: string; ring: string }> = {
  black: { name: 'Black', color: '#1C2B22', ring: '#3A4A40' },
  blue: { name: 'Blue', color: '#4E6E8E', ring: '#3C566F' },
  white: { name: 'White', color: '#FFFFFF', ring: '#CFC3A4' },
  red: { name: 'Red', color: '#B23B2E', ring: '#8F2E24' },
};

export type NineId = string;

export type CourseHole = {
  n: number;
  par: number;
  /** Null means "not measured yet" — allowed while a course is a draft, required by the time it's published. */
  yardageM: Record<TeeColor, number | null>;
  siByPartner: Record<NineId, number | undefined>;
};

export type Nine = {
  id: NineId;
  name: string;
  holes: CourseHole[];
};

export type NineCombo = {
  id: string;
  label: string;
  front: NineId;
  back: NineId;
};

export type ComboRating = {
  teeColor: TeeColor;
  courseRating: number;
  slopeRating: number;
};

export type CourseStatus = 'draft' | 'published';

export type Course = {
  id: string;
  name: string;
  area: string;
  latitude: number | null;
  longitude: number | null;
  status: CourseStatus;
  nines: Nine[];
  combos: NineCombo[];
  /** comboId -> ratings on file for that combo, keyed by tee color */
  ratingsByCombo: Record<string, ComboRating[]>;
};

type CourseRow = {
  id: string;
  name: string;
  area: string;
  latitude: number | string | null;
  longitude: number | string | null;
  status: CourseStatus;
  course_nines: {
    nine_id: string;
    name: string;
    course_holes: {
      hole_n: number;
      par: number;
      yardage_black: number | null;
      yardage_blue: number | null;
      yardage_white: number | null;
      yardage_red: number | null;
      si_by_partner: Record<string, number>;
    }[];
  }[];
  course_combos: {
    combo_id: string;
    label: string;
    front_nine_id: string;
    back_nine_id: string;
  }[];
};

type RatingRow = {
  course_id: string;
  combo_id: string;
  tee_color: TeeColor;
  course_rating: number | string;
  slope_rating: number;
};

/** Fetches every course in the catalog, fully assembled with nines/holes/combos/ratings. */
export async function fetchCourseCatalog(): Promise<Course[]> {
  const [{ data: courseData, error: courseError }, { data: ratingData, error: ratingError }] = await Promise.all([
    supabase.from('courses').select(
      `id, name, area, latitude, longitude, status,
       course_nines ( nine_id, name,
         course_holes ( hole_n, par, yardage_black, yardage_blue, yardage_white, yardage_red, si_by_partner )
       ),
       course_combos ( combo_id, label, front_nine_id, back_nine_id )`,
    ),
    supabase.from('course_combo_ratings').select('course_id, combo_id, tee_color, course_rating, slope_rating'),
  ]);

  if (courseError) throw courseError;
  if (ratingError) throw ratingError;

  const ratingsByCourse = new Map<string, RatingRow[]>();
  for (const row of ratingData as RatingRow[]) {
    const list = ratingsByCourse.get(row.course_id) ?? [];
    list.push(row);
    ratingsByCourse.set(row.course_id, list);
  }

  return (courseData as CourseRow[]).map((row) => {
    const ratingsByCombo: Record<string, ComboRating[]> = {};
    for (const r of ratingsByCourse.get(row.id) ?? []) {
      const list = ratingsByCombo[r.combo_id] ?? [];
      list.push({ teeColor: r.tee_color, courseRating: Number(r.course_rating), slopeRating: r.slope_rating });
      ratingsByCombo[r.combo_id] = list;
    }

    return {
      id: row.id,
      name: row.name,
      area: row.area,
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
      status: row.status,
      nines: row.course_nines.map((nine) => ({
        id: nine.nine_id,
        name: nine.name,
        holes: [...nine.course_holes]
          .sort((a, b) => a.hole_n - b.hole_n)
          .map((h) => ({
            n: h.hole_n,
            par: h.par,
            yardageM: { black: h.yardage_black, blue: h.yardage_blue, white: h.yardage_white, red: h.yardage_red },
            siByPartner: h.si_by_partner,
          })),
      })),
      combos: row.course_combos.map((c) => ({
        id: c.combo_id,
        label: c.label,
        front: c.front_nine_id,
        back: c.back_nine_id,
      })),
      ratingsByCombo,
    };
  });
}

/** Every hole in a nine paired the same partner nine, in front(1-9)/back(10-18) order. */
export function comboHolePars(course: Course, combo: NineCombo): number[] {
  const front = course.nines.find((n) => n.id === combo.front);
  const back = course.nines.find((n) => n.id === combo.back);
  return [...(front?.holes ?? []), ...(back?.holes ?? [])].map((h) => h.par);
}

export function totalPar(course: Course, combo: NineCombo | undefined): number {
  if (!combo) return course.nines.reduce((sum, n) => sum + n.holes.reduce((s, h) => s + h.par, 0), 0);
  return comboHolePars(course, combo).reduce((a, b) => a + b, 0);
}

export type CourseWriteInput = {
  name: string;
  area: string;
  latitude: number | null;
  longitude: number | null;
  status: CourseStatus;
  nines: Nine[];
  combos: NineCombo[];
  ratingsByCombo: Record<string, ComboRating[]>;
};

function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'course';
}

/** Replaces every nine/hole/combo/rating row for a course. Deletes go combos-then-nines — course_combos'
 *  FKs into course_nines aren't ON DELETE CASCADE, so nines must outlive combos until they're gone. */
async function replaceCourseChildren(courseId: string, input: CourseWriteInput, { deleteExisting }: { deleteExisting: boolean }) {
  if (deleteExisting) {
    const { error: combosDelErr } = await supabase.from('course_combos').delete().eq('course_id', courseId);
    if (combosDelErr) throw combosDelErr;
    const { error: ninesDelErr } = await supabase.from('course_nines').delete().eq('course_id', courseId);
    if (ninesDelErr) throw ninesDelErr;
  }

  const { error: ninesInsErr } = await supabase
    .from('course_nines')
    .insert(input.nines.map((n) => ({ course_id: courseId, nine_id: n.id, name: n.name })));
  if (ninesInsErr) throw ninesInsErr;

  const holeRows = input.nines.flatMap((n) =>
    n.holes.map((h) => ({
      course_id: courseId,
      nine_id: n.id,
      hole_n: h.n,
      par: h.par,
      yardage_black: h.yardageM.black,
      yardage_blue: h.yardageM.blue,
      yardage_white: h.yardageM.white,
      yardage_red: h.yardageM.red,
      si_by_partner: h.siByPartner,
    })),
  );
  const { error: holesInsErr } = await supabase.from('course_holes').insert(holeRows);
  if (holesInsErr) throw holesInsErr;

  const { error: combosInsErr } = await supabase
    .from('course_combos')
    .insert(input.combos.map((c) => ({ course_id: courseId, combo_id: c.id, label: c.label, front_nine_id: c.front, back_nine_id: c.back })));
  if (combosInsErr) throw combosInsErr;

  const ratingRows = Object.entries(input.ratingsByCombo).flatMap(([comboId, ratings]) =>
    ratings.map((r) => ({ course_id: courseId, combo_id: comboId, tee_color: r.teeColor, course_rating: r.courseRating, slope_rating: r.slopeRating })),
  );
  if (ratingRows.length > 0) {
    const { error: ratingsInsErr } = await supabase.from('course_combo_ratings').insert(ratingRows);
    if (ratingsInsErr) throw ratingsInsErr;
  }
}

/** Creates a new course from a slug of its name. Throws with a friendly message if the slug collides with an existing course. */
export async function createCourse(input: CourseWriteInput): Promise<string> {
  const courseId = slugify(input.name);

  const { error: courseInsErr } = await supabase.from('courses').insert({
    id: courseId,
    name: input.name,
    area: input.area,
    latitude: input.latitude,
    longitude: input.longitude,
    status: input.status,
  });
  if (courseInsErr) {
    if (courseInsErr.code === '23505') {
      throw new Error(`A course with a similar name already exists ("${courseId}") — tweak the name to make it unique.`);
    }
    throw courseInsErr;
  }

  await replaceCourseChildren(courseId, input, { deleteExisting: false });
  return courseId;
}

export async function updateCourse(courseId: string, input: CourseWriteInput): Promise<string> {
  const { error: courseUpdErr } = await supabase
    .from('courses')
    .update({ name: input.name, area: input.area, latitude: input.latitude, longitude: input.longitude, status: input.status })
    .eq('id', courseId);
  if (courseUpdErr) throw courseUpdErr;

  await replaceCourseChildren(courseId, input, { deleteExisting: true });
  return courseId;
}
