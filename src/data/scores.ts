/**
 * Live-round scoring: hole-by-hole gross scores (`scores`), the mid-round
 * back-9 re-strike write (`game_matchups.back_nine_strokes`), and finishing a
 * match. Pairwise stroke *deals* themselves (front-9 config, ledger fallback)
 * stay in data/matches.ts (fetchMatchups/upsertMatchup) — this module only
 * adds the one game_matchups column those didn't need yet.
 */

import type { HoleScoreMap } from './round';
import { withRetry } from '../lib/retry';
import { supabase } from '../lib/supabase';

export type ScoreMap = HoleScoreMap;

/** Every score row recorded for this match so far, folded into a sparse per-player/per-hole map. */
export async function fetchScores(matchId: string): Promise<ScoreMap> {
  return withRetry(() => fetchScoresOnce(matchId));
}

async function fetchScoresOnce(matchId: string): Promise<ScoreMap> {
  const { data, error } = await supabase.from('scores').select('player_id, hole_number, gross_strokes').eq('match_id', matchId);
  if (error) throw error;

  const scores: ScoreMap = {};
  for (const row of data as { player_id: string; hole_number: number; gross_strokes: number }[]) {
    (scores[row.player_id] ??= {})[row.hole_number] = row.gross_strokes;
  }
  return scores;
}

/** Upsert on (match_id, player_id, hole_number) — safe to retry blindly. */
export async function saveScore(matchId: string, playerId: string, holeNumber: number, grossStrokes: number): Promise<void> {
  await withRetry(async () => {
    const { error } = await supabase
      .from('scores')
      .upsert(
        { match_id: matchId, player_id: playerId, hole_number: holeNumber, gross_strokes: grossStrokes },
        { onConflict: 'match_id,player_id,hole_number' },
      );
    if (error) throw error;
  });
}

/**
 * Persists one pair's re-struck back-9 deal. Omits `front_nine_strokes` from
 * the payload on purpose: on conflict, Postgrest only updates columns it was
 * given, so an existing front-9 value is left untouched; on first insert for
 * a pair nobody ever configured in the Lobby, the column's own `default 0`
 * fills in. Idempotent — safe to retry or to have two clients race on it.
 */
export async function upsertMatchupBackNine(matchId: string, playerAId: string, playerBId: string, backNineStrokes: number): Promise<void> {
  await withRetry(async () => {
    const [player_a_id, player_b_id] = playerAId < playerBId ? [playerAId, playerBId] : [playerBId, playerAId];
    const { error } = await supabase
      .from('game_matchups')
      .upsert({ match_id: matchId, player_a_id, player_b_id, back_nine_strokes: backNineStrokes }, { onConflict: 'match_id,player_a_id,player_b_id' });
    if (error) throw error;
  });
}

export type LedgerDeal = { playerAId: string; playerBId: string; netStrokesPer9: number };

/**
 * Atomically flips the match to 'finished' and settles every pairwise
 * carry-forward deal into kaki_relationships, in one DB transaction (the
 * `finish_match` RPC — see its migration comment for why this can't be two
 * separate calls). Host-only; enforced inside the RPC itself, not by RLS,
 * since the function runs security definer to get past kaki_relationships'
 * participants-only write policy. Idempotent to retry: re-running just
 * re-applies the same deals and a fresh finished_at.
 */
export async function finishMatchAndSettleLedger(matchId: string, deals: LedgerDeal[]): Promise<string> {
  return withRetry(async () => {
    const { data, error } = await supabase.rpc('finish_match', {
      p_match_id: matchId,
      p_deals: deals.map((d) => ({ player_a_id: d.playerAId, player_b_id: d.playerBId, net_strokes_per_9: d.netStrokesPer9 })),
    });
    if (error) throw error;
    return data as string;
  });
}
