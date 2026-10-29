/**
 * Every round's results for one tournament, shaped for multiRound.ts's
 * aggregate standings — the MR6 lobby's "Overall · after R1" list and round
 * summaries today, the MR9 Overall leaderboard next. A plain fetch: callers
 * re-run it on their own realtime/focus triggers.
 *
 * The roster is Round 1's match_players (see the comment in
 * 20261029120000_multi_round_tournaments.sql); a rostered player with no
 * seat in a later round's match is DNS for that round.
 */

import { countbackKey } from './countback';
import { fetchCourseCatalog, getComboHoles } from './courses';
import type { RoundEntries } from './multiRound';
import { buildPlayOrder, computeThru } from './round';
import type { GrossMap } from './round';
import { fetchScores } from './scores';
import type { ScoreMap } from './scores';
import { computeTournamentStandings } from './strokePlay';
import type { TournamentRound, TournamentTieBreakRule } from './tournaments';
import { fetchTournamentRounds } from './tournaments';
import { withRetry } from '../lib/retry';
import { supabase } from '../lib/supabase';

export type RosterPlayer = {
  id: string;
  name: string;
  handicapIndex: number | null;
  isHost: boolean;
  status: 'joined' | 'invited';
};

export type TournamentResults = {
  rounds: TournamentRound[];
  roster: RosterPlayer[];
  entries: RoundEntries;
  tieBreakRule: TournamentTieBreakRule;
};

type SeatRow = {
  player_id: string;
  is_host: boolean;
  status: 'joined' | 'invited';
  handicap_at_time: number | null;
  playing_handicap: number | null;
  profiles: { display_name: string };
};

async function fetchSeats(matchId: string): Promise<SeatRow[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('match_players')
      .select('player_id, is_host, status, handicap_at_time, playing_handicap, profiles ( display_name )')
      .eq('match_id', matchId)
      .order('joined_at');
    if (error) throw error;
    return data as unknown as SeatRow[];
  });
}

export async function fetchTournamentResults(tournamentId: string): Promise<TournamentResults> {
  const [rounds, catalog, tieBreakRule] = await Promise.all([
    fetchTournamentRounds(tournamentId),
    fetchCourseCatalog(),
    withRetry(async () => {
      const { data, error } = await supabase.from('tournaments').select('tie_break_rule').eq('id', tournamentId).single();
      if (error) throw error;
      return (data as { tie_break_rule: TournamentTieBreakRule }).tie_break_rule;
    }),
  ]);

  const setUp = rounds.filter((r): r is TournamentRound & { matchId: string } => r.matchId !== null);
  const [seatsByRound, scoresByRound] = await Promise.all([
    Promise.all(setUp.map((r) => fetchSeats(r.matchId))),
    // A round still in setup has no scores to fetch.
    Promise.all(setUp.map((r) => (r.status === 'setup' ? Promise.resolve<ScoreMap>({}) : fetchScores(r.matchId)))),
  ]);

  const round1Seats = setUp[0]?.index === 1 ? seatsByRound[0]! : [];
  const roster: RosterPlayer[] = round1Seats.map((s) => ({
    id: s.player_id,
    name: s.profiles.display_name,
    handicapIndex: s.handicap_at_time,
    isHost: s.is_host,
    status: s.status,
  }));
  const rosterJoinedIds = roster.filter((p) => p.status === 'joined').map((p) => p.id);

  const entries: RoundEntries = {};
  setUp.forEach((round, i) => {
    const course = catalog.find((c) => c.id === round.courseId);
    if (!course || !round.comboId) return;
    const holes = getComboHoles(course, round.comboId);
    const seats = seatsByRound[i]!.filter((s) => s.status === 'joined');
    const seatedIds = seats.map((s) => s.player_id);
    const scores = scoresByRound[i]!;
    const playOrder = buildPlayOrder(round.startHole);

    const thru: Record<string, number> = {};
    const gross: GrossMap = {};
    const playingHandicaps: Record<string, number> = {};
    seats.forEach((s) => {
      thru[s.player_id] = computeThru([s.player_id], scores, playOrder);
      gross[s.player_id] = holes.map((h) => scores[s.player_id]?.[h.n] ?? h.par);
      playingHandicaps[s.player_id] = s.playing_handicap ?? 0;
    });

    computeTournamentStandings(seatedIds, thru, gross, holes, playingHandicaps, playOrder, 'shared_place').forEach((row) => {
      (entries[row.playerId] ??= {})[round.index] = {
        kind: 'played',
        gross: row.gross,
        nett: row.nett,
        toPar: row.toPar,
        thru: row.thru,
        holes: holes.length,
        countback: countbackKey(gross[row.playerId] ?? [], playingHandicaps[row.playerId] ?? 0),
      };
    });
    rosterJoinedIds
      .filter((id) => !seatedIds.includes(id))
      .forEach((id) => {
        (entries[id] ??= {})[round.index] = { kind: 'dns' };
      });
  });

  return { rounds, roster, entries, tieBreakRule };
}
