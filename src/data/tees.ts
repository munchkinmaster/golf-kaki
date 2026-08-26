/**
 * Tee-box presentation (display name + swatch color + description), keyed by
 * TeeColor and optionally overridden per course.
 *
 * The underlying model is always the fixed four-key TeeColor union
 * (black/blue/white/red) from courses.ts — yardage columns, course/slope
 * ratings, SI allocation and handicap math all key off those and are NEVER
 * touched here. This module only decides what NAME and DOT a given tee shows
 * in the UI, so a club that brands its tees differently reads correctly
 * without forking any scoring logic.
 *
 * Previously every tournament screen carried its own inline
 * `{ black:'Black', blue:'Blue', ... }` label map + dot-color map; this is the
 * single source of truth they now share.
 */

import { palette } from '../theme/tokens';
import type { TeeColor } from './courses';

export const TEE_COLORS: TeeColor[] = ['black', 'blue', 'white', 'red'];

export type TeePresentation = {
  label: string;
  dot: string;
  /** Set only when the dot would otherwise vanish against a card (the pale white tee); most colors don't need one. */
  dotBorder?: string;
  description: string;
};

const DEFAULTS: Record<TeeColor, TeePresentation> = {
  black: { label: 'Black', dot: palette.tee.black, description: 'Championship' },
  blue: { label: 'Blue', dot: palette.tee.blue, description: "Men's" },
  white: { label: 'White', dot: palette.tee.white, dotBorder: palette.tee.whiteBorder, description: 'Forward' },
  red: { label: 'Red', dot: palette.tee.red, description: 'Ladies' },
};

/**
 * Purely cosmetic per-course overrides — a course id maps a subset of tees to
 * a different name/swatch. Merged over the defaults, so any key left out keeps
 * its standard presentation, and the TeeColor itself never changes.
 *
 * The Els Club Teluk Datai: Black stays Black; blue→Silver, white→Copper,
 * red→Jade (dotBorder cleared since copper/silver read fine on their own).
 */
const COURSE_OVERRIDES: Record<string, Partial<Record<TeeColor, Partial<TeePresentation>>>> = {
  'the-els-club-teluk-datai': {
    blue: { label: 'Silver', dot: palette.tee.silver },
    white: { label: 'Copper', dot: palette.tee.copper, dotBorder: undefined },
    red: { label: 'Jade', dot: palette.tee.jade },
  },
};

/** Full presentation for one tee on one course (course id optional — falls back to the standard names/swatches). */
export function teePresentation(courseId: string | null | undefined, color: TeeColor): TeePresentation {
  const base = DEFAULTS[color];
  const override = courseId ? COURSE_OVERRIDES[courseId]?.[color] : undefined;
  return override ? { ...base, ...override } : base;
}

/** Convenience for the common label-only case. */
export function teeLabel(courseId: string | null | undefined, color: TeeColor): string {
  return teePresentation(courseId, color).label;
}
