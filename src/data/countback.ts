/**
 * Matching scorecards ("countback") for individual nett stroke play — R&A
 * Committee Procedures 5A(6)(d). Pure, no imports, shared by single-round
 * standings (strokePlay.ts) and multi-round standings (multiRound.ts).
 *
 * Order: last nine, last six, last three, the 18th hole; if still tied, the
 * last six, last three and last hole of the FIRST nine. "Last nine" is holes
 * 10-18 by hole number regardless of where the group started (the
 * procedure's multiple-tee-start recommendation, which covers our shotgun
 * start_hole too).
 *
 * Handicap: individual stroke play doesn't use the stroke index for this —
 * the procedure deducts one-half, one-third, one-sixth and one-eighteenth of
 * the playing handicap from each segment's GROSS total. No rounding is
 * specified, so the fractions are kept exact by scaling every figure by 18:
 * (gross × 18) − (handicap × 18 × fraction) stays an integer and compares the
 * same way. (Stableford/par competitions apply strokes by stroke index
 * instead — not this module.)
 *
 * A multi-round event compares the last round's score before any of this —
 * see multiRound.ts.
 */

/** [first hole, last hole, eighteenths of the handicap deducted] in comparison order. */
const SEGMENTS: [number, number, number][] = [
  [10, 18, 9], // last nine  − ½
  [13, 18, 6], // last six   − ⅓
  [16, 18, 3], // last three − ⅙
  [18, 18, 1], // 18th hole  − 1/18
  [4, 9, 6], //   first nine's last six   − ⅓
  [7, 9, 3], //   first nine's last three − ⅙
  [9, 9, 1], //   9th hole                − 1/18
];

/** Countback key for a complete 18-hole card. `gross` is indexed by hole number − 1 (a GrossMap row). Lower is better at every position. */
export function countbackKey(gross: number[], playingHandicap: number): number[] {
  return SEGMENTS.map(([start, end, eighteenths]) => {
    let total = 0;
    for (let n = start; n <= end; n++) total += gross[n - 1] ?? 0;
    return total * 18 - playingHandicap * eighteenths;
  });
}

/** Negative when `a` wins the countback, positive when `b` does, 0 when every segment ties (a genuine shared place). */
export function compareCountback(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i]! - b[i]!;
  }
  return 0;
}
