/**
 * USGA/WHS-style Handicap Index — auto-calculated only, no manual entry path
 * anywhere in the app. Deliberately decoupled from Kaki Match Play's stroke
 * ledger (kaki_relationships/game_matchups/round.ts's restrike logic): this
 * module reads/writes only `profiles.handicap` and its own
 * `handicap_differentials` ledger, and is never consulted by round.ts.
 *
 * No screen lets a player pick a tee (TeeColor only exists in courses.ts as
 * a yardage-modeling concept), so every calculation here uses one fixed
 * default tee until real tee-tracking exists — swap DEFAULT_TEE_COLOR once
 * it does.
 */

import { computeThru } from './round';
import { fetchCourseCatalog, getComboHoles } from './courses';
import type { TeeColor } from './courses';
import { fetchScores } from './scores';
import type { MatchStatus } from './matches';
import { withRetry } from '../lib/retry';
import { supabase } from '../lib/supabase';

const DEFAULT_TEE_COLOR: TeeColor = 'blue';
const MAX_DIFFERENTIALS = 20;

export type SiHole = { n: number; par: number; si: number };

/**
 * USGA/R&A Rule 5.2a "For Fewer Than 20 Scores" — how many of the lowest
 * differentials to average, and the net adjustment, based on how many scores
 * are on file. Below the 3-score minimum there's no index yet.
 */
const LOW_ROUND_TABLE: { min: number; max: number; count: number; adjustment: number }[] = [
  { min: 3, max: 3, count: 1, adjustment: -2.0 },
  { min: 4, max: 4, count: 1, adjustment: -1.0 },
  { min: 5, max: 5, count: 1, adjustment: 0.0 },
  { min: 6, max: 6, count: 2, adjustment: -1.0 },
  { min: 7, max: 8, count: 2, adjustment: 0.0 },
  { min: 9, max: 11, count: 3, adjustment: 0.0 },
  { min: 12, max: 14, count: 4, adjustment: 0.0 },
  { min: 15, max: 16, count: 5, adjustment: 0.0 },
  { min: 17, max: 18, count: 6, adjustment: 0.0 },
  { min: 19, max: 19, count: 7, adjustment: 0.0 },
  { min: 20, max: Infinity, count: 8, adjustment: 0.0 },
];

export function lookupLowRoundRule(scoreCount: number): { count: number; adjustment: number } | null {
  const row = LOW_ROUND_TABLE.find((r) => scoreCount >= r.min && scoreCount <= r.max);
  return row ? { count: row.count, adjustment: row.adjustment } : null;
}

/**
 * Strokes a hole of the given 1-18 stroke-index rank receives under a Course
 * Handicap (which may exceed 18 — WHS allows up to 54): every hole gets
 * floor(courseHandicap / 18), plus one more on the hardest
 * (courseHandicap % 18) holes. A scratch-or-better (<=0) Course Handicap gets
 * no allowance here — real WHS removes strokes from the easiest holes for a
 * "plus" handicap, which this simplifies to "no bonus reduction" rather than
 * risk producing negative-stroke math; low-impact for this app's casual
 * social-golf audience.
 */
export function strokesReceivedOnHole(courseHandicap: number, siRank: number): number {
  if (courseHandicap <= 0) return 0;
  const base = Math.floor(courseHandicap / 18);
  const extra = siRank <= courseHandicap % 18 ? 1 : 0;
  return base + extra;
}

/** Course Handicap = round(HandicapIndex × Slope/113 + (CourseRating − Par)). */
export function computeCourseHandicap(handicapIndex: number, slopeRating: number, courseRating: number, coursePar: number): number {
  return Math.round(handicapIndex * (slopeRating / 113) + (courseRating - coursePar));
}

/**
 * Adjusted Gross Score: each hole's gross capped at net double bogey
 * (par + 2 + strokes received there). `courseHandicap === null` means no
 * established index yet — falls back to a flat double-bogey cap (par + 2, no
 * stroke allowance), the standard WHS treatment for a player's first-ever
 * differential(s).
 */
export function computeAdjustedGrossScore(holes: SiHole[], grossByHoleN: Record<number, number>, courseHandicap: number | null): number {
  const rankByHoleN = new Map<number, number>();
  [...holes]
    .sort((a, b) => a.si - b.si)
    .forEach((h, i) => rankByHoleN.set(h.n, i + 1));

  let total = 0;
  for (const hole of holes) {
    const gross = grossByHoleN[hole.n]!;
    const strokes = courseHandicap === null ? 0 : strokesReceivedOnHole(courseHandicap, rankByHoleN.get(hole.n)!);
    total += Math.min(gross, hole.par + 2 + strokes);
  }
  return total;
}

/** Score Differential = round₁((AdjustedGrossScore − CourseRating) × 113 / SlopeRating). */
export function computeScoreDifferential(adjustedGrossScore: number, courseRating: number, slopeRating: number): number {
  const value = ((adjustedGrossScore - courseRating) * 113) / slopeRating;
  return Math.round(value * 10) / 10;
}

/**
 * Handicap Index from a set of differentials, sorted here by VALUE (the
 * "lowest K") — not by date. Caller is responsible for passing only the
 * player's most-recent ≤20 differentials. Null if fewer than 3.
 */
export function computeHandicapIndex(differentials: number[]): number | null {
  const rule = lookupLowRoundRule(differentials.length);
  if (!rule) return null;
  const lowest = [...differentials].sort((a, b) => a - b).slice(0, rule.count);
  const average = lowest.reduce((sum, d) => sum + d, 0) / lowest.length;
  return Math.trunc((0.96 * average + rule.adjustment) * 10) / 10;
}

/** Profile's caption next to the handicap badge — varies with how many rounds are on file. */
export function handicapCaption(roundCount: number | null): string {
  if (roundCount === null) return '';
  if (roundCount === 0) return 'Play 3 rounds to unlock your handicap';
  if (roundCount === 1) return '1 round logged · play 2 more to unlock your handicap';
  if (roundCount === 2) return '2 rounds logged · play 1 more to unlock your handicap';
  if (roundCount < 20) return `Auto-counted from your last ${roundCount} rounds`;
  return 'Auto-counted from best 8 of last 20 rounds';
}

type MatchForHandicap = { courseId: string; comboId: string; holesToPlay: 9 | 18; status: MatchStatus; finishedAt: string | null };

async function fetchMatchForHandicap(matchId: string): Promise<MatchForHandicap | null> {
  const { data, error } = await supabase
    .from('matches')
    .select('course_id, combo_id, holes_to_play, status, finished_at')
    .eq('id', matchId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as { course_id: string; combo_id: string; holes_to_play: 9 | 18; status: MatchStatus; finished_at: string | null };
  return { courseId: row.course_id, comboId: row.combo_id, holesToPlay: row.holes_to_play, status: row.status, finishedAt: row.finished_at };
}

async function isPlayerSeated(matchId: string, playerId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('match_players')
    .select('player_id')
    .eq('match_id', matchId)
    .eq('player_id', playerId)
    .eq('status', 'joined')
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

async function fetchComboRating(courseId: string, comboId: string, teeColor: TeeColor): Promise<{ courseRating: number; slopeRating: number } | null> {
  const { data, error } = await supabase
    .from('course_combo_ratings')
    .select('course_rating, slope_rating')
    .eq('course_id', courseId)
    .eq('combo_id', comboId)
    .eq('tee_color', teeColor)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as { course_rating: number; slope_rating: number };
  return { courseRating: Number(row.course_rating), slopeRating: row.slope_rating };
}

async function fetchCurrentHandicap(playerId: string): Promise<number | null> {
  const { data, error } = await supabase.from('profiles').select('handicap').eq('id', playerId).single();
  if (error) throw error;
  return (data as { handicap: number | null }).handicap;
}

async function upsertDifferential(playerId: string, matchId: string, differential: number, playedAt: string): Promise<void> {
  const { error } = await supabase
    .from('handicap_differentials')
    .upsert({ player_id: playerId, match_id: matchId, differential, played_at: playedAt }, { onConflict: 'player_id,match_id', ignoreDuplicates: true });
  if (error) throw error;
}

async function fetchRecentDifferentials(playerId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('handicap_differentials')
    .select('differential')
    .eq('player_id', playerId)
    .order('played_at', { ascending: false })
    .limit(MAX_DIFFERENTIALS);
  if (error) throw error;
  return (data as { differential: number }[]).map((r) => Number(r.differential));
}

/** Total differentials on file (uncapped) — for Profile's caption copy. */
export async function fetchHandicapRecordCount(playerId: string): Promise<number> {
  return withRetry(async () => {
    const { count, error } = await supabase.from('handicap_differentials').select('*', { count: 'exact', head: true }).eq('player_id', playerId);
    if (error) throw error;
    return count ?? 0;
  });
}

/**
 * Computes and stores this player's Score Differential for one finished
 * 18-hole match, then recomputes and writes their Handicap Index from their
 * full recent history. No-ops silently if the match isn't an eligible
 * 18-hole finished match, the player didn't actually play it, their card
 * isn't fully scored, or the course/combo has no rating data yet for the
 * default tee.
 *
 * Safe to call twice for the same match — the differential upsert ignores
 * the duplicate and the index recompute is idempotent — so both of this
 * function's call sites (the host's own recalc in useLiveRound's
 * finishRound, and every viewer's own recalc on RecapScreen mount) can fire
 * for the same player without double-counting.
 */
export async function recalculateAndSaveHandicap(playerId: string, matchId: string): Promise<void> {
  return withRetry(async () => {
    const match = await fetchMatchForHandicap(matchId);
    if (!match || match.status !== 'finished' || match.holesToPlay !== 18 || !match.finishedAt) return;

    const seated = await isPlayerSeated(matchId, playerId);
    if (!seated) return;

    const scores = await fetchScores(matchId);
    if (computeThru([playerId], scores, 18) !== 18) return;

    const catalog = await fetchCourseCatalog();
    const course = catalog.find((c) => c.id === match.courseId);
    if (!course) return;
    const comboHoles = getComboHoles(course, match.comboId);
    if (comboHoles.length !== 18) return;

    const rating = await fetchComboRating(match.courseId, match.comboId, DEFAULT_TEE_COLOR);
    if (!rating) return;

    const priorIndex = await fetchCurrentHandicap(playerId);
    const coursePar = comboHoles.reduce((sum, h) => sum + h.par, 0);
    const courseHandicap = priorIndex !== null ? computeCourseHandicap(priorIndex, rating.slopeRating, rating.courseRating, coursePar) : null;

    const grossByHoleN: Record<number, number> = {};
    comboHoles.forEach((h) => {
      grossByHoleN[h.n] = scores[playerId]![h.n]!;
    });

    const holes: SiHole[] = comboHoles.map((h) => ({ n: h.n, par: h.par, si: h.si }));
    const adjustedGross = computeAdjustedGrossScore(holes, grossByHoleN, courseHandicap);
    const differential = computeScoreDifferential(adjustedGross, rating.courseRating, rating.slopeRating);

    await upsertDifferential(playerId, matchId, differential, match.finishedAt);

    const recent = await fetchRecentDifferentials(playerId);
    const newIndex = computeHandicapIndex(recent);

    const { error } = await supabase.from('profiles').update({ handicap: newIndex }).eq('id', playerId);
    if (error) throw error;
  });
}
