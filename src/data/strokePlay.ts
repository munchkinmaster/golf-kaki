/**
 * Pure stroke-play tournament scoring math — no Supabase here (see
 * data/scores.ts for the live fetch/write layer), mirroring round.ts and
 * skins.ts's "pure derivation" convention. Deliberately separate from
 * round.ts: that module is Kaki Match Play's pairwise stroke-betting engine
 * (see its own docblock) and has no notion of a tournament-wide nett total.
 * The per-hole nett figure here (gross minus strokesReceivedOnHole) is the
 * same math skins.ts's skinsScoreForHole uses for its 'nett' basis — a
 * player's handicap allowance works the same way whether it's being applied
 * for the main field or for a Skins side pot, just computed locally here
 * rather than imported (this module doesn't otherwise depend on skins.ts).
 */

import { strokesReceivedOnHole } from './handicap';
import { grossTotal } from './round';
import type { GrossMap, Hole, PlayerKey } from './round';

export type ScoreClass = 'eagle' | 'birdie' | 'par' | 'bogey' | 'double';

/** 1-18 stroke-index rank for every hole (1 = hardest) — duplicated from skins.ts's own private rankHolesBySi rather than shared, per that file's comment: a 4-line helper over a caller-supplied hole list isn't worth a shared export. */
function rankHolesBySi(holes: Hole[]): Map<number, number> {
  const ranked = [...holes].sort((a, b) => a.si - b.si);
  const rank = new Map<number, number>();
  ranked.forEach((h, i) => rank.set(h.n, i + 1));
  return rank;
}

/** This player's nett score for every hole, keyed by literal hole number — gross minus their handicap-stroke allowance on that hole (via strokesReceivedOnHole against the hole's SI). The shared building block behind nettTotal and computeTournamentStandings' countback. */
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
 * A tournament field's nett total — same shape as round.ts's grossTotal, but
 * each hole is gross minus this player's handicap-stroke allowance on that
 * hole (via strokesReceivedOnHole against the hole's SI), not raw gross.
 */
export function nettTotal(playerKey: PlayerKey, thru: number, gross: GrossMap, holes: Hole[], playingHandicap: number, playOrder: number[]): number {
  const nettByN = nettByHoleNumber(playerKey, gross, holes, playingHandicap);
  return playOrder.slice(0, thru).reduce((sum, holeN) => sum + (nettByN.get(holeN) ?? 0), 0);
}

/** Nett sum for a literal hole-number range (0-indexed [start, end) — same slicing convention as round.ts's sumRange, e.g. front nine = [0,9)), restricted to holes actually played (first `thru` entries of playOrder). The nett equivalent of sumRange, for the scorecard grid's OUT/IN column when toggled to nett. */
export function nettRangeTotal(
  playerKey: PlayerKey,
  thru: number,
  start: number,
  end: number,
  gross: GrossMap,
  holes: Hole[],
  playingHandicap: number,
  playOrder: number[],
): number {
  const nettByN = nettByHoleNumber(playerKey, gross, holes, playingHandicap);
  const playedHoles = new Set(playOrder.slice(0, thru));
  let total = 0;
  for (let i = start; i < end; i++) {
    const holeN = i + 1;
    if (playedHoles.has(holeN)) total += nettByN.get(holeN) ?? 0;
  }
  return total;
}

/** Sum of par for the holes played so far — the "to par" tile's baseline; nothing in round.ts does a bare par sum on its own. */
export function parTotal(thru: number, holes: Hole[], playOrder: number[]): number {
  const byN = new Map(holes.map((h) => [h.n, h]));
  return playOrder.slice(0, thru).reduce((sum, holeN) => sum + (byN.get(holeN)?.par ?? 0), 0);
}

/** 5-way score classification (eagle distinct from birdie) — ScoreCell/ScoreBadge collapse both into one "under" bucket for their badge shape, but the S7 quick-pick chips and per-hole labels need the finer split, per colors.scoreEagle/scoreBirdie/scorePar/scoreBogey/scoreDouble. */
export function classifyDiff(diff: number): ScoreClass {
  if (diff <= -2) return 'eagle';
  if (diff === -1) return 'birdie';
  if (diff === 0) return 'par';
  if (diff === 1) return 'bogey';
  return 'double';
}

export const SCORE_CLASS_LABEL: Record<ScoreClass, string> = {
  eagle: 'Eagle',
  birdie: 'Birdie',
  par: 'Par',
  bogey: 'Bogey',
  double: 'Double+',
};

/**
 * The 4 quick-pick chips on S7 (Eagle/Birdie/Par/Bogey) — each is the GROSS
 * value that nets to that class on this hole, given this player's handicap
 * stroke allowance here. E.g. Par 4, 1 stroke received → Eagle 3 / Birdie 4 /
 * Par 5 / Bogey 6 (verified against the design handoff's S7 mock). Clamped
 * to a minimum of 1 stroke — only matters for a low-par hole with a big
 * allowance, but a 0-or-negative gross value is never valid.
 */
export function quickPickOptions(holePar: number, siRank: number, playingHandicap: number): { scoreClass: ScoreClass; grossValue: number }[] {
  const received = strokesReceivedOnHole(playingHandicap, siRank);
  const offsets: [ScoreClass, number][] = [
    ['eagle', -2],
    ['birdie', -1],
    ['par', 0],
    ['bogey', 1],
  ];
  return offsets.map(([scoreClass, offset]) => ({ scoreClass, grossValue: Math.max(1, holePar + offset + received) }));
}

export type TournamentStandingRow = {
  playerId: PlayerKey;
  thru: number;
  finished: boolean;
  gross: number;
  nett: number;
  /** nett minus par for the holes played so far — the ranking metric (S9's "Total" column, despite the label). */
  toPar: number;
  /** 1-based; ties share a rank under 'shared_place' or an unresolved (not-both-finished) countback. */
  rank: number;
};

/** Countback comparison key for a finished (thru === holes.length) card — back-9, back-6, back-3, then the 18th hole's nett alone, ascending (lower is better at each tier). The standard recognized stroke-play tie-break order. Only meaningful once every hole 1-18 has been played, regardless of tee-off order, which is why this reads literal hole numbers rather than playOrder. */
function countbackKey(nettByN: Map<number, number>): number[] {
  const sumRange = (start: number, end: number) => {
    let total = 0;
    for (let n = start; n <= end; n++) total += nettByN.get(n) ?? 0;
    return total;
  };
  return [sumRange(10, 18), sumRange(13, 18), sumRange(16, 18), nettByN.get(18) ?? 0];
}

function compareKeys(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i]! - b[i]!;
  }
  return 0;
}

/**
 * Ranks the field by nett-to-par, ascending (lowest wins) — the
 * tournaments.standings_basis migration's "only nett is in scope for v1"
 * path. `thru` is each player's OWN completion count (caller passes
 * computeThru([id], scores, playOrder) per player — this module stays
 * scores-agnostic, same convention nettTotal/grossTotal already use).
 *
 * Ties only resolve via countback once BOTH tied players are fully
 * finished — comparing completed-round subtotals against a partial card
 * doesn't mean anything. A mid-round tie (or a 'shared_place' tournament)
 * shares the same rank number, and the next rank skips by the tied count
 * (1, 2, 2, 4 — standard sports-ranking convention).
 */
export function computeTournamentStandings(
  playerIds: PlayerKey[],
  thru: Record<PlayerKey, number>,
  gross: GrossMap,
  holes: Hole[],
  playingHandicaps: Record<PlayerKey, number>,
  playOrder: number[],
  tieBreakRule: 'countback' | 'shared_place',
): TournamentStandingRow[] {
  const rows = playerIds.map((playerId) => {
    const t = thru[playerId] ?? 0;
    const finished = t === holes.length;
    const nettByN = nettByHoleNumber(playerId, gross, holes, playingHandicaps[playerId] ?? 0);
    const nett = playOrder.slice(0, t).reduce((sum, holeN) => sum + (nettByN.get(holeN) ?? 0), 0);
    return {
      playerId,
      thru: t,
      finished,
      gross: grossTotal(playerId, t, gross, playOrder),
      nett,
      toPar: nett - parTotal(t, holes, playOrder),
      countback: countbackKey(nettByN),
    };
  });

  rows.sort((a, b) => {
    if (a.toPar !== b.toPar) return a.toPar - b.toPar;
    if (tieBreakRule === 'countback' && a.finished && b.finished) return compareKeys(a.countback, b.countback);
    return 0; // stays a shared rank below
  });

  const ranked: TournamentStandingRow[] = [];
  rows.forEach((row, i) => {
    // Same rank as the row above when they're an unresolved tie (equal
    // toPar, and either not both finished or the tournament uses
    // shared_place) — countback-resolved ties already have a strict sort
    // order above and should NOT share a rank despite equal toPar.
    const prev = rows[i - 1];
    const resolvedByCountback = tieBreakRule === 'countback' && row.finished && prev?.finished;
    const sharesRank = prev !== undefined && prev.toPar === row.toPar && !resolvedByCountback;
    const rank = sharesRank ? ranked[i - 1]!.rank : i + 1;
    ranked.push({ playerId: row.playerId, thru: row.thru, finished: row.finished, gross: row.gross, nett: row.nett, toPar: row.toPar, rank });
  });
  return ranked;
}
