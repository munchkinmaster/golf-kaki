/**
 * Pure System 36 tournament scoring math — no Supabase here, same
 * "pure derivation" convention as round.ts/strokePlay.ts/skins.ts. Scoped to
 * the design_handoff_system36/README.md handoff (SY1–SY10).
 *
 * The format in one pass: gross strokes earn 2/1/0 points per hole against
 * par (no handicap needed to play); summed over 18 holes those points derive
 * this player's handicap for the round (`36 − points`); THAT handicap is
 * then allocated across the 18 holes by stroke index same as any course
 * handicap, giving a nett per hole, which scores Stableford points per hole.
 * Two totals, two jobs: **S36 points earn the handicap, Stableford points
 * decide the win** — every function below keeps them as separate return
 * values so a caller can't accidentally conflate them.
 *
 * Nett/Stableford math is NOT reimplemented here — once a handicap number
 * exists (live-so-far via s36Handicap, or final at 18 holes), it allocates
 * by stroke index exactly the way a stroke-play playing handicap does, so
 * this module calls strokePlay.ts's nettTotal/nettRangeTotal directly with
 * the derived S36 handicap in place of a stored playing handicap. Only the
 * Stableford points-per-hole curve (a nonlinear function of nett, not a sum
 * of it) is new math, added below.
 */

import { strokesReceivedOnHole } from './handicap';
import { grossTotal } from './round';
import { nettRangeTotal, nettTotal } from './strokePlay';
import type { GrossMap, Hole, PlayerKey } from './round';

/** System 36 is only defined over a full 18-hole round — see the README's "the sum is over 18 holes" note. The tournament flow's S2 already only ever resolves an 18-hole combo, so this is never a variable the UI needs to pass around. */
export const SYSTEM36_TOTAL_HOLES = 18;

/** The handicap every player starts a System 36 round "owing" before any points are earned — `s36Handicap` counts down from here as points come in. */
const SYSTEM36_STARTING_HANDICAP = 36;

/** 1-18 stroke-index rank for every hole (1 = hardest) — duplicated from strokePlay.ts's own private rankHolesBySi rather than shared, per that file's comment: a 4-line helper over a caller-supplied hole list isn't worth a shared export. */
function rankHolesBySi(holes: Hole[]): Map<number, number> {
  const ranked = [...holes].sort((a, b) => a.si - b.si);
  const rank = new Map<number, number>();
  ranked.forEach((h, i) => rank.set(h.n, i + 1));
  return rank;
}

/**
 * S36 points for one hole, gross vs. par — the only scoring input System 36
 * needs while play is happening (no handicap allowance applied per hole,
 * unlike stroke play/Skins — see the README's rule 1).
 *
 * | Result           | Points |
 * |---|---|
 * | Par or better    | 2 |
 * | Bogey (+1)        | 1 |
 * | Double+ (+2 or worse) | 0 |
 */
export function s36PointsForHole(grossStrokes: number, par: number): 0 | 1 | 2 {
  const diff = grossStrokes - par;
  if (diff <= 0) return 2;
  if (diff === 1) return 1;
  return 0;
}

/** Running S36-points total for the holes played so far — SY7's readout and SY8's `S36 pts` tile both call this with whatever `thru` they're tracking (holes played so far mid-round, or 18 once settled — same formula either way, per the README's rule 3). */
export function s36PointsTotal(playerKey: PlayerKey, thru: number, gross: GrossMap, holes: Hole[], playOrder: number[]): number {
  const byN = new Map(holes.map((h) => [h.n, h]));
  const playerGross = gross[playerKey] ?? [];
  return playOrder.slice(0, thru).reduce((sum, holeN) => {
    const hole = byN.get(holeN);
    if (!hole) return sum;
    return sum + s36PointsForHole(playerGross[holeN - 1] ?? 0, hole.par);
  }, 0);
}

/** S36-points sum for a literal hole-number range (0-indexed [start, end), e.g. front nine = [0,9)) — the grid's `Out`/S36 pts summary row, same slicing convention as round.ts's sumRange/strokePlay.ts's nettRangeTotal. */
export function s36PointsRangeTotal(playerKey: PlayerKey, thru: number, start: number, end: number, gross: GrossMap, holes: Hole[], playOrder: number[]): number {
  const byN = new Map(holes.map((h) => [h.n, h]));
  const playedHoles = new Set(playOrder.slice(0, thru));
  const playerGross = gross[playerKey] ?? [];
  let total = 0;
  for (let i = start; i < end; i++) {
    const holeN = i + 1;
    if (!playedHoles.has(holeN)) continue;
    const hole = byN.get(holeN);
    if (!hole) continue;
    total += s36PointsForHole(playerGross[holeN - 1] ?? 0, hole.par);
  }
  return total;
}

/**
 * `handicap = 36 − points`. The SAME formula whether `s36Points` is a
 * partial-round running total or the final 18-hole sum — this is what the
 * README's rule 3 means by "current, not projected": there is no separate
 * projected-handicap formula, only this one evaluated with whatever points
 * total the caller has so far. It starts at 36 (nobody's earned any points
 * yet) and falls as points accumulate.
 *
 * Self-equalising by construction: a better round earns more points here,
 * which subtracts more from 36, producing a LOWER handicap — so a stronger
 * gross round always derives a smaller stroke allowance, pulling that
 * player's eventual Stableford total back toward the field rather than
 * letting a hot round run away with it. (See the README's "known property
 * to expect" — final Stableford totals cluster tightly around 36.)
 */
export function s36Handicap(s36Points: number): number {
  return SYSTEM36_STARTING_HANDICAP - s36Points;
}

/** This player's nett score for every hole, keyed by literal hole number, under the given (live-so-far or final) S36 handicap — mirrors strokePlay.ts's own private nettByHoleNumber, just with a derived handicap standing in for a stored playingHandicap. The building block behind stablefordPointsForHole/stablefordTotal below; nettTotal/nettRangeTotal (imported from strokePlay.ts) cover the plain nett-sum case without needing this. */
function nettByHoleNumber(playerKey: PlayerKey, gross: GrossMap, holes: Hole[], handicap: number): Map<number, number> {
  const rank = rankHolesBySi(holes);
  const playerGross = gross[playerKey] ?? [];
  const byN = new Map<number, number>();
  holes.forEach((h) => {
    const g = playerGross[h.n - 1] ?? 0;
    const siRank = rank.get(h.n) ?? h.n;
    byN.set(h.n, g - strokesReceivedOnHole(handicap, siRank));
  });
  return byN;
}

/**
 * Stableford points for one hole, nett vs. par — the standard curve
 * (Albatross 5, Eagle 4, Birdie 3, Par 2, Bogey 1, Double+ 0), expressed as
 * `max(0, 2 − (nett − par))` so it needs no per-result branching and can't
 * go negative on a blow-up hole.
 */
export function stablefordPointsForHole(nettStrokes: number, par: number): number {
  return Math.max(0, 2 - (nettStrokes - par));
}

/**
 * Running Stableford total for the holes played so far, off the given
 * (live-so-far or final) S36 handicap. Per the README's rule 2, the product
 * decision is to only ever call this with `thru === 18` (SY8's mid-round
 * card shows a dashed placeholder instead of a part-round figure) — but
 * nothing here enforces that; the math is correct for any `thru` (SI
 * allocation restricted to holes actually played), same as nettTotal.
 */
export function stablefordTotal(playerKey: PlayerKey, thru: number, gross: GrossMap, holes: Hole[], handicap: number, playOrder: number[]): number {
  const byN = new Map(holes.map((h) => [h.n, h]));
  const nettByN = nettByHoleNumber(playerKey, gross, holes, handicap);
  return playOrder.slice(0, thru).reduce((sum, holeN) => {
    const hole = byN.get(holeN);
    if (!hole) return sum;
    return sum + stablefordPointsForHole(nettByN.get(holeN) ?? 0, hole.par);
  }, 0);
}

/** Stableford-points sum for a literal hole-number range — the finished grid's `Stbf pts` summary row (SY8c), same slicing convention as s36PointsRangeTotal/nettRangeTotal. */
export function stablefordRangeTotal(
  playerKey: PlayerKey,
  thru: number,
  start: number,
  end: number,
  gross: GrossMap,
  holes: Hole[],
  handicap: number,
  playOrder: number[],
): number {
  const byN = new Map(holes.map((h) => [h.n, h]));
  const nettByN = nettByHoleNumber(playerKey, gross, holes, handicap);
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

// Re-exported so screens reading a finished nett card (SY8b/SY8c's Gross⇄Nett
// tile switch) don't need to import strokePlay.ts directly just for this —
// same generic functions, called with an s36Handicap() result instead of a
// stored playingHandicap.
export { nettRangeTotal as s36NettRangeTotal, nettTotal as s36NettTotal };

/** Per the README's rule 1: no strokes are allocated per hole during play, and per rule 2: nett/Stableford stay muted placeholders until the round is fully in. `holesPlayed` here is the VIEWING player's own thru count (their card), not the field's. */
export function isProjectionUnlocked(holesPlayed: number): boolean {
  return holesPlayed >= 9;
}

/** True once this player's own card has all 18 holes in — the point at which their nett/S36 hcp/Stableford stop being dashed placeholders and become the real, settled numbers (SY8 → SY8b/SY8c). */
export function isRoundSettled(holesPlayed: number): boolean {
  return holesPlayed >= SYSTEM36_TOTAL_HOLES;
}

/**
 * True once the LAST card in the field is fully in — deliberately distinct
 * from isRoundSettled (that's one player's own card). Per the README's SY9
 * spec, the leaderboard unlocks on this, not on the viewing player finishing
 * first: an early finisher shouldn't see a half-empty, still-locked board
 * flip open just because their own card is done.
 */
export function isLeaderboardUnlocked(fieldMinThru: number): boolean {
  return fieldMinThru >= SYSTEM36_TOTAL_HOLES;
}

export type System36StandingRow = {
  playerId: PlayerKey;
  thru: number;
  finished: boolean;
  gross: number;
  s36Points: number;
  s36Handicap: number;
  stableford: number;
  /** 1-based; ties share a rank (standard sports-ranking skip, e.g. 1, 2, 2, 4) — the README lists countback as an explicit open question for this format ("No countback rule is specified in these screens"), so unlike strokePlay.ts's computeTournamentStandings this never attempts to resolve one. */
  rank: number;
};

/**
 * Ranks the field by Stableford points, DESCENDING (most points wins) — the
 * opposite sort direction from stroke play's nett-to-par ascending, per the
 * README's "Stableford is the ranking metric" (SY9b). Ties always share a
 * rank; see the `rank` field doc for why no countback is applied.
 */
export function computeSystem36Standings(playerIds: PlayerKey[], thru: Record<PlayerKey, number>, gross: GrossMap, holes: Hole[], playOrder: number[]): System36StandingRow[] {
  const rows = playerIds.map((playerId) => {
    const t = thru[playerId] ?? 0;
    const finished = t === SYSTEM36_TOTAL_HOLES;
    const s36Points = s36PointsTotal(playerId, t, gross, holes, playOrder);
    const handicap = s36Handicap(s36Points);
    return {
      playerId,
      thru: t,
      finished,
      gross: grossTotal(playerId, t, gross, playOrder),
      s36Points,
      s36Handicap: handicap,
      stableford: stablefordTotal(playerId, t, gross, holes, handicap, playOrder),
    };
  });

  rows.sort((a, b) => b.stableford - a.stableford);

  const ranked: System36StandingRow[] = [];
  rows.forEach((row, i) => {
    const prev = rows[i - 1];
    const sharesRank = prev !== undefined && prev.stableford === row.stableford;
    const rank = sharesRank ? ranked[i - 1]!.rank : i + 1;
    ranked.push({ ...row, rank });
  });
  return ranked;
}
