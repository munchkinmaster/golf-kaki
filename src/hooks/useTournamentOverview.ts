/**
 * The whole tournament, for screens that show one round of a multi-round
 * tournament (MR7 scoring strip, MR8 round tabs, MR9 Overall leaderboard).
 * Every OTHER round comes from a one-off fetchTournamentResults (refetched
 * when this round's status changes); THIS round is folded in live from the
 * screen's own useTournamentRound data, so the overall figures move hole by
 * hole without re-downloading every round's scores on each score.
 *
 * Null for a single-round tournament — those screens render as before.
 */

import { useEffect, useMemo, useState } from 'react';

import { countbackKey } from '../data/countback';
import type { PlayerRoundEntry, RoundEntries } from '../data/multiRound';
import { deriveRoundStatus, withLiveRound } from '../data/multiRound';
import { computeThru } from '../data/round';
import { computeTournamentStandings } from '../data/strokePlay';
import type { RosterPlayer, TournamentResults } from '../data/tournamentResults';
import { fetchTournamentResults } from '../data/tournamentResults';
import type { TournamentRound, TournamentTieBreakRule } from '../data/tournaments';
import type { useTournamentRound } from './useTournamentRound';

export type TournamentOverview = {
  rounds: TournamentRound[];
  entries: RoundEntries;
  roster: RosterPlayer[];
  /** Joined roster ids — the players on the overall board. */
  rosterIds: string[];
  tieBreakRule: TournamentTieBreakRule;
};

export function useTournamentOverview(tournamentId: string, round: ReturnType<typeof useTournamentRound>): TournamentOverview | null {
  const { roundsCount, roundIndex, matchStatus, roster, scores, gross, holes, playOrder, tieBreakRule, loading } = round;
  const multi = !loading && roundsCount > 1;
  const [results, setResults] = useState<TournamentResults | null>(null);

  useEffect(() => {
    if (!multi) {
      setResults(null);
      return;
    }
    let cancelled = false;
    fetchTournamentResults(tournamentId)
      .then((r) => !cancelled && setResults(r))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tournamentId, multi, matchStatus]);

  const live = useMemo(() => {
    if (!multi || holes.length === 0) return {};
    const ids = roster.map((p) => p.id);
    const handicaps = Object.fromEntries(roster.map((p) => [p.id, p.playingHandicap]));
    const thru = Object.fromEntries(ids.map((id) => [id, computeThru([id], scores, playOrder)]));
    const out: Record<string, PlayerRoundEntry> = {};
    computeTournamentStandings(ids, thru, gross, holes, handicaps, playOrder, 'shared_place').forEach((row) => {
      out[row.playerId] = {
        kind: 'played',
        gross: row.gross,
        nett: row.nett,
        toPar: row.toPar,
        thru: row.thru,
        holes: holes.length,
        countback: countbackKey(gross[row.playerId] ?? [], handicaps[row.playerId] ?? 0),
      };
    });
    return out;
  }, [multi, roster, scores, gross, holes, playOrder]);

  return useMemo(() => {
    if (!results) return null;
    const merged = withLiveRound(results.rounds, results.entries, roundIndex, deriveRoundStatus(matchStatus), live);
    return {
      rounds: merged.rounds,
      entries: merged.entries,
      roster: results.roster,
      rosterIds: results.roster.filter((p) => p.status === 'joined').map((p) => p.id),
      tieBreakRule: tieBreakRule ?? results.tieBreakRule,
    };
  }, [results, roundIndex, matchStatus, live, tieBreakRule]);
}
