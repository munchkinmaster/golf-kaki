import { describe, expect, it } from 'vitest';

import { compareCountback, countbackKey } from './countback';

/** An 18-hole gross card of all `base`, with specific hole numbers overridden. */
const card = (base: number, overrides: Record<number, number> = {}): number[] =>
  Array.from({ length: 18 }, (_, i) => overrides[i + 1] ?? base);

describe('countbackKey', () => {
  it('compares last 9, last 6, last 3, the 18th, then the first nine’s last 6 / 3 / 9th', () => {
    // Same 18-hole total; a is a shot better on the back nine.
    const a = countbackKey(card(4, { 18: 3, 1: 5 }), 0);
    const b = countbackKey(card(4), 0);
    expect(a.length).toBe(7);
    expect(compareCountback(a, b)).toBeLessThan(0);
  });

  it('deducts ½, ⅓, ⅙ and 1/18 of the playing handicap from the gross segments (scaled by 18)', () => {
    // Back nine gross 36, last six 24, last three 12, 18th 4; PH 12.
    const key = countbackKey(card(4), 12);
    expect(key.slice(0, 4)).toEqual([36 * 18 - 12 * 9, 24 * 18 - 12 * 6, 12 * 18 - 12 * 3, 4 * 18 - 12]);
  });

  it('lets a higher handicap win an equal-gross back nine, with exact (unrounded) fractions', () => {
    // Equal gross everywhere; PH 13 vs 12 differs by ½ a shot on the back nine.
    expect(compareCountback(countbackKey(card(5), 13), countbackKey(card(5), 12))).toBeLessThan(0);
  });

  it('uses the better nett back nine even when the gross back nine is worse', () => {
    // a: back nine 40 gross, PH 10 → 35.0 · b: back nine 39 gross, PH 6 → 36.0
    const a = countbackKey(card(4, { 10: 8 }), 10);
    const b = countbackKey(card(4, { 10: 7 }), 6);
    expect(compareCountback(a, b)).toBeLessThan(0);
  });

  it('reaches the first nine when the whole back nine matches', () => {
    const a = countbackKey(card(4, { 9: 3, 1: 5 }), 0);
    const b = countbackKey(card(4), 0);
    expect(a.slice(0, 4)).toEqual(b.slice(0, 4));
    expect(compareCountback(a, b)).toBeLessThan(0);
  });

  it('returns 0 for identical cards and handicaps — a genuine shared place', () => {
    expect(compareCountback(countbackKey(card(4), 9), countbackKey(card(4), 9))).toBe(0);
  });
});
