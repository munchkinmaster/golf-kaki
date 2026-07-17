/**
 * Pure Kaki Match Play scoring math — no Supabase here (see data/scores.ts for
 * the live fetch/write layer). Generalized to any real roster/course: every
 * function takes its `players`/`holes` explicitly rather than closing over a
 * fixed 3-player mock, so the same arithmetic works for any match.
 *
 * Every PAIR of players has its own independent stroke deal — there's no
 * single "the field's strokes," each side-bet is handicapped on its own.
 * Deals are canonical a<b (string compare on player id), positive-giver
 * convention: `{ giver, receiver, amount }`.
 *
 * A deal is preset for the front 9 only, allocated to the hardest holes in
 * that pair's agreed amount (by stroke index). For an 18-hole match with a
 * 9-hole strokes basis, the deal is re-struck once at hole 10: for every full
 * 2-hole net swing in the front-9 head-to-head for that pair, the stroke
 * count shifts by 1 (lose more, receive more help; win more, give more / need
 * less) — then fixed for holes 10-18. The same re-strike happens again at the
 * end of the round (from the back-9 record for that case, or from the whole
 * round otherwise), producing the deal each pair would carry into their next
 * round together.
 */

export type PlayerKey = string;

export type Hole = { n: number; par: number; si: number };

/** Dense per-player gross-score array, indexed 0..holes.length-1. */
export type GrossMap = Record<PlayerKey, number[]>;

/** Sparse hole-by-hole scores as recorded so far — gaps mean "not scored yet." */
export type HoleScoreMap = Record<PlayerKey, Partial<Record<number, number>>>;

export type StrokeMode = 'get' | 'give';

export type StrokeDeal = { giver: PlayerKey; receiver: PlayerKey; amount: number };

/** How this match schedules its strokes — drives which SI ranking/restrike case applies. */
export type RoundSchedule = { holesToPlay: 9 | 18; strokesBasis: 9 | 18; startHole: number };

/**
 * Hole numbers in actual tee-off order for a shotgun-started 18-hole round —
 * e.g. startHole 10 → [10, 11, ..., 18, 1, ..., 9]. Identity ([1, 2, ..., 18])
 * for startHole 1, which is every match created before shotgun starts existed
 * and every 9-hole match today (that picker only offers 18-hole rounds — see
 * SelectCourseScreen). "Front nine"/"back nine" elsewhere in this module means
 * the first 9 holes played vs. the last 9, which only coincides with hole
 * numbers 1-9/10-18 when startHole is 1.
 */
export function buildPlayOrder(startHole: number): number[] {
  return Array.from({ length: 18 }, (_, i) => ((startHole - 1 + i) % 18) + 1);
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** Every unordered pair among `players`, canonically ordered (a < b). */
export function buildAllPairs(players: PlayerKey[]): [PlayerKey, PlayerKey][] {
  const pairs: [PlayerKey, PlayerKey][] = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const [a, b] = players[i]! < players[j]! ? [players[i]!, players[j]!] : [players[j]!, players[i]!];
      pairs.push([a, b]);
    }
  }
  return pairs;
}

function findDeal(deals: StrokeDeal[], p1: PlayerKey, p2: PlayerKey): StrokeDeal | undefined {
  return deals.find((d) => (d.giver === p1 && d.receiver === p2) || (d.giver === p2 && d.receiver === p1));
}

/** Amount `from` gives `to` under this deal set — negative means `from` receives instead. */
function givesAmount(deals: StrokeDeal[], from: PlayerKey, to: PlayerKey): number {
  const deal = findDeal(deals, from, to);
  if (!deal) return 0;
  return deal.giver === from ? deal.amount : -deal.amount;
}

/**
 * Strokes `player` gets from `opponent` on this hole. `rank` only ranks the holes it was
 * built from (9 for front/back, up to 18 for a full-round rank) — once the deal amount
 * exceeds that count, one stroke per hole isn't enough to represent it (e.g. amount 10 over
 * 9 holes: every hole gets 1, plus a 2nd on the single hardest). Same base+extra shape as
 * strokesReceivedOnHole in handicap.ts, just against the deal amount instead of a course
 * handicap, and against this rank set's size instead of a fixed 18.
 */
function strokesOnHole(deals: StrokeDeal[], player: PlayerKey, opponent: PlayerKey, rank: Record<number, number>, holeN: number): number {
  const deal = findDeal(deals, player, opponent);
  if (!deal || deal.receiver !== player) return 0;
  const rankSize = Object.keys(rank).length;
  if (rankSize === 0) return 0;
  const base = Math.floor(deal.amount / rankSize);
  const extra = rank[holeN]! <= deal.amount % rankSize ? 1 : 0;
  return base + extra;
}

function rankBySi(holes: Hole[]): Record<number, number> {
  const ranked = [...holes].sort((a, b) => a.si - b.si);
  const rank: Record<number, number> = {};
  ranked.forEach((h, i) => {
    rank[h.n] = i + 1;
  });
  return rank;
}

/** The first 9 holes played (by play order, not necessarily hole numbers 1-9 — see buildPlayOrder). */
function frontRank(holes: Hole[], schedule: RoundSchedule): Record<number, number> {
  const firstNinePlayed = new Set(buildPlayOrder(schedule.startHole).slice(0, Math.min(9, holes.length)));
  return rankBySi(holes.filter((h) => firstNinePlayed.has(h.n)));
}

/** The last 9 holes played (by play order, not necessarily hole numbers 10-18 — see buildPlayOrder). */
function backRank(holes: Hole[], schedule: RoundSchedule): Record<number, number> {
  const secondNinePlayed = new Set(buildPlayOrder(schedule.startHole).slice(9, 18));
  return rankBySi(holes.filter((h) => secondNinePlayed.has(h.n)));
}

function fullRank(holes: Hole[]): Record<number, number> {
  return rankBySi(holes);
}

function rangeIndices(start: number, end: number): number[] {
  return Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i);
}

function holeResult(p1: PlayerKey, p2: PlayerKey, holeIndex: number, deals: StrokeDeal[], rank: Record<number, number>, gross: GrossMap, holes: Hole[]): number {
  const holeN = holes[holeIndex]!.n;
  const n1 = gross[p1]![holeIndex]! - strokesOnHole(deals, p1, p2, rank, holeN);
  const n2 = gross[p2]![holeIndex]! - strokesOnHole(deals, p2, p1, rank, holeN);
  if (n1 < n2) return 1;
  if (n1 > n2) return -1;
  return 0;
}

/**
 * Re-strikes every pair's deal from their head-to-head record over a set of
 * holes: every full 2-hole net swing shifts the "gives" amount by 1. Returns
 * the signed net for EVERY pair (including zero, unlike `restrike`) — the
 * kaki-ledger write-back needs to zero out a pair that evened out, not skip
 * it. Keyed by `pairKey(a, b)`, positive = a gives b.
 */
export function restrikeNet(
  players: PlayerKey[],
  deals: StrokeDeal[],
  rank: Record<number, number>,
  holeIndices: number[],
  gross: GrossMap,
  holes: Hole[],
): Record<string, number> {
  const net: Record<string, number> = {};
  buildAllPairs(players).forEach(([p1, p2]) => {
    const baselineGives = givesAmount(deals, p1, p2);
    let swing = 0;
    holeIndices.forEach((i) => {
      swing += holeResult(p1, p2, i, deals, rank, gross, holes);
    });
    net[pairKey(p1, p2)] = baselineGives + Math.trunc(swing / 2);
  });
  return net;
}

function netToDeals(net: Record<string, number>): StrokeDeal[] {
  const deals: StrokeDeal[] = [];
  Object.entries(net).forEach(([key, amount]) => {
    if (amount === 0) return;
    const [a, b] = key.split(':') as [string, string];
    deals.push(amount > 0 ? { giver: a, receiver: b, amount } : { giver: b, receiver: a, amount: -amount });
  });
  return deals;
}

/** Array indices (into `holes`/`gross`) for a set of hole numbers — hole n lives at index n-1 since `holes` is always naturally ordered 1..18. */
function indicesForHoleNumbers(holeNumbers: number[]): number[] {
  return holeNumbers.map((n) => n - 1);
}

/** Re-struck from the first-9-played record — the signed net (including zero) for every pair, for persisting to game_matchups.back_nine_strokes. */
export function getBackNineNet(players: PlayerKey[], gross: GrossMap, frontNineDeals: StrokeDeal[], holes: Hole[], schedule: RoundSchedule): Record<string, number> {
  const firstNinePlayed = buildPlayOrder(schedule.startHole).slice(0, Math.min(9, holes.length));
  return restrikeNet(players, frontNineDeals, frontRank(holes, schedule), indicesForHoleNumbers(firstNinePlayed), gross, holes);
}

/** Re-struck from the first-9-played record — the deal that applies to the last 9 holes played in an 18-hole/9-strokes-basis match. */
export function getBackNineDeals(players: PlayerKey[], gross: GrossMap, frontNineDeals: StrokeDeal[], holes: Hole[], schedule: RoundSchedule): StrokeDeal[] {
  return netToDeals(getBackNineNet(players, gross, frontNineDeals, holes, schedule));
}

/**
 * What each pair's deal would be if they played this same field again —
 * re-struck from whichever record actually determined this match's stakes:
 * the whole round for a 9-hole match or an 18-hole/18-strokes-basis match
 * (no mid-match restrike happened), or just the back-9 record for an
 * 18-hole/9-strokes-basis match (the front 9 already fed its own restrike at
 * the turn; re-applying it here would double-count).
 */
export function getNextRoundNet(
  players: PlayerKey[],
  gross: GrossMap,
  frontNineDeals: StrokeDeal[],
  holes: Hole[],
  schedule: RoundSchedule,
  backNineDeals: StrokeDeal[] | null,
): Record<string, number> {
  if (schedule.holesToPlay === 9) {
    return restrikeNet(players, frontNineDeals, frontRank(holes, schedule), rangeIndices(0, holes.length), gross, holes);
  }
  if (schedule.strokesBasis === 18) {
    return restrikeNet(players, frontNineDeals, fullRank(holes), rangeIndices(0, holes.length), gross, holes);
  }
  const effectiveBackNine = backNineDeals ?? getBackNineDeals(players, gross, frontNineDeals, holes, schedule);
  const secondNinePlayed = buildPlayOrder(schedule.startHole).slice(9, 18);
  return restrikeNet(players, effectiveBackNine, backRank(holes, schedule), indicesForHoleNumbers(secondNinePlayed), gross, holes);
}

export function getNextRoundDeals(
  players: PlayerKey[],
  gross: GrossMap,
  frontNineDeals: StrokeDeal[],
  holes: Hole[],
  schedule: RoundSchedule,
  backNineDeals: StrokeDeal[] | null,
): StrokeDeal[] {
  return netToDeals(getNextRoundNet(players, gross, frontNineDeals, holes, schedule, backNineDeals));
}

function dealsAndRankForHole(
  schedule: RoundSchedule,
  holeN: number,
  frontNineDeals: StrokeDeal[],
  backNineDeals: StrokeDeal[] | null,
  holes: Hole[],
): { deals: StrokeDeal[]; rank: Record<number, number> } {
  if (schedule.holesToPlay === 9) return { deals: frontNineDeals, rank: frontRank(holes, schedule) };
  if (schedule.strokesBasis === 18) return { deals: frontNineDeals, rank: fullRank(holes) };
  const firstNinePlayed = new Set(buildPlayOrder(schedule.startHole).slice(0, 9));
  if (firstNinePlayed.has(holeN)) return { deals: frontNineDeals, rank: frontRank(holes, schedule) };
  // Until the turn's restrike actually lands, there's no valid deal for these
  // holes yet — falling back to frontNineDeals here (as this used to) applies
  // the SAME stroke amount a second time via the back nine's own SI rank,
  // effectively doubling the giver's strokes across the round instead of
  // leaving the back nine unstruck until it's earned its own deal.
  if (!backNineDeals) return { deals: [], rank: {} };
  return { deals: backNineDeals, rank: backRank(holes, schedule) };
}

/** Give/receive stroke counts for the viewer-vs-opponent pairing on a given hole (for the Scorecard grid). */
export function getFlags(
  opponent: PlayerKey,
  viewer: PlayerKey,
  holeN: number,
  holes: Hole[],
  frontNineDeals: StrokeDeal[],
  schedule: RoundSchedule,
  backNineDeals: StrokeDeal[] | null,
) {
  const { deals, rank } = dealsAndRankForHole(schedule, holeN, frontNineDeals, backNineDeals, holes);
  return {
    give: strokesOnHole(deals, opponent, viewer, rank, holeN),
    recv: strokesOnHole(deals, viewer, opponent, rank, holeN),
  };
}

/** +1 if `p1` beats `p2` on this hole, -1 if `p1` loses, 0 if halved. */
export function pairwiseResult(
  p1: PlayerKey,
  p2: PlayerKey,
  holeIndex: number,
  gross: GrossMap,
  holes: Hole[],
  frontNineDeals: StrokeDeal[],
  schedule: RoundSchedule,
  backNineDeals: StrokeDeal[] | null,
): number {
  const holeN = holes[holeIndex]!.n;
  const { deals, rank } = dealsAndRankForHole(schedule, holeN, frontNineDeals, backNineDeals, holes);
  return holeResult(p1, p2, holeIndex, deals, rank, gross, holes);
}

function others(players: PlayerKey[], playerKey: PlayerKey): PlayerKey[] {
  return players.filter((p) => p !== playerKey);
}

/** Net wins-minus-losses against every other player, for one hole. */
export function holeUpValue(
  players: PlayerKey[],
  playerKey: PlayerKey,
  holeIndex: number,
  gross: GrossMap,
  holes: Hole[],
  frontNineDeals: StrokeDeal[],
  schedule: RoundSchedule,
  backNineDeals: StrokeDeal[] | null,
): number {
  return others(players, playerKey).reduce(
    (sum, opp) => sum + pairwiseResult(playerKey, opp, holeIndex, gross, holes, frontNineDeals, schedule, backNineDeals),
    0,
  );
}

/** Running "up" total across the holes played so far. */
export function runningUp(
  players: PlayerKey[],
  playerKey: PlayerKey,
  thru: number,
  gross: GrossMap,
  holes: Hole[],
  frontNineDeals: StrokeDeal[],
  schedule: RoundSchedule,
  backNineDeals: StrokeDeal[] | null,
  playOrder: number[],
): number {
  let total = 0;
  for (const holeN of playOrder.slice(0, thru)) total += holeUpValue(players, playerKey, holeN - 1, gross, holes, frontNineDeals, schedule, backNineDeals);
  return total;
}

/** Win/loss/halve count (by hole-level sign) across the holes played so far. */
export function record(
  players: PlayerKey[],
  playerKey: PlayerKey,
  thru: number,
  gross: GrossMap,
  holes: Hole[],
  frontNineDeals: StrokeDeal[],
  schedule: RoundSchedule,
  backNineDeals: StrokeDeal[] | null,
  playOrder: number[],
): { w: number; l: number; h: number } {
  let w = 0;
  let l = 0;
  let h = 0;
  for (const holeN of playOrder.slice(0, thru)) {
    const v = holeUpValue(players, playerKey, holeN - 1, gross, holes, frontNineDeals, schedule, backNineDeals);
    if (v > 0) w++;
    else if (v < 0) l++;
    else h++;
  }
  return { w, l, h };
}

export function money(
  players: PlayerKey[],
  playerKey: PlayerKey,
  thru: number,
  gross: GrossMap,
  holes: Hole[],
  frontNineDeals: StrokeDeal[],
  schedule: RoundSchedule,
  backNineDeals: StrokeDeal[] | null,
  stake: number,
  playOrder: number[],
): number {
  return runningUp(players, playerKey, thru, gross, holes, frontNineDeals, schedule, backNineDeals, playOrder) * stake;
}

/** Summed result of one player against one specific opponent. */
export function pairwiseTotal(
  playerKey: PlayerKey,
  opponent: PlayerKey,
  thru: number,
  gross: GrossMap,
  holes: Hole[],
  frontNineDeals: StrokeDeal[],
  schedule: RoundSchedule,
  backNineDeals: StrokeDeal[] | null,
  playOrder: number[],
): number {
  let total = 0;
  for (const holeN of playOrder.slice(0, thru)) total += pairwiseResult(playerKey, opponent, holeN - 1, gross, holes, frontNineDeals, schedule, backNineDeals);
  return total;
}

export function grossTotal(playerKey: PlayerKey, thru: number, gross: GrossMap, playOrder: number[]): number {
  // gross[playerKey] can be legitimately absent for a beat after mount —
  // viewerId comes from auth (available immediately) while gross only fills
  // in once the round's roster/scores finish loading.
  const playerGross = gross[playerKey] ?? [];
  return playOrder.slice(0, thru).reduce((sum, holeN) => sum + (playerGross[holeN - 1] ?? 0), 0);
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

export function playerName(key: PlayerKey, roster: { id: string; name: string }[]): string {
  return roster.find((p) => p.id === key)?.name ?? '';
}

/** "Marcus gives Dinesh 6 strokes" — for next-round deal previews. */
export function formatDeal(deal: StrokeDeal, roster: { id: string; name: string }[]): string {
  return `${playerName(deal.giver, roster)} gives ${playerName(deal.receiver, roster)} ${deal.amount} strokes`;
}

/** Scorecard ring/notation classification — same thresholds as ScoreBadge. */
export function scoreClassCounts(playerKey: PlayerKey, thru: number, gross: GrossMap, holes: Hole[], playOrder: number[]) {
  let eagle = 0;
  let birdie = 0;
  let par = 0;
  let bogey = 0;
  let doublePlus = 0;
  for (const holeN of playOrder.slice(0, thru)) {
    const diff = gross[playerKey]![holeN - 1]! - holes[holeN - 1]!.par;
    if (diff <= -2) eagle++;
    else if (diff === -1) birdie++;
    else if (diff === 0) par++;
    else if (diff === 1) bogey++;
    else doublePlus++;
  }
  return { eagle, birdie, par, bogey, doublePlus };
}

/** `start`/`end` are hole-number bounds (0 = hole 1), always literal — OUT/IN are fixed scorecard halves, unaffected by shotgun starts. Only "has this hole been played yet" is play-order-aware. */
export function sumRange(players: PlayerKey[], thru: number, start: number, end: number, gross: GrossMap, playOrder: number[]): Record<PlayerKey, number> {
  const playedHoles = new Set(playOrder.slice(0, thru));
  const sums: Record<PlayerKey, number> = {};
  players.forEach((p) => {
    let total = 0;
    for (let i = start; i < end; i++) {
      if (playedHoles.has(i + 1)) total += gross[p]![i]!;
    }
    sums[p] = total;
  });
  return sums;
}

/** "Get" = the viewer receives strokes from this opponent; "give" = the viewer spots them. */
export function viewerStrokeAgainst(viewer: PlayerKey, opponentKey: PlayerKey, deals: StrokeDeal[]): { strokes: number; mode: StrokeMode } {
  const deal = findDeal(deals, viewer, opponentKey);
  if (!deal) return { strokes: 0, mode: 'give' };
  return deal.giver === opponentKey ? { strokes: deal.amount, mode: 'get' } : { strokes: deal.amount, mode: 'give' };
}

export function buildViewerDeal(viewer: PlayerKey, opponentKey: PlayerKey, strokes: number, mode: StrokeMode): StrokeDeal {
  return mode === 'get'
    ? { giver: opponentKey, receiver: viewer, amount: strokes }
    : { giver: viewer, receiver: opponentKey, amount: strokes };
}

/**
 * Largest contiguous prefix of `playOrder` for which every roster player has
 * a recorded score — the first `thru` holes of `playOrder` are considered
 * "played" everywhere else in this module. A gap (someone's card missing a
 * hole) stalls thru at the last fully-scored hole, even if later holes
 * happen to be filled in already. `playOrder` is the match's actual tee-off
 * sequence (see buildPlayOrder) — NOT necessarily hole numbers 1, 2, 3...,
 * so a shotgun-started round's progress is tracked correctly.
 */
export function computeThru(players: PlayerKey[], scores: HoleScoreMap, playOrder: number[]): number {
  let thru = 0;
  for (const n of playOrder) {
    const allScored = players.every((p) => scores[p]?.[n] !== undefined);
    if (!allScored) break;
    thru++;
  }
  return thru;
}
