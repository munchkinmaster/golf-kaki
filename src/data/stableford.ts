/**
 * Pure Stableford tournament scoring math — no Supabase here, same "pure
 * derivation" convention as round.ts/strokePlay.ts/skins.ts/system36.ts.
 * Scoped to design_handoff_stableford_flow/README.md (SB1–SB10).
 *
 * Unlike System 36, Stableford uses an ordinary upfront Playing Handicap
 * (handicapIndex × slope/113 × the SB3 allowance %, same derivation as
 * Stroke Play) — there's no derived-handicap trick here, just a points
 * curve applied to the same nett-per-hole figure strokePlay.ts already
 * computes. strokePlay.ts's nettTotal/nettRangeTotal are re-exported below
 * rather than reimplemented, so a screen showing Stableford's Nett tile
 * (SB8) doesn't need a second import for identical math; only the
 * points-per-hole curve and the points-ranked standings (with a points,
 * not nett, countback) are new.
 */

import { strokesReceivedOnHole } from './handicap';
import { grossTotal } from './round';
import { nettRangeTotal, nettTotal } from './strokePlay';
import type { GrossMap, Hole, PlayerKey } from './round';

/** 1-18 stroke-index rank for every hole (1 = hardest) — duplicated from strokePlay.ts's own private rankHolesBySi rather than shared, per that file's comment: a 4-line helper over a caller-supplied hole list isn't worth a shared export. */
function rankHolesBySi(holes: Hole[]): Map<number, number> {
  const ranked = [...holes].sort((a, b) => a.si - b.si);
  const rank = new Map<number, number>();
  ranked.forEach((h, i) => rank.set(h.n, i + 1));
  return rank;
}

/** This player's nett score for every hole, keyed by literal hole number — duplicated from strokePlay.ts's own private nettByHoleNumber (same reasoning as rankHolesBySi above). Needed locally because points are derived PER HOLE from nett, not just summed the way a plain nett total is. */
function nettByHoleNumber(playerKey: PlayerKey, gross: GrossMap, holes: Hole[], playingHandicap: number): Map<number, number> {
  const rank = rankHolesBySi(holes);
  const playerGross = gross[playerKey] ?? [];
  const byN = new Map<number, number>();
  holes.forEach((h) => {
    const g = playerGross[h.n - 1] ?? 0;
    const siRank = rank.get(h.n) ?? h.n;
    byN.set(h.n, g - strokesReceivedOnHole(playingHandicap, siRank));
  });
  return byN;
}

/**
 * Stableford points for one hole, nett vs. par — the standard curve
 * (Albatross 5, Eagle 4, Birdie 3, Par 2, Bogey 1, Double+ 0), expressed as
 * `max(0, 2 − (nett − par))` so it needs no per-result branching and can't
 * go negative on a blow-up hole (per SB1's footnote: "one blow-up hole
 * never wrecks your card"). Identical formula to system36.ts's
 * stablefordPointsForHole, duplicated here rather than imported — this
 * format shouldn't depend on System 36's module just to share one line of
 * arithmetic, same reasoning as rankHolesBySi above.
 */
export function stablefordPointsForHole(nettStrokes: number, par: number): number {
  return Math.max(0, 2 - (nettStrokes - par));
}

/** Running Stableford-points total for the holes played so far, off this player's Playing Handicap — SB7's Points tile and SB8's mid-round Points column both call this with whatever `thru` they're tracking. */
export function stablefordPointsTotal(playerKey: PlayerKey, thru: number, gross: GrossMap, holes: Hole[], playingHandicap: number, playOrder: number[]): number {
  const byN = new Map(holes.map((h) => [h.n, h]));
  const nettByN = nettByHoleNumber(playerKey, gross, holes, playingHandicap);
  return playOrder.slice(0, thru).reduce((sum, holeN) => {
    const hole = byN.get(holeN);
    if (!hole) return sum;
    return sum + stablefordPointsForHole(nettByN.get(holeN) ?? 0, hole.par);
  }, 0);
}

/** Stableford-points sum for a literal hole-number range (0-indexed [start, end), e.g. front nine = [0,9)) — the grid's Out/In Points summary row, same slicing convention as strokePlay.ts's nettRangeTotal. */
export function stablefordPointsRangeTotal(
  playerKey: PlayerKey,
  thru: number,
  start: number,
  end: number,
  gross: GrossMap,
  holes: Hole[],
  playingHandicap: number,
  playOrder: number[],
): number {
  const byN = new Map(holes.map((h) => [h.n, h]));
  const nettByN = nettByHoleNumber(playerKey, gross, holes, playingHandicap);
  const playedHoles = new Set(playOrder.slice(0, thru));
  let total = 0;
  for (let i = start; i < end; i++) {
    const holeN = i + 1;
    if (!playedHoles.has(holeN)) continue;
    const hole = byN.get(holeN);
    if (!hole) continue;
    total += stablefordPointsForHole(nettByN.get(holeN) ?? 0, hole.par);
  }
  return total;
}

// Re-exported so screens reading Stableford's Nett tile (SB8's Gross/Nett/
// Points strip) don't need to import strokePlay.ts directly just for this
// — same generic functions, called with a stored Playing Handicap exactly
// like Stroke Play does.
export { nettRangeTotal as stablefordNettRangeTotal, nettTotal as stablefordNettTotal };

export type StablefordStandingRow = {
  playerId: PlayerKey;
  thru: number;
  finished: boolean;
  gross: number;
  nett: number;
  /** The ranking metric — total Stableford points, most wins (opposite direction from Stroke Play's ascending nett-to-par). */
  points: number;
  /** 1-based; ties share a rank under 'shared_place' or an unresolved (not-both-finished) countback — standard sports-ranking skip, e.g. 1, 2, 2, 4. */
  rank: number;
};

/** Countback comparison key for a finished (thru === holes.length) card — points over the back 9, back 6, back 3, then the 18th hole alone. Mirrors strokePlay.ts's countbackKey shape but over Stableford points rather than nett strokes, per SB3's "Most points over last 9, 6, 3, then 18th" tie-break description. */
function countbackKey(pointsByN: Map<number, number>): number[] {
  const sumRange = (start: number, end: number) => {
    let total = 0;
    for (let n = start; n <= end; n++) total += pointsByN.get(n) ?? 0;
    return total;
  };
  return [sumRange(10, 18), sumRange(13, 18), sumRange(16, 18), pointsByN.get(18) ?? 0];
}

/** Same tier-by-tier comparison as strokePlay.ts's compareKeys, but DESCENDING — more points wins each tier, the opposite direction from stroke play's ascending nett comparison. */
function compareKeysDescending(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return b[i]! - a[i]!;
  }
  return 0;
}

/**
 * Ranks the field by total Stableford points, DESCENDING (most points
 * wins) — the opposite sort direction from stroke play's nett-to-par
 * ascending, per SB9's "Points" column being the ranking metric. `thru` is
 * each player's OWN completion count, same convention as
 * strokePlay.ts's computeTournamentStandings.
 *
 * Ties only resolve via countback once BOTH tied players are fully
 * finished — comparing completed-round subtotals against a partial card
 * doesn't mean anything. A mid-round tie (or a 'shared_place' tournament)
 * shares the same rank number, and the next rank skips by the tied count.
 */
export function computeStablefordStandings(
  playerIds: PlayerKey[],
  thru: Record<PlayerKey, number>,
  gross: GrossMap,
  holes: Hole[],
  playingHandicaps: Record<PlayerKey, number>,
  playOrder: number[],
  tieBreakRule: 'countback' | 'shared_place',
): StablefordStandingRow[] {
  const rows = playerIds.map((playerId) => {
    const t = thru[playerId] ?? 0;
    const finished = t === holes.length;
    const handicap = playingHandicaps[playerId] ?? 0;
    const nettByN = nettByHoleNumber(playerId, gross, holes, handicap);
    const pointsByN = new Map<number, number>();
    holes.forEach((h) => pointsByN.set(h.n, stablefordPointsForHole(nettByN.get(h.n) ?? 0, h.par)));
    const nett = playOrder.slice(0, t).reduce((sum, holeN) => sum + (nettByN.get(holeN) ?? 0), 0);
    const points = playOrder.slice(0, t).reduce((sum, holeN) => sum + (pointsByN.get(holeN) ?? 0), 0);
    return {
      playerId,
      thru: t,
      finished,
      gross: grossTotal(playerId, t, gross, playOrder),
      nett,
      points,
      countback: countbackKey(pointsByN),
    };
  });

  rows.sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points; // descending: most points first
    if (tieBreakRule === 'countback' && a.finished && b.finished) return compareKeysDescending(a.countback, b.countback);
    return 0; // stays a shared rank below
  });

  const ranked: StablefordStandingRow[] = [];
  rows.forEach((row, i) => {
    // Same rank as the row above when they're an unresolved tie (equal
    // points, and either not both finished or the tournament uses
    // shared_place) — countback-resolved ties already have a strict sort
    // order above and should NOT share a rank despite equal points.
    const prev = rows[i - 1];
    const resolvedByCountback = tieBreakRule === 'countback' && row.finished && prev?.finished;
    const sharesRank = prev !== undefined && prev.points === row.points && !resolvedByCountback;
    const rank = sharesRank ? ranked[i - 1]!.rank : i + 1;
    ranked.push({ playerId: row.playerId, thru: row.thru, finished: row.finished, gross: row.gross, nett: row.nett, points: row.points, rank });
  });
  return ranked;
}
