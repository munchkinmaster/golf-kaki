/**
 * Peer attestation for the four one-off/streak badges (birdie_streak,
 * par_streak, hole_in_one, eagle) — see
 * supabase/migrations/20260711120000_badge_attestations.sql and
 * 20260714120000_moment_badges.sql. A badge sits "pending" until one kaki
 * who actually shared a match roster with the player vouches for it; one
 * attestation covers the badge type permanently, however much further the
 * streak grows (or however many more eagles land) afterward.
 */

import { getInitials } from './profile';
import { BIRDIE_STREAK_MIN, PAR_STREAK_MIN } from './streaks';
import { withRetry } from '../lib/retry';
import { supabase } from '../lib/supabase';

export type BadgeType = 'birdie_streak' | 'par_streak' | 'hole_in_one' | 'eagle';
type MomentBadgeType = Extract<BadgeType, 'hole_in_one' | 'eagle'>;

export type AttestationStatus = { birdieStreak: boolean; parStreak: boolean; holeInOne: boolean; eagle: boolean };

/** Whether ANY kaki has attested each of this player's badges. */
export async function fetchAttestationStatus(playerId: string): Promise<AttestationStatus> {
  return withRetry(async () => {
    const { data, error } = await supabase.from('badge_attestations').select('badge_type').eq('player_id', playerId);
    if (error) throw error;
    const badgeTypes = new Set((data as { badge_type: BadgeType }[]).map((r) => r.badge_type));
    return {
      birdieStreak: badgeTypes.has('birdie_streak'),
      parStreak: badgeTypes.has('par_streak'),
      holeInOne: badgeTypes.has('hole_in_one'),
      eagle: badgeTypes.has('eagle'),
    };
  });
}

export type AttestableBadge = {
  playerId: string;
  playerName: string;
  badgeType: BadgeType;
  /** "6 in a row" for a streak, "Tanah Merah · hole 7" for a moment badge. */
  detail: string;
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

  const [profilesResult, attestationsResult, momentsResult] = await Promise.all([
    supabase.from('profiles').select('id, display_name, birdie_streak_best, par_streak_best').in('id', candidateIds),
    supabase.from('badge_attestations').select('player_id, badge_type').in('player_id', candidateIds),
    supabase
      .from('badge_moments')
      .select('player_id, badge_type, hole_number, achieved_at, courses ( name )')
      .in('player_id', candidateIds)
      .order('achieved_at', { ascending: false }),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (attestationsResult.error) throw attestationsResult.error;
  if (momentsResult.error) throw momentsResult.error;

  const alreadyAttested = new Set(
    (attestationsResult.data as { player_id: string; badge_type: BadgeType }[]).map((r) => `${r.player_id}:${r.badge_type}`),
  );
  const nameById = new Map(
    (profilesResult.data as { id: string; display_name: string }[]).map((row) => [row.id, row.display_name]),
  );

  const attestable: AttestableBadge[] = [];
  for (const row of profilesResult.data as { id: string; display_name: string; birdie_streak_best: number | null; par_streak_best: number | null }[]) {
    if (row.birdie_streak_best !== null && row.birdie_streak_best >= BIRDIE_STREAK_MIN && !alreadyAttested.has(`${row.id}:birdie_streak`)) {
      attestable.push({ playerId: row.id, playerName: row.display_name, badgeType: 'birdie_streak', detail: `${row.birdie_streak_best} in a row` });
    }
    if (row.par_streak_best !== null && row.par_streak_best >= PAR_STREAK_MIN && !alreadyAttested.has(`${row.id}:par_streak`)) {
      attestable.push({ playerId: row.id, playerName: row.display_name, badgeType: 'par_streak', detail: `${row.par_streak_best} in a row` });
    }
  }

  // Moment badges (Hole-in-One, Eagle): one attestable entry per player+type,
  // from their most recent qualifying hole — rows arrive date-desc, so the
  // first hit per (player, type) is the latest.
  const seenMoment = new Set<string>();
  for (const row of momentsResult.data as unknown as { player_id: string; badge_type: MomentBadgeType; hole_number: number; courses: { name: string } | null }[]) {
    const key = `${row.player_id}:${row.badge_type}`;
    if (seenMoment.has(key) || alreadyAttested.has(key)) continue;
    seenMoment.add(key);
    const playerName = nameById.get(row.player_id);
    if (!playerName) continue;
    const courseName = row.courses?.name ?? 'a round';
    attestable.push({ playerId: row.player_id, playerName, badgeType: row.badge_type, detail: `${courseName} · hole ${row.hole_number}` });
  }

  return attestable;
}

export type Attester = { name: string; initials: string };

/**
 * Real kaki who vouched for this badge — excludes the grandfather
 * self-attestation (see the migrations' backfill: attested_by = player_id
 * for badges that already qualified when attestation shipped), so a badge
 * nobody has actually confirmed yet correctly comes back empty rather than
 * showing the owner as their own witness.
 */
export async function fetchAttesters(playerId: string, badgeType: BadgeType): Promise<Attester[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('badge_attestations')
      .select('attested_by, profiles!badge_attestations_attested_by_fkey ( display_name )')
      .eq('player_id', playerId)
      .eq('badge_type', badgeType)
      .neq('attested_by', playerId);
    if (error) throw error;
    return (data as unknown as { attested_by: string; profiles: { display_name: string } | null }[])
      .filter((row) => row.profiles !== null)
      .map((row) => ({ name: row.profiles!.display_name, initials: getInitials(row.profiles!.display_name) }));
  });
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
