/**
 * Editable draft shapes for the Add/Edit course form — string-backed numeric
 * fields (so inputs can be temporarily empty/invalid while typing), plus the
 * pure functions that derive combos, validate, and convert to/from the
 * read model in courses.ts.
 */

import { TEE_COLORS, type Course, type CourseStatus, type CourseWriteInput, type TeeColor } from './courses';

export type HoleDraft = {
  par: 3 | 4 | 5 | 6;
  yardage: Record<TeeColor, string>;
};

export type NineDraft = {
  id: string;
  name: string;
  holes: HoleDraft[]; // exactly 9
};

export type RatingDraft = { rating: string; slope: string };

export type ComboDraft = {
  key: string;
  front: string; // nine id
  back: string; // nine id
  label: string;
  /** Stroke index 1-18 for front's 9 holes then back's 9 holes, as strings. */
  si: string[]; // length 18
  ratings: Record<TeeColor, RatingDraft>;
};

export function emptyRatings(): Record<TeeColor, RatingDraft> {
  return { black: { rating: '', slope: '' }, blue: { rating: '', slope: '' }, white: { rating: '', slope: '' }, red: { rating: '', slope: '' } };
}

export function emptyHole(): HoleDraft {
  return { par: 4, yardage: { black: '', blue: '', white: '', red: '' } };
}

export function newNine(name: string): NineDraft {
  return { id: crypto.randomUUID(), name, holes: Array.from({ length: 9 }, emptyHole) };
}

/** Every unordered pair of nines, in the order nines are listed — mirrors how the seed data enumerates a multi-nine club's combos. */
export function deriveCombos(nines: NineDraft[], existing: ComboDraft[]): ComboDraft[] {
  const combos: ComboDraft[] = [];
  for (let i = 0; i < nines.length; i++) {
    for (let j = i + 1; j < nines.length; j++) {
      const front = nines[i]!;
      const back = nines[j]!;
      const key = `${front.id}-${back.id}`;
      const prior = existing.find((c) => (c.front === front.id && c.back === back.id) || (c.front === back.id && c.back === front.id));
      combos.push(
        prior ?? {
          key,
          front: front.id,
          back: back.id,
          label: `${front.name} + ${back.name}`,
          si: Array.from({ length: 18 }, () => ''),
          ratings: emptyRatings(),
        },
      );
    }
  }
  return combos;
}

export function courseToDraft(course: Course): { name: string; area: string; latitude: string; longitude: string; status: CourseStatus; nines: NineDraft[]; combos: ComboDraft[] } {
  const nines: NineDraft[] = course.nines.map((n) => ({
    id: n.id,
    name: n.name,
    holes: n.holes.map((h) => ({
      par: h.par as 3 | 4 | 5 | 6,
      yardage: {
        black: h.yardageM.black === null ? '' : String(h.yardageM.black),
        blue: h.yardageM.blue === null ? '' : String(h.yardageM.blue),
        white: h.yardageM.white === null ? '' : String(h.yardageM.white),
        red: h.yardageM.red === null ? '' : String(h.yardageM.red),
      },
    })),
  }));

  const combos: ComboDraft[] = course.combos.map((c) => {
    const front = course.nines.find((n) => n.id === c.front);
    const back = course.nines.find((n) => n.id === c.back);
    const si = [
      ...(front?.holes.map((h) => String(h.siByPartner[c.back] ?? '')) ?? []),
      ...(back?.holes.map((h) => String(h.siByPartner[c.front] ?? '')) ?? []),
    ];
    const ratings = emptyRatings();
    for (const r of course.ratingsByCombo[c.id] ?? []) {
      ratings[r.teeColor] = { rating: String(r.courseRating), slope: String(r.slopeRating) };
    }
    return { key: c.id, front: c.front, back: c.back, label: c.label, si, ratings };
  });

  return {
    name: course.name,
    area: course.area,
    latitude: course.latitude === null ? '' : String(course.latitude),
    longitude: course.longitude === null ? '' : String(course.longitude),
    status: course.status,
    nines,
    combos,
  };
}

/** Inverse of courseToDraft — assembles the write payload from form state. Called for both Publish
 *  (validateDraft().canSave true, every field parseable) and Save as draft (only canSaveDraft
 *  required — name + nines), so unfilled numeric fields are written as null rather than parsed. */
export function draftToCourseInput(
  name: string,
  area: string,
  latitude: string,
  longitude: string,
  status: CourseStatus,
  nines: NineDraft[],
  combos: ComboDraft[],
): CourseWriteInput {
  // nineId -> hole index (0-based) -> partner nineId -> stroke index
  const siByNineAndHole = new Map<string, Map<number, Record<string, number>>>();
  for (const nine of nines) siByNineAndHole.set(nine.id, new Map());
  for (const combo of combos) {
    for (let i = 0; i < 9; i++) {
      const frontSi = parseInt(combo.si[i]!, 10);
      const frontHoles = siByNineAndHole.get(combo.front)!;
      frontHoles.set(i, { ...frontHoles.get(i), [combo.back]: frontSi });

      const backSi = parseInt(combo.si[i + 9]!, 10);
      const backHoles = siByNineAndHole.get(combo.back)!;
      backHoles.set(i, { ...backHoles.get(i), [combo.front]: backSi });
    }
  }

  return {
    name: name.trim(),
    area: area.trim(),
    latitude: latitude.trim() === '' ? null : Number(latitude),
    longitude: longitude.trim() === '' ? null : Number(longitude),
    status,
    nines: nines.map((n) => ({
      id: n.id,
      name: n.name,
      holes: n.holes.map((h, i) => ({
        n: i + 1,
        par: h.par,
        yardageM: {
          black: h.yardage.black === '' ? null : Number(h.yardage.black),
          blue: h.yardage.blue === '' ? null : Number(h.yardage.blue),
          white: h.yardage.white === '' ? null : Number(h.yardage.white),
          red: h.yardage.red === '' ? null : Number(h.yardage.red),
        },
        siByPartner: siByNineAndHole.get(n.id)?.get(i) ?? {},
      })),
    })),
    combos: combos.map((c) => ({ id: c.key, label: c.label, front: c.front, back: c.back })),
    ratingsByCombo: Object.fromEntries(
      combos.map((c) => [
        c.key,
        TEE_COLORS.filter((t) => c.ratings[t]!.rating !== '' && c.ratings[t]!.slope !== '').map((t) => ({
          teeColor: t,
          courseRating: Number(c.ratings[t]!.rating),
          slopeRating: Number(c.ratings[t]!.slope),
        })),
      ]),
    ),
  };
}

export type Checks = {
  nameOk: boolean;
  enoughNines: boolean;
  ninesFilledOk: boolean;
  combosSiOk: boolean;
  combosRatingOk: boolean;
  /** Gates Publish — every field must be filled in and valid. */
  canSave: boolean;
  /** Gates Save as draft — just enough structure to be a real course row; distances/SI/ratings can come later. */
  canSaveDraft: boolean;
};

export function validateDraft(name: string, nines: NineDraft[], combos: ComboDraft[]): Checks {
  const nameOk = name.trim().length > 0;
  const enoughNines = nines.length >= 2;

  // Not every course offers all 4 tees (e.g. no black tee) — only require yardage for
  // tees the course actually has data for, same "at least one, not all four" idea as
  // combosRatingOk below.
  const usedTees = TEE_COLORS.filter((tee) => nines.some((n) => n.holes.some((h) => h.yardage[tee] !== '')));
  const ninesFilledOk =
    usedTees.length > 0 &&
    nines.every((n) => n.holes.every((h) => usedTees.every((tee) => h.yardage[tee] !== '' && Number(h.yardage[tee]) > 0)));

  const combosSiOk =
    combos.length > 0 &&
    combos.every((c) => {
      const nums = c.si.map((v) => parseInt(v, 10));
      const allValid = nums.every((v) => !isNaN(v) && v >= 1 && v <= 18);
      return allValid && new Set(nums).size === 18;
    });

  const combosRatingOk = combos.length > 0 && combos.every((c) => TEE_COLORS.some((tee) => c.ratings[tee]!.rating !== '' && c.ratings[tee]!.slope !== ''));

  const canSave = nameOk && enoughNines && ninesFilledOk && combosSiOk && combosRatingOk;
  const canSaveDraft = nameOk && enoughNines;
  return { nameOk, enoughNines, ninesFilledOk, combosSiOk, combosRatingOk, canSave, canSaveDraft };
}
