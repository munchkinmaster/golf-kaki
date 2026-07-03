/**
 * Shared mock round — same hole-by-hole gross scores feed the Scorecard,
 * Leaderboard, Finish, and Recap screens so the numbers always agree.
 *
 * Kaki Match Play strokes are whatever each PAIR agreed in the Match Lobby —
 * handicap index plays no part in the ongoing match, though it's a sensible
 * way to strike the very first deal (the two lobby-configured pairs below
 * both happen to equal their handicap gap; the third pair, which the lobby
 * UI doesn't expose a control for, defaults to its handicap gap the same
 * way). Every PAIR of players has its own independent deal — there's no
 * single "the field's strokes," each side-bet is handicapped on its own.
 *
 * Each deal is preset for the front 9 only, allocated to the hardest holes
 * in that pair's agreed amount (by stroke index). The deal is re-struck once
 * at hole 10: for every full 2-hole net swing in the front-9 head-to-head
 * for that pair, the stroke count shifts by 1 (lose more, receive more
 * help; win more, give more / need less) — then fixed for holes 10-18, no
 * further recompute. The same re-strike happens again at the end of the
 * round, from the back-9 record, producing the deal each pair would carry
 * into their next round together.
 */

import { colors, palette } from '../theme/tokens';

export type PlayerKey = 'A' | 'B' | 'C';

export type Hole = { n: number; par: number; si: number };

export const HOLES: Hole[] = [
  { n: 1, par: 4, si: 5 }, { n: 2, par: 5, si: 11 }, { n: 3, par: 3, si: 17 },
  { n: 4, par: 4, si: 1 }, { n: 5, par: 4, si: 7 }, { n: 6, par: 5, si: 3 },
  { n: 7, par: 3, si: 15 }, { n: 8, par: 4, si: 9 }, { n: 9, par: 4, si: 13 },
  { n: 10, par: 4, si: 6 }, { n: 11, par: 4, si: 12 }, { n: 12, par: 3, si: 18 },
  { n: 13, par: 5, si: 2 }, { n: 14, par: 4, si: 8 }, { n: 15, par: 4, si: 4 },
  { n: 16, par: 3, si: 16 }, { n: 17, par: 5, si: 10 }, { n: 18, par: 4, si: 14 },
];

export const PLAYERS: { key: PlayerKey; name: string; handicap: number; avatarBg: string; avatarFg: string }[] = [
  { key: 'A', name: 'Marcus', handicap: 2, avatarBg: palette.green[100], avatarFg: colors.primary },
  { key: 'B', name: 'Wei Liang', handicap: 7, avatarBg: palette.orange[200], avatarFg: palette.orange[700] },
  { key: 'C', name: 'Dinesh', handicap: 16, avatarBg: palette.sand[200], avatarFg: palette.ink[500] },
];

export const VIEWER_KEY: PlayerKey = 'B';
export const STAKE = 2;

export const GROSS: Record<PlayerKey, number[]> = {
  A: [4, 5, 2, 4, 4, 6, 3, 5, 4, 4, 5, 3, 5, 4, 4, 3, 5, 4],
  B: [5, 6, 3, 5, 4, 5, 4, 4, 5, 5, 4, 4, 6, 5, 4, 3, 6, 5],
  C: [6, 7, 4, 5, 6, 7, 4, 6, 5, 5, 5, 4, 6, 5, 5, 4, 6, 5],
};

export const COURSE_PAR = HOLES.reduce((sum, h) => sum + h.par, 0);

type GrossMap = Record<PlayerKey, number[]>;

export type StrokeDeal = { giver: PlayerKey; receiver: PlayerKey; amount: number };

const ALL_PAIRS: [PlayerKey, PlayerKey][] = (() => {
  const pairs: [PlayerKey, PlayerKey][] = [];
  for (let i = 0; i < PLAYERS.length; i++) {
    for (let j = i + 1; j < PLAYERS.length; j++) pairs.push([PLAYERS[i].key, PLAYERS[j].key]);
  }
  return pairs;
})();

function findDeal(deals: StrokeDeal[], p1: PlayerKey, p2: PlayerKey): StrokeDeal | undefined {
  return deals.find((d) => (d.giver === p1 && d.receiver === p2) || (d.giver === p2 && d.receiver === p1));
}

function playerHandicap(key: PlayerKey): number {
  return PLAYERS.find((p) => p.key === key)!.handicap;
}

export type StrokeMode = 'get' | 'give';

/** "Get" = the viewer receives strokes from this opponent; "give" = the viewer spots them. */
export function viewerStrokeAgainst(opponentKey: PlayerKey, deals: StrokeDeal[]): { strokes: number; mode: StrokeMode } {
  const deal = findDeal(deals, VIEWER_KEY, opponentKey);
  if (!deal) return { strokes: 0, mode: 'give' };
  return deal.giver === opponentKey ? { strokes: deal.amount, mode: 'get' } : { strokes: deal.amount, mode: 'give' };
}

export function buildViewerDeal(opponentKey: PlayerKey, strokes: number, mode: StrokeMode): StrokeDeal {
  return mode === 'get'
    ? { giver: opponentKey, receiver: VIEWER_KEY, amount: strokes }
    : { giver: VIEWER_KEY, receiver: opponentKey, amount: strokes };
}

// Agreed in the Match Lobby — defaults to Marcus gives the viewer 5, the
// viewer gives Dinesh 9, matching the lobby's default stroke settings. The
// lobby UI only lets the host set strokes vs themselves, so any pair left
// unconfigured (e.g. Marcus vs Dinesh) defaults to its handicap gap.
const DEFAULT_CONFIGURED_DEALS: StrokeDeal[] = [
  { giver: 'A', receiver: 'B', amount: 5 },
  { giver: 'B', receiver: 'C', amount: 9 },
];

/** Fills in any pair the lobby didn't configure with their handicap gap. */
export function buildFrontNineDeals(configured: StrokeDeal[] = DEFAULT_CONFIGURED_DEALS): StrokeDeal[] {
  const deals = [...configured];
  ALL_PAIRS.forEach(([p1, p2]) => {
    if (findDeal(deals, p1, p2)) return;
    const gap = Math.abs(playerHandicap(p1) - playerHandicap(p2));
    if (gap === 0) return;
    const giver = playerHandicap(p1) < playerHandicap(p2) ? p1 : p2;
    const receiver = playerHandicap(p1) < playerHandicap(p2) ? p2 : p1;
    deals.push({ giver, receiver, amount: gap });
  });
  return deals;
}

const DEFAULT_FRONT_NINE_DEALS = buildFrontNineDeals();

function rankBySi(holes: Hole[]): Record<number, number> {
  const ranked = holes.map((h) => ({ n: h.n, si: h.si })).sort((a, b) => a.si - b.si);
  const rank: Record<number, number> = {};
  ranked.forEach((h, i) => {
    rank[h.n] = i + 1;
  });
  return rank;
}

const FRONT_NINE_SI_RANK = rankBySi(HOLES.slice(0, 9));
const BACK_NINE_SI_RANK = rankBySi(HOLES.slice(9, 18));
const FRONT_NINE_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const BACK_NINE_INDICES = [9, 10, 11, 12, 13, 14, 15, 16, 17];

function receivesStroke(deals: StrokeDeal[], player: PlayerKey, opponent: PlayerKey, rank: Record<number, number>, holeN: number): boolean {
  const deal = findDeal(deals, player, opponent);
  return !!deal && deal.receiver === player && rank[holeN] <= deal.amount;
}

function holeResult(p1: PlayerKey, p2: PlayerKey, holeIndex: number, deals: StrokeDeal[], rank: Record<number, number>, gross: GrossMap): number {
  const holeN = HOLES[holeIndex].n;
  const n1 = gross[p1][holeIndex] - (receivesStroke(deals, p1, p2, rank, holeN) ? 1 : 0);
  const n2 = gross[p2][holeIndex] - (receivesStroke(deals, p2, p1, rank, holeN) ? 1 : 0);
  if (n1 < n2) return 1;
  if (n1 > n2) return -1;
  return 0;
}

// Re-strike every pair's deal from their head-to-head record over a set of
// holes: every full 2-hole net swing shifts the stroke count by 1.
function restrike(deals: StrokeDeal[], rank: Record<number, number>, holeIndices: number[], gross: GrossMap = GROSS): StrokeDeal[] {
  const next: StrokeDeal[] = [];
  ALL_PAIRS.forEach(([p1, p2]) => {
    const deal = findDeal(deals, p1, p2);
    const baseline = deal ? (deal.receiver === p1 ? deal.amount : -deal.amount) : 0;
    let net = 0;
    holeIndices.forEach((i) => {
      net += holeResult(p1, p2, i, deals, rank, gross);
    });
    const adjusted = baseline - Math.trunc(net / 2);
    if (adjusted > 0) next.push({ giver: p2, receiver: p1, amount: adjusted });
    else if (adjusted < 0) next.push({ giver: p1, receiver: p2, amount: -adjusted });
  });
  return next;
}

// Re-struck from the front-9 record, so editing a front-9 score correctly
// reshapes the back 9's give/receive strokes (not just the displayed deal).
function getBackNineDeals(gross: GrossMap = GROSS, frontNineDeals: StrokeDeal[] = DEFAULT_FRONT_NINE_DEALS): StrokeDeal[] {
  return restrike(frontNineDeals, FRONT_NINE_SI_RANK, FRONT_NINE_INDICES, gross);
}

/** What each pair's deal would be if they played this same field again. */
export function getNextRoundDeals(gross: GrossMap = GROSS, frontNineDeals: StrokeDeal[] = DEFAULT_FRONT_NINE_DEALS): StrokeDeal[] {
  return restrike(getBackNineDeals(gross, frontNineDeals), BACK_NINE_SI_RANK, BACK_NINE_INDICES, gross);
}

function dealsAndRankForHole(holeN: number, gross: GrossMap, frontNineDeals: StrokeDeal[]) {
  return holeN <= 9
    ? { deals: frontNineDeals, rank: FRONT_NINE_SI_RANK }
    : { deals: getBackNineDeals(gross, frontNineDeals), rank: BACK_NINE_SI_RANK };
}

/** Give/receive flags for the viewer-vs-opponent pairing on a given hole (for the Scorecard grid). */
export function getFlags(
  opponent: PlayerKey,
  holeN: number,
  gross: GrossMap = GROSS,
  frontNineDeals: StrokeDeal[] = DEFAULT_FRONT_NINE_DEALS,
) {
  const { deals, rank } = dealsAndRankForHole(holeN, gross, frontNineDeals);
  return {
    give: receivesStroke(deals, opponent, VIEWER_KEY, rank, holeN),
    recv: receivesStroke(deals, VIEWER_KEY, opponent, rank, holeN),
  };
}

/** +1 if `p1` beats `p2` on this hole, -1 if `p1` loses, 0 if halved. */
export function pairwiseResult(
  p1: PlayerKey,
  p2: PlayerKey,
  holeIndex: number,
  gross: GrossMap = GROSS,
  frontNineDeals: StrokeDeal[] = DEFAULT_FRONT_NINE_DEALS,
): number {
  const holeN = HOLES[holeIndex].n;
  const { deals, rank } = dealsAndRankForHole(holeN, gross, frontNineDeals);
  return holeResult(p1, p2, holeIndex, deals, rank, gross);
}

function others(playerKey: PlayerKey) {
  return PLAYERS.filter((p) => p.key !== playerKey).map((p) => p.key);
}

/** Net wins-minus-losses against every other player, for one hole. */
export function holeUpValue(
  playerKey: PlayerKey,
  holeIndex: number,
  gross: GrossMap = GROSS,
  frontNineDeals: StrokeDeal[] = DEFAULT_FRONT_NINE_DEALS,
): number {
  return others(playerKey).reduce((sum, opp) => sum + pairwiseResult(playerKey, opp, holeIndex, gross, frontNineDeals), 0);
}

/** Running "up" total across the holes played so far. */
export function runningUp(
  playerKey: PlayerKey,
  thru: number,
  gross: GrossMap = GROSS,
  frontNineDeals: StrokeDeal[] = DEFAULT_FRONT_NINE_DEALS,
): number {
  let total = 0;
  for (let i = 0; i < thru; i++) total += holeUpValue(playerKey, i, gross, frontNineDeals);
  return total;
}

/** Win/loss/halve count (by hole-level sign) across the holes played so far. */
export function record(
  playerKey: PlayerKey,
  thru: number,
  gross: GrossMap = GROSS,
  frontNineDeals: StrokeDeal[] = DEFAULT_FRONT_NINE_DEALS,
): { w: number; l: number; h: number } {
  let w = 0;
  let l = 0;
  let h = 0;
  for (let i = 0; i < thru; i++) {
    const v = holeUpValue(playerKey, i, gross, frontNineDeals);
    if (v > 0) w++;
    else if (v < 0) l++;
    else h++;
  }
  return { w, l, h };
}

export function money(
  playerKey: PlayerKey,
  thru: number,
  gross: GrossMap = GROSS,
  frontNineDeals: StrokeDeal[] = DEFAULT_FRONT_NINE_DEALS,
  stake: number = STAKE,
): number {
  return runningUp(playerKey, thru, gross, frontNineDeals) * stake;
}

/** Summed result of one player against one specific opponent. */
export function pairwiseTotal(
  playerKey: PlayerKey,
  opponent: PlayerKey,
  thru: number,
  gross: GrossMap = GROSS,
  frontNineDeals: StrokeDeal[] = DEFAULT_FRONT_NINE_DEALS,
): number {
  let total = 0;
  for (let i = 0; i < thru; i++) total += pairwiseResult(playerKey, opponent, i, gross, frontNineDeals);
  return total;
}

export function grossTotal(playerKey: PlayerKey, thru: number = HOLES.length, gross: GrossMap = GROSS): number {
  return gross[playerKey].slice(0, thru).reduce((sum, v) => sum + v, 0);
}

export function upLabel(net: number): string {
  if (net > 0) return `${net} UP`;
  if (net < 0) return `${Math.abs(net)} DN`;
  return 'AS';
}

export function moneyLabel(amount: number): string {
  if (amount > 0) return `+$${amount}`;
  if (amount < 0) return `-$${Math.abs(amount)}`;
  return '$0';
}

export function playerName(key: PlayerKey): string {
  return PLAYERS.find((p) => p.key === key)?.name ?? '';
}

/** "Marcus gives Dinesh 6 strokes" — for next-round deal previews. */
export function formatDeal(deal: StrokeDeal): string {
  return `${playerName(deal.giver)} gives ${playerName(deal.receiver)} ${deal.amount} strokes`;
}

/** Scorecard ring/notation classification — same thresholds as ScoreBadge. */
export function scoreClassCounts(playerKey: PlayerKey, thru: number = HOLES.length, gross: GrossMap = GROSS) {
  let eagle = 0;
  let birdie = 0;
  let par = 0;
  let bogey = 0;
  let doublePlus = 0;
  for (let i = 0; i < thru; i++) {
    const diff = gross[playerKey][i] - HOLES[i].par;
    if (diff <= -2) eagle++;
    else if (diff === -1) birdie++;
    else if (diff === 0) par++;
    else if (diff === 1) bogey++;
    else doublePlus++;
  }
  return { eagle, birdie, par, bogey, doublePlus };
}

export function sumRange(thru: number, start: number, end: number, gross: GrossMap = GROSS): Record<PlayerKey, number> {
  const sums: Record<PlayerKey, number> = { A: 0, B: 0, C: 0 };
  PLAYERS.forEach((p) => {
    let total = 0;
    for (let i = start; i < end; i++) {
      if (i + 1 <= thru) total += gross[p.key][i];
    }
    sums[p.key] = total;
  });
  return sums;
}
