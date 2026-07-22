/**
 * Home/Rounds summaries: the live-or-finished matches a viewer has actually
 * joined, each reduced to the same single-number "up"/money/gross figures
 * the live-round screens compute in full. This is a one-shot read (no
 * realtime, no writes) for list rows — HomeScreen's In play/Past games and
 * RoundsScreen's Live/Past tabs all read from here.
 */

import { fetchCourseCatalog, getComboHoles } from './courses';
import { fetchLedgerStrokesForGroup } from './kaki';
import { fetchMatchups, gameModeDisplayName } from './matches';
import type { HolesCount, MatchupPair } from './matches';
import { buildAllPairs, buildPlayOrder, computeThru, grossTotal, money, pairKey, runningUp } from './round';
import type { GrossMap, Hole, RoundSchedule, StrokeDeal } from './round';
import { withRetry } from '../lib/retry';
import { fetchScores } from './scores';
import { supabase } from '../lib/supabase';

export type RoundPlayer = { playerId: string; name: string };

export type RoundSummary = {
  matchId: string;
  matchName: string;
  courseName: string;
  comboLabel: string;
  gameModeName: string;
  holesToPlay: HolesCount;
  startedAt: string | null;
  finishedAt: string | null;
  players: RoundPlayer[];
  thru: number;
  hostId: string;
  /** Match-play "up" total against the whole field — null if the viewer isn't in this match's roster. */
  viewerUp: number | null;
  viewerMoney: number | null;
  viewerGross: number | null;
};

type MatchRow = {
  id: string;
  match_name: string;
  game_mode: string;
  holes_to_play: HolesCount;
  strokes_basis: HolesCount;
  start_hole: number;
  stake_per_hole: number;
  started_at: string | null;
  finished_at: string | null;
  course_id: string;
  combo_id: string;
  host_id: string;
  courses: { name: string } | null;
};

type MatchPlayerRow = { match_id: string; player_id: string; profiles: { display_name: string } };

/** The front-9 (or flat, for an 18-basis match) deal for one pair — persisted matchup wins over the ledger fallback, same as MatchLobby/useLiveRound's seeding. */
function frontNineDeal(a: string, b: string, matchups: MatchupPair[], ledger: Record<string, number>): StrokeDeal | null {
  const m = matchups.find((r) => r.playerAId === a && r.playerBId === b);
  if (m) {
    if (m.frontNineStrokes === 0) return null;
    return m.frontNineStrokes > 0 ? { giver: a, receiver: b, amount: m.frontNineStrokes } : { giver: b, receiver: a, amount: -m.frontNineStrokes };
  }
  const net = ledger[pairKey(a, b)] ?? 0;
  const amount = Math.round(Math.abs(net) / 2);
  if (amount === 0) return null;
  return net > 0 ? { giver: a, receiver: b, amount } : { giver: b, receiver: a, amount };
}

/** Null (per pair) if that pair's mid-round re-strike hasn't landed yet — dealsAndRankForHole falls back to the front-9 deal for every hole in that case. */
function buildDeals(rosterIds: string[], matchups: MatchupPair[], ledger: Record<string, number>): { frontNineDeals: StrokeDeal[]; backNineDeals: StrokeDeal[] | null } {
  const pairs = buildAllPairs(rosterIds);
  const frontNineDeals: StrokeDeal[] = [];
  const backNineDeals: StrokeDeal[] = [];
  let backNineComplete = true;

  for (const [a, b] of pairs) {
    const front = frontNineDeal(a, b, matchups, ledger);
    if (front) frontNineDeals.push(front);

    const m = matchups.find((r) => r.playerAId === a && r.playerBId === b);
    if (!m || m.backNineStrokes == null) {
      backNineComplete = false;
    } else if (m.backNineStrokes !== 0) {
      backNineDeals.push(m.backNineStrokes > 0 ? { giver: a, receiver: b, amount: m.backNineStrokes } : { giver: b, receiver: a, amount: -m.backNineStrokes });
    }
  }

  return { frontNineDeals, backNineDeals: backNineComplete ? backNineDeals : null };
}

async function summarizeMatch(match: MatchRow, roster: RoundPlayer[], viewerId: string, course: Awaited<ReturnType<typeof fetchCourseCatalog>>[number] | undefined): Promise<RoundSummary> {
  const rosterIds = roster.map((p) => p.playerId);
  const allHoles: Hole[] = course ? getComboHoles(course, match.combo_id) : [];
  const holes = match.holes_to_play === 9 ? allHoles.slice(0, 9) : allHoles;

  const [scoreMap, matchups, ledger] = await Promise.all([
    fetchScores(match.id),
    fetchMatchups(match.id),
    fetchLedgerStrokesForGroup(rosterIds),
  ]);

  const gross: GrossMap = {};
  rosterIds.forEach((id) => {
    gross[id] = holes.map((h) => scoreMap[id]?.[h.n] ?? h.par);
  });

  const schedule: RoundSchedule = { holesToPlay: match.holes_to_play, strokesBasis: match.strokes_basis, startHole: match.start_hole };
  const playOrder = buildPlayOrder(schedule.startHole).slice(0, holes.length);
  const thru = computeThru(rosterIds, scoreMap, playOrder);
  const { frontNineDeals, backNineDeals } = buildDeals(rosterIds, matchups, ledger);

  const viewerInRoster = rosterIds.includes(viewerId);
  const viewerUp = viewerInRoster ? runningUp(rosterIds, viewerId, thru, gross, holes, frontNineDeals, schedule, backNineDeals, playOrder) : null;
  const viewerMoney = viewerInRoster ? money(rosterIds, viewerId, thru, gross, holes, frontNineDeals, schedule, backNineDeals, Number(match.stake_per_hole), playOrder) : null;
  const viewerGross = viewerInRoster ? grossTotal(viewerId, thru, gross, playOrder) : null;

  return {
    matchId: match.id,
    matchName: match.match_name,
    courseName: course?.name ?? '',
    comboLabel: course?.combos.find((c) => c.id === match.combo_id)?.label ?? '',
    gameModeName: gameModeDisplayName(match.game_mode),
    holesToPlay: match.holes_to_play,
    startedAt: match.started_at,
    finishedAt: match.finished_at,
    players: roster,
    thru,
    hostId: match.host_id,
    viewerUp,
    viewerMoney,
    viewerGross,
  };
}

/**
 * Profile stat-strip numbers derived from a viewer's finished rounds: total
 * played, their best (lowest) gross score, and win count. "Best" only looks
 * at fully completed 18-hole rounds — same scope restriction as the
 * Handicap Index (src/data/handicap.ts) — so a partial or 9-hole round
 * can't misleadingly outscore a real 18-hole one. "Wins" has no such
 * restriction — any finished round (9 or 18 holes) the viewer ended up
 * positive money on counts, regardless of leaderboard rank.
 */
export function profileRoundStats(summaries: RoundSummary[]): { rounds: number; best: number | null; wins: number } {
  const completedGross = summaries
    .filter((r) => r.holesToPlay === 18 && r.thru === 18 && r.viewerGross !== null)
    .map((r) => r.viewerGross as number);
  return {
    rounds: summaries.length,
    best: completedGross.length > 0 ? Math.min(...completedGross) : null,
    wins: summaries.filter((r) => r.viewerMoney !== null && r.viewerMoney > 0).length,
  };
}

/** Every match the viewer has joined (not just invited to) with the given status, newest first. */
export async function fetchRoundSummaries(viewerId: string, status: 'live' | 'finished'): Promise<RoundSummary[]> {
  return withRetry(() => fetchRoundSummariesOnce(viewerId, status));
}

async function fetchRoundSummariesOnce(viewerId: string, status: 'live' | 'finished'): Promise<RoundSummary[]> {
  const { data: seatedRows, error: seatedError } = await supabase
    .from('match_players')
    .select('match_id')
    .eq('player_id', viewerId)
    .eq('status', 'joined');
  if (seatedError) throw seatedError;
  const matchIds = (seatedRows as { match_id: string }[]).map((r) => r.match_id);
  if (matchIds.length === 0) return [];

  const dateColumn = status === 'live' ? 'started_at' : 'finished_at';
  const { data: matchRows, error: matchError } = await supabase
    .from('matches')
    .select('id, match_name, game_mode, holes_to_play, strokes_basis, start_hole, stake_per_hole, started_at, finished_at, course_id, combo_id, host_id, courses ( name )')
    .in('id', matchIds)
    .eq('status', status)
    .order(dateColumn, { ascending: false });
  if (matchError) throw matchError;
  const matches = matchRows as unknown as MatchRow[];
  if (matches.length === 0) return [];

  const { data: playerRows, error: playersError } = await supabase
    .from('match_players')
    .select('match_id, player_id, profiles ( display_name )')
    .in(
      'match_id',
      matches.map((m) => m.id),
    )
    .eq('status', 'joined');
  if (playersError) throw playersError;

  const playersByMatch = new Map<string, RoundPlayer[]>();
  for (const row of playerRows as unknown as MatchPlayerRow[]) {
    const list = playersByMatch.get(row.match_id) ?? [];
    list.push({ playerId: row.player_id, name: row.profiles.display_name });
    playersByMatch.set(row.match_id, list);
  }

  const catalog = await fetchCourseCatalog();

  return Promise.all(
    matches.map((match) =>
      summarizeMatch(
        match,
        playersByMatch.get(match.id) ?? [],
        viewerId,
        catalog.find((c) => c.id === match.course_id),
      ),
    ),
  );
}
