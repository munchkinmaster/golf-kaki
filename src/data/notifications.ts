/**
 * "Earlier" history for the Notifications screen — recent finished-round
 * settlements and recently-accepted kaki relationships, newest first. No new
 * table: these are always just the most recent few, computed live from data
 * that already exists elsewhere (rounds.ts, kaki_relationships), the same
 * "no persisted read state" choice made for the Today section's unread count.
 */

import { fetchRoundSummaries } from './rounds';
import { supabase } from '../lib/supabase';

const EARLIER_LIMIT = 5;

export type EarlierItem =
  | { type: 'result'; key: string; matchId: string; matchName: string; courseName: string; gameModeName: string; won: boolean; money: number; at: string }
  | { type: 'kaki'; key: string; relationshipId: string; name: string; at: string };

type RecentlyAcceptedKakiRow = {
  id: string;
  updated_at: string;
  player_a_id: string;
  player_b_id: string;
  player_a: { display_name: string };
  player_b: { display_name: string };
};

async function fetchRecentlyAcceptedKaki(viewerId: string): Promise<{ relationshipId: string; name: string; acceptedAt: string }[]> {
  const { data, error } = await supabase
    .from('kaki_relationships')
    .select(
      `id, updated_at, player_a_id, player_b_id,
       player_a:profiles!kaki_relationships_player_a_id_fkey ( display_name ),
       player_b:profiles!kaki_relationships_player_b_id_fkey ( display_name )`,
    )
    .or(`player_a_id.eq.${viewerId},player_b_id.eq.${viewerId}`)
    .eq('status', 'accepted')
    .order('updated_at', { ascending: false })
    .limit(EARLIER_LIMIT);
  if (error) throw error;

  return (data as unknown as RecentlyAcceptedKakiRow[]).map((row) => ({
    relationshipId: row.id,
    name: row.player_a_id === viewerId ? row.player_b.display_name : row.player_a.display_name,
    acceptedAt: row.updated_at,
  }));
}

export async function fetchEarlierActivity(viewerId: string): Promise<EarlierItem[]> {
  const [rounds, acceptedKaki] = await Promise.all([fetchRoundSummaries(viewerId, 'finished'), fetchRecentlyAcceptedKaki(viewerId)]);

  const results: EarlierItem[] = rounds
    .filter((r): r is typeof r & { finishedAt: string; viewerMoney: number } => r.finishedAt !== null && r.viewerMoney !== null)
    .slice(0, EARLIER_LIMIT)
    .map((r) => ({
      type: 'result',
      key: `result:${r.matchId}`,
      matchId: r.matchId,
      matchName: r.matchName,
      courseName: r.courseName,
      gameModeName: r.gameModeName,
      won: r.viewerMoney > 0,
      money: r.viewerMoney,
      at: r.finishedAt,
    }));

  const kakiItems: EarlierItem[] = acceptedKaki.map((k) => ({
    type: 'kaki',
    key: `kaki:${k.relationshipId}`,
    relationshipId: k.relationshipId,
    name: k.name,
    at: k.acceptedAt,
  }));

  return [...results, ...kakiItems].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, EARLIER_LIMIT);
}

/** "2 days ago" / "Today" — coarse, day-level granularity is all this list needs. */
export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}
