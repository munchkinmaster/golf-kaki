/**
 * Course catalog types + Supabase fetch. Distinct from the lightweight
 * `Course` rows in SelectCourseScreen (name/area/distance for the picker
 * list); this is the detailed catalog (par/yardage/stroke-index per hole)
 * that screen reads from to drive multi-nine combo pickers.
 */

import { supabase } from '../lib/supabase';

export type TeeColor = 'black' | 'blue' | 'white' | 'red';

export type NineId = string;

export type CourseHole = {
  /** Hole number within the nine (1-9). */
  n: number;
  par: number;
  yardageM: Record<TeeColor, number>;
  /**
   * Stroke index, keyed by whichever nine it's paired with. A 27-hole
   * club assigns SI 1-18 across whatever two nines are in play, so the
   * same hole can carry a different index depending on the partner nine.
   */
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

export type ComboHole = {
  /** Hole number within the 18 (1-18). */
  n: number;
  par: number;
  si: number;
  yardageM: Record<TeeColor, number>;
};

export type Course = {
  id: string;
  name: string;
  area: string;
  nines: Nine[];
  combos: NineCombo[];
};

type CourseRow = {
  id: string;
  name: string;
  area: string;
  course_nines: {
    nine_id: string;
    name: string;
    course_holes: {
      hole_n: number;
      par: number;
      yardage_black: number;
      yardage_blue: number;
      yardage_white: number;
      yardage_red: number;
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

/** Fetches every published course in the catalog, fully assembled with nines/holes/combos. Draft courses are admin-only and never shown to players. */
export async function fetchCourseCatalog(): Promise<Course[]> {
  const { data, error } = await supabase
    .from('courses')
    .select(
      `id, name, area,
     course_nines ( nine_id, name,
       course_holes ( hole_n, par, yardage_black, yardage_blue, yardage_white, yardage_red, si_by_partner )
     ),
     course_combos ( combo_id, label, front_nine_id, back_nine_id )`,
    )
    .eq('status', 'published');

  if (error) throw error;

  return (data as CourseRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    area: row.area,
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
  }));
}

function findNine(course: Course, id: NineId): Nine {
  const nine = course.nines.find((n) => n.id === id);
  if (!nine) throw new Error(`Unknown nine "${id}" on course "${course.id}"`);
  return nine;
}

/** Resolves a combo into 18 ordered holes (1-9 front, 10-18 back) with stroke index applied. */
export function getComboHoles(course: Course, comboId: string): ComboHole[] {
  const combo = course.combos.find((c) => c.id === comboId);
  if (!combo) throw new Error(`Unknown combo "${comboId}" on course "${course.id}"`);

  const front = findNine(course, combo.front);
  const back = findNine(course, combo.back);

  const frontHoles: ComboHole[] = front.holes.map((h) => ({
    n: h.n,
    par: h.par,
    si: h.siByPartner[combo.back]!,
    yardageM: h.yardageM,
  }));
  const backHoles: ComboHole[] = back.holes.map((h) => ({
    n: h.n + 9,
    par: h.par,
    si: h.siByPartner[combo.front]!,
    yardageM: h.yardageM,
  }));

  return [...frontHoles, ...backHoles];
}
