/**
 * Longest-ever consecutive-hole streaks (birdie-or-better, exact-par), backing
 * the Trophy Cabinet's "Birdie Streak" / "Par Streak" badges.
 *
 * Deliberately recomputed from scratch — walking the player's ENTIRE finished
 * match history in chronological order — rather than incrementally folded in
 * via a persisted cursor. A cursor design needs strict in-order, exactly-once
 * application per match, but this app's own finish flow already fires the
 * equivalent handicap recalc twice for the same player+match (see
 * `recalculateAndSaveHandicap`'s doc-comment and its two call sites) — a
 * cursor would need real work to stay correct under that. A full recompute
 * sidesteps ordering/double-count bugs entirely: it's a pure function of
 * already-durable data, so re-running it twice is a no-op. Cost stays bounded
 * to 3 Supabase queries regardless of history length (this module's two
 * fetches, plus the already-cached full course catalog) — reasonable for a
 * casual social app. If history size ever makes this a real perf concern, a
 * cursor/ledger table (mirroring `handicap_differentials`) can replace it.
 */

import type { BadgeState, BadgeTier } from './trophies';
import { fetchCourseCatalog, getComboHoles } from './courses';
import type { Course } from './courses';
import { withRetry } from '../lib/retry';
import { supabase } from '../lib/supabase';

/** Longest run of consecutive entries satisfying `qualifies`, scanning in order. */
export function computeLongestRun(diffs: number[], qualifies: (diff: number) => boolean): number {
  let best = 0;
  let current = 0;
  for (const diff of diffs) {
    if (qualifies(diff)) {
      current++;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }
  return best;
}

export const isBirdieOrBetter = (diff: number): boolean => diff <= -1;
export const isExactPar = (diff: number): boolean => diff === 0;

export const BIRDIE_STREAK_MIN = 3;
export const BIRDIE_STREAK_LEGENDARY = 6;
export const PAR_STREAK_MIN = 3;
export const PAR_STREAK_EPIC = 6;
export const PAR_STREAK_LEGENDARY = 9;

export function birdieStreakTier(best: number): BadgeTier {
  return best >= BIRDIE_STREAK_LEGENDARY ? 'legendary' : 'epic';
}

export function parStreakTier(best: number): BadgeTier {
  if (best >= PAR_STREAK_LEGENDARY) return 'legendary';
  if (best >= PAR_STREAK_EPIC) return 'epic';
  return 'great';
}

/** `attested` = has any kaki confirmed this badge yet (src/data/attestations.ts) — required to reach 'earned', not just the numeric threshold. */
export function streakState(best: number, min: number, attested: boolean): BadgeState {
  if (best < min) return 'locked';
  return attested ? 'earned' : 'pending';
}

export function streakMeta(best: number, min: number, attested: boolean): string {
  if (best < min) return 'Locked';
  return attested ? `${best} in a row` : 'Awaiting kaki';
}

/** True if `newBest` reaches a threshold `oldBest` hadn't already reached — a genuinely new milestone worth celebrating, not a re-crossing. */
export function crossedNewMilestone(oldBest: number, newBest: number, thresholds: number[]): boolean {
  return thresholds.some((t) => oldBest < t && newBest >= t);
}

type StreakMatch = { id: string; courseId: string; comboId: string };

/** Every match the player finished, in the order they were played (chronological, oldest first). */
async function fetchFinishedMatchesForPlayer(playerId: string): Promise<StreakMatch[]> {
  const { data: seatedRows, error: seatedError } = await supabase
    .from('match_players')
    .select('match_id')
    .eq('player_id', playerId)
    .eq('status', 'joined');
  if (seatedError) throw seatedError;
  const matchIds = (seatedRows as { match_id: string }[]).map((r) => r.match_id);
  if (matchIds.length === 0) return [];

  const { data: matchRows, error: matchError } = await supabase
    .from('matches')
    .select('id, course_id, combo_id')
    .in('id', matchIds)
    .eq('status', 'finished')
    .order('finished_at', { ascending: true });
  if (matchError) throw matchError;

  return (matchRows as { id: string; course_id: string; combo_id: string }[]).map((row) => ({
    id: row.id,
    courseId: row.course_id,
    comboId: row.combo_id,
  }));
}

/** All of this player's recorded scores across the given matches, folded into a per-match hole map. */
async function fetchScoresForMatches(playerId: string, matchIds: string[]): Promise<Map<string, Record<number, number>>> {
  const byMatch = new Map<string, Record<number, number>>();
  if (matchIds.length === 0) return byMatch;

  const { data, error } = await supabase
    .from('scores')
    .select('match_id, hole_number, gross_strokes')
    .eq('player_id', playerId)
    .in('match_id', matchIds);
  if (error) throw error;

  for (const row of data as { match_id: string; hole_number: number; gross_strokes: number }[]) {
    const holes = byMatch.get(row.match_id) ?? {};
    holes[row.hole_number] = row.gross_strokes;
    byMatch.set(row.match_id, holes);
  }
  return byMatch;
}

/**
 * Flattens a player's chronological match history into one ordered sequence of
 * `gross - par` values — one entry per hole they actually recorded a score
 * for. Unscored holes (an abandoned/partial round) are skipped rather than
 * treated as a break: the sequence is "consecutive holes actually played,"
 * not "consecutive holes in the round," which is what lets a streak carry
 * across a round boundary.
 */
function buildHoleDiffSequence(matches: StreakMatch[], scoresByMatch: Map<string, Record<number, number>>, catalog: Course[]): number[] {
  const diffs: number[] = [];
  for (const match of matches) {
    const course = catalog.find((c) => c.id === match.courseId);
    if (!course) continue;

    let comboHoles;
    try {
      comboHoles = getComboHoles(course, match.comboId);
    } catch {
      continue;
    }

    const scores = scoresByMatch.get(match.id) ?? {};
    for (const hole of comboHoles) {
      const gross = scores[hole.n];
      if (gross != null) diffs.push(gross - hole.par);
    }
  }
  return diffs;
}

export type StreakBests = { birdieBest: number; parBest: number };

/**
 * Walks a player's full finished-match history, optionally with `extraDiffs`
 * (e.g. an in-progress round's holes-so-far) appended to the end of the
 * chronological sequence, and returns their birdie/par best-ever streaks.
 * Shared by the persisting recompute below and the live, non-persisting
 * preview used during scorecard entry — same computation either way, so a
 * live check is automatically cross-round-accurate with no separate
 * seed/cursor state to keep in sync.
 */
async function computeStreakBests(playerId: string, extraDiffs: number[] = []): Promise<StreakBests> {
  const matches = await fetchFinishedMatchesForPlayer(playerId);
  const [scoresByMatch, catalog] = await Promise.all([
    fetchScoresForMatches(
      playerId,
      matches.map((m) => m.id),
    ),
    fetchCourseCatalog(),
  ]);

  const diffs = [...buildHoleDiffSequence(matches, scoresByMatch, catalog), ...extraDiffs];
  return {
    birdieBest: computeLongestRun(diffs, isBirdieOrBetter),
    parBest: computeLongestRun(diffs, isExactPar),
  };
}

/**
 * Recomputes and stores this player's best-ever birdie/par streaks from their
 * full finished-match history. No-op if they have no finished matches yet.
 * Safe to call twice (or concurrently) for the same player — see module doc.
 */
export async function recalculateAndSaveStreaks(playerId: string): Promise<void> {
  return withRetry(async () => {
    const matches = await fetchFinishedMatchesForPlayer(playerId);
    if (matches.length === 0) return;

    const { birdieBest, parBest } = await computeStreakBests(playerId);

    const { error } = await supabase
      .from('profiles')
      .update({ birdie_streak_best: birdieBest, par_streak_best: parBest })
      .eq('id', playerId);
    if (error) throw error;
  });
}

/**
 * Live, non-persisting preview: what would this player's best-ever streaks
 * be if `inProgressDiffs` (the current round's holes-so-far, in play order)
 * counted? Used by ScorecardScreen to detect a threshold crossing the
 * instant a qualifying hole is entered, before the round finishes.
 */
export async function previewLiveStreaks(playerId: string, inProgressDiffs: number[]): Promise<StreakBests> {
  return withRetry(() => computeStreakBests(playerId, inProgressDiffs));
}
