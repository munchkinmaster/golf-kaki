/**
 * Past games, with every round of a multi-round tournament folded into ONE
 * entry (product decision: a tournament shows as one tournament with all its
 * rounds' results in it, not one card per round). Single rounds — Kaki Match
 * Play games and single-round tournaments — pass through unchanged. Pure, so
 * Home and Rounds share it.
 */

export type PastRoundLike = {
  matchId: string;
  tournamentId: string | null;
  /** Non-null only for a multi-round tournament's round. */
  tournamentRoundsCount: number | null;
};

export type PastGameEntry<R extends PastRoundLike> =
  | { kind: 'round'; key: string; round: R }
  /** `rounds` newest first, as they arrived. */
  | { kind: 'tournament'; key: string; tournamentId: string; roundsCount: number; rounds: R[] };

/** Keeps the incoming (newest-first) order: a tournament sits where its most recent round would have. */
export function groupPastRounds<R extends PastRoundLike>(rounds: R[]): PastGameEntry<R>[] {
  const entries: PastGameEntry<R>[] = [];
  const byTournament = new Map<string, Extract<PastGameEntry<R>, { kind: 'tournament' }>>();
  for (const round of rounds) {
    if (round.tournamentId === null || round.tournamentRoundsCount === null || round.tournamentRoundsCount < 2) {
      entries.push({ kind: 'round', key: round.matchId, round });
      continue;
    }
    const existing = byTournament.get(round.tournamentId);
    if (existing) {
      existing.rounds.push(round);
      continue;
    }
    const entry = { kind: 'tournament' as const, key: `t:${round.tournamentId}`, tournamentId: round.tournamentId, roundsCount: round.tournamentRoundsCount, rounds: [round] };
    byTournament.set(round.tournamentId, entry);
    entries.push(entry);
  }
  return entries;
}
