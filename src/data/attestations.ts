/**
 * Peer attestation for the streak badges (birdie_streak, par_streak) — see
 * supabase/migrations/20260711120000_badge_attestations.sql. A streak
 * crossing its threshold sits "pending" until one kaki who actually shared a
 * match roster with the player vouches for it; one attestation covers the
 * badge type permanently, however much further the streak grows afterward.
 */

import { BIRDIE_STREAK_MIN, PAR_STREAK_MIN } from './streaks';
import { withRetry } from '../lib/retry';
import { supabase } from '../lib/supabase';

export type BadgeType = 'birdie_streak' | 'par_streak';

export type AttestationStatus = { birdieStreak: boolean; parStreak: boolean };

/** Whether ANY kaki has attested each of this player's streak badges. */
export async function fetchAttestationStatus(playerId: string): Promise<AttestationStatus> {
  return withRetry(async () => {
    const { data, error } = await supabase.from('badge_attestations').select('badge_type').eq('player_id', playerId);
    if (error) throw error;
    const badgeTypes = new Set((data as { badge_type: BadgeType }[]).map((r) => r.badge_type));
    return { birdieStreak: badgeTypes.has('birdie_streak'), parStreak: badgeTypes.has('par_streak') };
  });
}

export type AttestableBadge = {
  playerId: string;
  playerName: string;
  badgeType: BadgeType;
  streakLength: number;
};

/** Streak badges the viewer is eligible to attest for kaki they've shared a match roster with, not yet attested by anyone. */
export async function fetchAttestableBadges(viewerId: string): Promise<AttestableBadge[]> {
  return withRetry(() => fetchAttestableBadgesOnce(viewerId));
}

async function fetchAttestableBadgesOnce(viewerId: string): Promise<AttestableBadge[]> {
  const { data: seatedRows, error: seatedError } = await supabase
    .from('match_players')
    .select('match_id')
    .eq('player_id', viewerId)
    .eq('status', 'joined');
  if (seatedError) throw seatedError;
  const matchIds = (seatedRows as { match_id: string }[]).map((r) => r.match_id);
  if (matchIds.length === 0) return [];

  const { data: coPlayerRows, error: coPlayerError } = await supabase
    .from('match_players')
    .select('player_id')
    .in('match_id', matchIds)
    .eq('status', 'joined')
    .neq('player_id', viewerId);
  if (coPlayerError) throw coPlayerError;
  const candidateIds = [...new Set((coPlayerRows as { player_id: string }[]).map((r) => r.player_id))];
  if (candidateIds.length === 0) return [];

  const [profilesResult, attestationsResult] = await Promise.all([
    supabase.from('profiles').select('id, display_name, birdie_streak_best, par_streak_best').in('id', candidateIds),
    supabase.from('badge_attestations').select('player_id, badge_type').in('player_id', candidateIds),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (attestationsResult.error) throw attestationsResult.error;

  const alreadyAttested = new Set(
    (attestationsResult.data as { player_id: string; badge_type: BadgeType }[]).map((r) => `${r.player_id}:${r.badge_type}`),
  );

  const attestable: AttestableBadge[] = [];
  for (const row of profilesResult.data as { id: string; display_name: string; birdie_streak_best: number | null; par_streak_best: number | null }[]) {
    if (row.birdie_streak_best !== null && row.birdie_streak_best >= BIRDIE_STREAK_MIN && !alreadyAttested.has(`${row.id}:birdie_streak`)) {
      attestable.push({ playerId: row.id, playerName: row.display_name, badgeType: 'birdie_streak', streakLength: row.birdie_streak_best });
    }
    if (row.par_streak_best !== null && row.par_streak_best >= PAR_STREAK_MIN && !alreadyAttested.has(`${row.id}:par_streak`)) {
      attestable.push({ playerId: row.id, playerName: row.display_name, badgeType: 'par_streak', streakLength: row.par_streak_best });
    }
  }
  return attestable;
}

/** Idempotent — upsert ignores a duplicate attestation from the same kaki for the same badge. */
export async function attestBadge(playerId: string, badgeType: BadgeType, attestedBy: string): Promise<void> {
  await withRetry(async () => {
    const { error } = await supabase
      .from('badge_attestations')
      .upsert({ player_id: playerId, badge_type: badgeType, attested_by: attestedBy }, { onConflict: 'player_id,badge_type,attested_by', ignoreDuplicates: true });
    if (error) throw error;
  });
}
