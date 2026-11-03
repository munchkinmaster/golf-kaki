/**
 * Home/Rounds summaries: the live-or-finished matches a viewer has actually
 * joined, each reduced to the same single-number "up"/money/gross figures
 * the live-round screens compute in full. This is a one-shot read (no
 * realtime, no writes) for list rows — HomeScreen's In play/Past games and
 * RoundsScreen's Live/Past tabs all read from here.
 */

import { fetchCourseCatalog, getComboHoles } from './courses';
import { gameModeDisplayName } from './matches';
import type { HolesCount, MatchupPair } from './matches';
import { buildAllPairs, buildPlayOrder, computeThru, grossTotal, money, pairKey, runningUp } from './round';
import type { GrossMap, Hole, HoleScoreMap, RoundSchedule, StrokeDeal } from './round';
import { withRetry } from '../lib/retry';
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
  /** Non-null for a tournament (stroke play) match — routes to TournamentLobby/TournamentFinish instead of MatchLobby/Scorecard/Recap, which assume Kaki Match Play's pairwise structure. See tournaments.ts's module comment. */
  tournamentId: string | null;
  /** Set for a tournament round: the tournament's name, how many rounds it has, and which one this is — a multi-round tournament's rounds are folded into one Past games entry (see pastGames.ts). */
  tournamentName: string | null;
  tournamentRoundsCount: number | null;
  tournamentRoundIndex: number | null;
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
  tournament_id: string | null;
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

/**
 * PostgREST silently truncates a response at the project's max-rows (1000 —
 * supabase/config.toml, and the hosted default) instead of erroring, and a
 * long `.in()` list makes for a long request URL. A bulk read across every
 * match a viewer has played can hit both, so it goes in chunks of ids, each
 * paged until a short page. Each query must order by a unique key so pages
 * don't overlap or skip.
 */
const PAGE_SIZE = 1000;
const ID_CHUNK = 50;

async function selectAllIn<R>(
  ids: string[],
  query: (chunk: string[], from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<R[]> {
  const rows: R[] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK);
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await query(chunk, from, from + PAGE_SIZE - 1);
      if (error) throw error;
      const page = data as R[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
  }
  return rows;
}

/** Every score in these matches, as one ScoreMap per match — the bulk form of scores.ts's fetchScores. */
async function fetchScoresForMatches(matchIds: string[]): Promise<Map<string, HoleScoreMap>> {
  const rows = await selectAllIn<{ match_id: string; player_id: string; hole_number: number; gross_strokes: number }>(matchIds, (chunk, from, to) =>
    supabase
      .from('scores')
      .select('match_id, player_id, hole_number, gross_strokes')
      .in('match_id', chunk)
      .order('match_id')
      .order('player_id')
      .order('hole_number')
      .range(from, to),
  );
  const byMatch = new Map<string, HoleScoreMap>();
  for (const row of rows) {
    let scores = byMatch.get(row.match_id);
    if (!scores) byMatch.set(row.match_id, (scores = {}));
    (scores[row.player_id] ??= {})[row.hole_number] = row.gross_strokes;
  }
  return byMatch;
}

/** Every pair's persisted deal in these matches, per match — the bulk form of matches.ts's fetchMatchups. */
async function fetchMatchupsForMatches(matchIds: string[]): Promise<Map<string, MatchupPair[]>> {
  const rows = await selectAllIn<{ match_id: string; player_a_id: string; player_b_id: string; front_nine_strokes: number; back_nine_strokes: number | null }>(
    matchIds,
    (chunk, from, to) =>
      supabase
        .from('game_matchups')
        .select('match_id, player_a_id, player_b_id, front_nine_strokes, back_nine_strokes')
        .in('match_id', chunk)
        .order('match_id')
        .order('player_a_id')
        .order('player_b_id')
        .range(from, to),
  );
  const byMatch = new Map<string, MatchupPair[]>();
  for (const row of rows) {
    const list = byMatch.get(row.match_id) ?? [];
    list.push({ playerAId: row.player_a_id, playerBId: row.player_b_id, frontNineStrokes: row.front_nine_strokes, backNineStrokes: row.back_nine_strokes });
    byMatch.set(row.match_id, list);
  }
  return byMatch;
}

/**
 * Ledger strokes between any two of these players, keyed by pairKey — the
 * bulk form of kaki.ts's fetchLedgerStrokesForGroup, run once over every
 * match's roster combined. A pair only ever reads its own key, so the extra
 * cross-match pairs this returns are simply never looked up.
 */
async function fetchLedgerStrokesForPlayers(playerIds: string[]): Promise<Record<string, number>> {
  if (playerIds.length < 2) return {};
  const rows = await selectAllIn<{ player_a_id: string; player_b_id: string; net_strokes_per_9: number }>(playerIds, (chunk, from, to) =>
    supabase
      .from('kaki_relationships')
      .select('player_a_id, player_b_id, net_strokes_per_9')
      .eq('status', 'accepted')
      .in('player_a_id', chunk)
      .in('player_b_id', playerIds)
      .order('player_a_id')
      .order('player_b_id')
      .range(from, to),
  );
  const strokes: Record<string, number> = {};
  for (const row of rows) {
    // kaki_relationships already stores player_a_id < player_b_id, so this is already canonical.
    strokes[`${row.player_a_id}:${row.player_b_id}`] = row.net_strokes_per_9 * 2;
  }
  return strokes;
}

function summarizeMatch(
  match: MatchRow,
  roster: RoundPlayer[],
  viewerId: string,
  course: Awaited<ReturnType<typeof fetchCourseCatalog>>[number] | undefined,
  scoreMap: HoleScoreMap,
  matchups: MatchupPair[],
  ledger: Record<string, number>,
): RoundSummary {
  const rosterIds = roster.map((p) => p.playerId);
  const allHoles: Hole[] = course ? getComboHoles(course, match.combo_id) : [];
  const holes = match.holes_to_play === 9 ? allHoles.slice(0, 9) : allHoles;
  const isTournament = match.tournament_id !== null;

  // A tournament roster has no pairwise stroke deals to seed (its matchups/
  // ledger aren't even fetched — see fetchRoundSummariesOnce) — skip the
  // whole match-play engine below and leave viewerUp/viewerMoney null, same
  // as a viewer who isn't in the roster at all. viewerGross still comes from
  // the mode-agnostic grossTotal, since a tournament round's gross
  // legitimately belongs in "best gross" stats.
  const gross: GrossMap = {};
  rosterIds.forEach((id) => {
    gross[id] = holes.map((h) => scoreMap[id]?.[h.n] ?? h.par);
  });

  const schedule: RoundSchedule = { holesToPlay: match.holes_to_play, strokesBasis: match.strokes_basis, startHole: match.start_hole };
  const playOrder = buildPlayOrder(schedule.startHole).slice(0, holes.length);
  const thru = computeThru(rosterIds, scoreMap, playOrder);
  const viewerInRoster = rosterIds.includes(viewerId);
  const viewerGross = viewerInRoster ? grossTotal(viewerId, thru, gross, playOrder) : null;

  let viewerUp: number | null = null;
  let viewerMoney: number | null = null;
  if (!isTournament && viewerInRoster) {
    const { frontNineDeals, backNineDeals } = buildDeals(rosterIds, matchups, ledger);
    viewerUp = runningUp(rosterIds, viewerId, thru, gross, holes, frontNineDeals, schedule, backNineDeals, playOrder);
    viewerMoney = money(rosterIds, viewerId, thru, gross, holes, frontNineDeals, schedule, backNineDeals, Number(match.stake_per_hole), playOrder);
  }

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
    tournamentId: match.tournament_id,
    tournamentName: null,
    tournamentRoundsCount: null,
    tournamentRoundIndex: null,
    viewerUp,
    viewerMoney,
    viewerGross,
  };
}

/** A finished round that ended before every hole was scored (host tapped Finish early, not a full 18/9) — Home and Rounds both mute this round's card rather than presenting it as a normal completed result. */
export function isIncompleteRound(round: Pick<RoundSummary, 'thru' | 'holesToPlay'>): boolean {
  return round.thru < round.holesToPlay;
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
    .select('id, match_name, game_mode, holes_to_play, strokes_basis, start_hole, stake_per_hole, started_at, finished_at, course_id, combo_id, host_id, tournament_id, courses ( name )')
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

  // One bulk read per table across every match, rather than a scores +
  // matchups + ledger round-trip per match — Profile reads every finished
  // round the viewer has ever played, so the per-match version grew without
  // bound. Tournament matches have no pairwise deals, so they're left out of
  // the matchups/ledger reads.
  const matchPlayIds = matches.filter((m) => m.tournament_id === null).map((m) => m.id);
  const matchPlayPlayerIds = [...new Set(matchPlayIds.flatMap((id) => (playersByMatch.get(id) ?? []).map((p) => p.playerId)))];
  const [catalog, tournamentInfo, scoresByMatch, matchupsByMatch, ledger] = await Promise.all([
    fetchCourseCatalog(),
    fetchTournamentInfo(matches),
    fetchScoresForMatches(matches.map((m) => m.id)),
    fetchMatchupsForMatches(matchPlayIds),
    fetchLedgerStrokesForPlayers(matchPlayPlayerIds),
  ]);

  const summaries = matches.map((match) =>
    summarizeMatch(
      match,
      playersByMatch.get(match.id) ?? [],
      viewerId,
      catalog.find((c) => c.id === match.course_id),
      scoresByMatch.get(match.id) ?? {},
      matchupsByMatch.get(match.id) ?? [],
      ledger,
    ),
  );
  return summaries.map((summary) => ({ ...summary, ...(tournamentInfo.get(summary.matchId) ?? {}) }));
}

/** Tournament name / round count / round number for every tournament match in the list, keyed by match id. */
async function fetchTournamentInfo(
  matches: MatchRow[],
): Promise<Map<string, Pick<RoundSummary, 'tournamentName' | 'tournamentRoundsCount' | 'tournamentRoundIndex'>>> {
  const tournamentMatches = matches.filter((m) => m.tournament_id !== null);
  const info = new Map<string, Pick<RoundSummary, 'tournamentName' | 'tournamentRoundsCount' | 'tournamentRoundIndex'>>();
  if (tournamentMatches.length === 0) return info;

  const [{ data: tRows, error: tError }, { data: rRows, error: rError }] = await Promise.all([
    supabase
      .from('tournaments')
      .select('id, name, rounds_count')
      .in('id', [...new Set(tournamentMatches.map((m) => m.tournament_id!))]),
    supabase
      .from('tournament_rounds')
      .select('match_id, round_index')
      .in(
        'match_id',
        tournamentMatches.map((m) => m.id),
      ),
  ]);
  if (tError) throw tError;
  if (rError) throw rError;
  const tournaments = new Map((tRows as { id: string; name: string; rounds_count: number }[]).map((t) => [t.id, t]));
  const roundIndexByMatch = new Map((rRows as { match_id: string; round_index: number }[]).map((r) => [r.match_id, r.round_index]));

  for (const m of tournamentMatches) {
    const t = tournaments.get(m.tournament_id!);
    info.set(m.id, { tournamentName: t?.name ?? null, tournamentRoundsCount: t?.rounds_count ?? null, tournamentRoundIndex: roundIndexByMatch.get(m.id) ?? null });
  }
  return info;
}
