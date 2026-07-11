/**
 * Hole-in-One / Eagle — one-off per-hole moments, not a running "best" like
 * the streak badges (see src/data/streaks.ts): either a hole ever qualified
 * or it didn't. Detected from a single just-finished match's own scores
 * (cheap — one match's holes, not the player's whole history) and persisted
 * as they happen. See supabase/migrations/20260714120000_moment_badges.sql.
 */

import type { BadgeState } from './trophies';
import { fetchCourseCatalog, getComboHoles } from './courses';
import type { MatchStatus } from './matches';
import { fetchScores } from './scores';
import { withRetry } from '../lib/retry';
import { supabase } from '../lib/supabase';

export type MomentBadgeType = 'hole_in_one' | 'eagle';

export type BadgeMoment = {
  badgeType: MomentBadgeType;
  matchId: string;
  courseId: string;
  courseName: string;
  holeNumber: number;
  achievedAt: string;
};

export type MomentBadges = Record<MomentBadgeType, BadgeMoment | null>;

type MatchForMoments = { courseId: string; comboId: string; status: MatchStatus; finishedAt: string | null };

async function fetchMatchForMoments(matchId: string): Promise<MatchForMoments | null> {
  const { data, error } = await supabase.from('matches').select('course_id, combo_id, status, finished_at').eq('id', matchId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as { course_id: string; combo_id: string; status: MatchStatus; finished_at: string | null };
  return { courseId: row.course_id, comboId: row.combo_id, status: row.status, finishedAt: row.finished_at };
}

/**
 * Detects and persists this player's Hole-in-One/Eagle moments for one
 * just-finished match, from their own recorded scores. No-ops if the match
 * isn't finished or the player never scored a hole in it. Safe to call
 * twice — the upsert ignores a duplicate (player_id, match_id, badge_type,
 * hole_number) — same two call sites as recalculateAndSaveHandicap/Streaks
 * (RecapScreen's mount effect and useLiveRound's finishRound).
 */
export async function recalculateAndSaveMomentBadges(playerId: string, matchId: string): Promise<void> {
  return withRetry(async () => {
    const match = await fetchMatchForMoments(matchId);
    if (!match || match.status !== 'finished' || !match.finishedAt) return;

    const scores = await fetchScores(matchId);
    const playerScores = scores[playerId];
    if (!playerScores) return;

    const catalog = await fetchCourseCatalog();
    const course = catalog.find((c) => c.id === match.courseId);
    if (!course) return;
    const comboHoles = getComboHoles(course, match.comboId);

    const rows: { player_id: string; badge_type: MomentBadgeType; match_id: string; course_id: string; hole_number: number; achieved_at: string }[] = [];
    for (const hole of comboHoles) {
      const gross = playerScores[hole.n];
      if (gross == null) continue;
      const badgeType: MomentBadgeType | null = gross === 1 ? 'hole_in_one' : gross - hole.par <= -2 ? 'eagle' : null;
      if (!badgeType) continue;
      rows.push({
        player_id: playerId,
        badge_type: badgeType,
        match_id: matchId,
        course_id: match.courseId,
        hole_number: hole.n,
        achieved_at: match.finishedAt,
      });
    }
    if (rows.length === 0) return;

    const { error } = await supabase
      .from('badge_moments')
      .upsert(rows, { onConflict: 'player_id,match_id,badge_type,hole_number', ignoreDuplicates: true });
    if (error) throw error;
  });
}

type MomentRow = {
  badge_type: MomentBadgeType;
  match_id: string;
  course_id: string;
  hole_number: number;
  achieved_at: string;
  courses: { name: string } | null;
};

/** This player's most recent moment of each type — null if they've never had one. Backs the Trophy Cabinet meta text and (once earned) the Featured/Brag cards. */
export async function fetchLatestMoments(playerId: string): Promise<MomentBadges> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('badge_moments')
      .select('badge_type, match_id, course_id, hole_number, achieved_at, courses ( name )')
      .eq('player_id', playerId)
      .order('achieved_at', { ascending: false });
    if (error) throw error;

    const result: MomentBadges = { hole_in_one: null, eagle: null };
    for (const row of data as unknown as MomentRow[]) {
      if (result[row.badge_type]) continue; // rows are date-desc — first hit per type is the latest
      result[row.badge_type] = {
        badgeType: row.badge_type,
        matchId: row.match_id,
        courseId: row.course_id,
        courseName: row.courses?.name ?? '',
        holeNumber: row.hole_number,
        achievedAt: row.achieved_at,
      };
    }
    return result;
  });
}

/** `attested` = has any kaki confirmed this moment yet (src/data/attestations.ts) — required to reach 'earned', not just having the moment on file. */
export function momentState(moment: BadgeMoment | null, attested: boolean): BadgeState {
  if (!moment) return 'locked';
  return attested ? 'earned' : 'pending';
}

export function momentMeta(moment: BadgeMoment | null, attested: boolean): string {
  if (!moment) return 'Locked';
  return attested ? moment.courseName || 'Earned' : 'Awaiting kaki';
}
