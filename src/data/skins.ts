/**
 * Skins side-game math — pure derivation over the same scores store the
 * stroke-play grid/leaderboard read, mirroring round.ts's philosophy (no
 * materialized results anywhere; everything here is computed from recorded
 * scores + config on demand). Config/participation are read from
 * `matches.game_settings` (see the migration comment in
 * 20260810120000_tournament_stroke_play.sql for the jsonb shape) — this
 * module only does the math, no Supabase calls.
 *
 * `playOrder` throughout is expected pre-sliced to the round's actual hole
 * count (e.g. `buildPlayOrder(startHole).slice(0, holes.length)`), matching
 * the convention every round.ts caller already uses — buildPlayOrder itself
 * always returns 18 entries regardless of holesToPlay.
 */

import { strokesReceivedOnHole } from './handicap';
import type { Hole, HoleScoreMap, PlayerKey } from './round';

export type SkinsBasis = 'nett' | 'gross';
/**
 * The S5 config sheet's "On a tied hole" control — one round-wide rule
 * applied to every tie, superseding Phase 1's separate
 * carryover/lastHoleTieRule split (that was written against an earlier,
 * less complete read of the spec; the actual .dc.html only exposes this
 * single 3-way choice, no separate last-hole setting):
 *  - 'carryover': rolls into the next hole. If the round's true final hole
 *    is STILL tied with nowhere left to carry into, it falls back to
 *    splitting evenly among whoever's tied there — a forced terminal case,
 *    not a separate user-facing setting (there's no hole 19 to roll into).
 *  - 'split_pot': ties split evenly immediately, every time, including the
 *    final hole — no carry ever happens under this rule.
 *  - 'void': the tied hole's skin is discarded outright — nobody wins it,
 *    it does NOT carry, and no ante is charged for that hole either
 *    (confirmed) — it's excluded from everyone's net entirely rather than a
 *    "lost" stake with no winner. Keeps the zero-sum property intact.
 */
export type SkinsTiedHoleRule = 'carryover' | 'split_pot' | 'void';

export type SkinsConfig = {
  type: 'skins';
  stakePerHole: number;
  tiedHoleRule: SkinsTiedHoleRule;
  basis: SkinsBasis;
  /** Player ids opted into the pot — "In the game" on S6c. Everyone else's scores are ignored for skins even though they're still in the main stroke-play field. */
  participantIds: PlayerKey[];
};

/** The jsonb shape stored at matches.game_settings — an array so future side-game types (Nassau, Banker, Snake) slot in without another migration. Only 'skins' exists today. */
export type SideGameSettings = {
  sideGames?: SkinsConfig[];
};

/** 1-18 stroke-index rank for every hole (1 = hardest) — same pattern as round.ts's private rankBySi and handicap.ts's inline version, kept local rather than shared since it's a 4-line helper over a caller-supplied hole list. */
function rankHolesBySi(holes: Hole[]): Map<number, number> {
  const ranked = [...holes].sort((a, b) => a.si - b.si);
  const rank = new Map<number, number>();
  ranked.forEach((h, i) => rank.set(h.n, i + 1));
  return rank;
}

/** The score a hole counts for skins purposes — gross as played, or nett (gross minus this player's handicap strokes on this hole) per the config's basis. */
export function skinsScoreForHole(basis: SkinsBasis, grossStrokes: number, playingHandicap: number, siRank: number): number {
  if (basis === 'gross') return grossStrokes;
  return grossStrokes - strokesReceivedOnHole(playingHandicap, siRank);
}

/**
 * How many holes (in play order) have a recorded score for every skins
 * participant — the skins-scoped equivalent of round.ts's computeThru. A
 * side game's own pot can only resolve as far as ITS participants have all
 * scored, independent of how far the rest of the field (or a non-participant)
 * has gotten.
 */
export function computeSkinsThru(participantIds: PlayerKey[], scores: HoleScoreMap, playOrder: number[]): number {
  let thru = 0;
  for (const n of playOrder) {
    const allScored = participantIds.every((p) => scores[p]?.[n] !== undefined);
    if (!allScored) break;
    thru++;
  }
  return thru;
}

export type SkinsHoleResult = {
  holeN: number;
  /** null when this hole didn't resolve to a sole winner — either still carrying, or resolved as a split/void (see tiedPlayers/voided). */
  winner: PlayerKey | null;
  /** Skin-units resolved this hole: to `winner` if set, split across `tiedPlayers` if a split resolution, 0 if still carrying or voided. */
  skinsAtStake: number;
  /** Who tied for lowest this hole. Populated for a still-carrying, split, or voided tie; empty once a hole resolves to a sole winner. */
  tiedPlayers: PlayerKey[];
  /** True only for a 'void'-ruled tie — this hole (and nothing carried into it) is excluded from every participant's ante, not just left at a 0 delta. */
  voided: boolean;
};

/**
 * Resolves every played hole into a winner, a split, a void, or a still-open
 * carry, per the config's basis and tie rule. Read this alongside
 * computeSkinsStandings, which turns these hole results into each player's
 * running skins count and dollar net — kept as two functions so a future
 * leaderboard can render the hole-by-hole list (S9's expandable breakdown)
 * straight from this one.
 */
export function resolveSkinsHoles(
  config: SkinsConfig,
  scores: HoleScoreMap,
  holes: Hole[],
  playingHandicaps: Record<PlayerKey, number>,
  playOrder: number[],
): SkinsHoleResult[] {
  const rank = rankHolesBySi(holes);
  const thru = computeSkinsThru(config.participantIds, scores, playOrder);
  const results: SkinsHoleResult[] = [];
  let carried = 0;

  for (let i = 0; i < thru; i++) {
    const holeN = playOrder[i]!;
    const siRank = rank.get(holeN)!;
    carried += 1;

    const holeScores = config.participantIds.map((p) => ({
      player: p,
      score: skinsScoreForHole(config.basis, scores[p]![holeN]!, playingHandicaps[p] ?? 0, siRank),
    }));
    const lowest = Math.min(...holeScores.map((s) => s.score));
    const tied = holeScores.filter((s) => s.score === lowest).map((s) => s.player);

    // Only the round's true final hole (every participant has scored every
    // hole through here) forces carryover's terminal split — a mid-round
    // carryover tie always just rolls forward, however many players share it.
    const isFinalHole = i === thru - 1 && thru === playOrder.length;

    if (tied.length === 1) {
      results.push({ holeN, winner: tied[0]!, skinsAtStake: carried, tiedPlayers: [], voided: false });
      carried = 0;
    } else if (config.tiedHoleRule === 'split_pot' || (config.tiedHoleRule === 'carryover' && isFinalHole)) {
      results.push({ holeN, winner: null, skinsAtStake: carried, tiedPlayers: tied, voided: false });
      carried = 0;
    } else if (config.tiedHoleRule === 'void') {
      results.push({ holeN, winner: null, skinsAtStake: 0, tiedPlayers: tied, voided: true });
      carried = 0; // discarded outright, not rolled forward
    } else {
      results.push({ holeN, winner: null, skinsAtStake: 0, tiedPlayers: tied, voided: false });
      // carryover, not yet the final hole — carried rolls forward untouched.
    }
  }

  return results;
}

/**
 * Skin-units riding on the hole currently being played — it's still in
 * progress (not every participant has scored it yet), so it never appears in
 * resolveSkinsHoles's own output, which only covers fully-resolved holes.
 * Stake is this hole's own ante (1) plus however many immediately preceding
 * holes are still an open 'carryover' tie (resolveSkinsHoles resets `carried`
 * to 0 the moment a hole resolves to a winner/split/void, so walking
 * backward from the end of `results` until a non-carrying entry reproduces
 * that same running count for the hole that comes next). Empty once the
 * round's last hole is already resolved — nothing left to play.
 */
export function openHoleSkinsStake(results: SkinsHoleResult[], totalHoles: number): { stake: number; carriedFromHoles: number[] } {
  if (results.length >= totalHoles) return { stake: 0, carriedFromHoles: [] };
  const carriedFromHoles: number[] = [];
  for (let i = results.length - 1; i >= 0; i--) {
    const r = results[i]!;
    if (r.winner === null && !r.voided && r.skinsAtStake === 0) carriedFromHoles.unshift(r.holeN);
    else break;
  }
  return { stake: carriedFromHoles.length + 1, carriedFromHoles };
}

export type SkinsPlayerResult = {
  /** May be fractional — an evenly-split final-hole tie divides a whole number of skins among more than one player. */
  skinsWon: number;
  netDollars: number;
  /** holeN -> this player's skin-count delta that hole: +N on a hole they won or shared, -N on a hole someone else resolved (N = skins resolved that hole, ≥1 after a carry — symmetric with the winner's side), 0 on a hole still carrying (nothing's changed hands yet) or not yet played. */
  holeDeltas: Record<number, number>;
};

/**
 * Turns resolved holes into a running per-player skins count + dollar net.
 * Real-money skins settlement, not a flat multiply: on every hole they WIN
 * outright, a player collects stakePerHole from each of the other
 * (participantCount − 1) players — so a hole that resolved a carry (worth
 * `skinsAtStake` skins) pays stakePerHole × skinsAtStake × (participantCount
 * − 1). On every hole they don't win, they owe stakePerHole (or their share
 * of it, for a split). Summed and simplified across the round this reduces
 * to stakePerHole × (skinsWon × participantCount − holesAnted) — still
 * zero-sum, since skinsWon always sums to holesAnted across participants.
 */
export function computeSkinsStandings(config: SkinsConfig, results: SkinsHoleResult[]): Record<PlayerKey, SkinsPlayerResult> {
  const standings: Record<PlayerKey, SkinsPlayerResult> = {};
  config.participantIds.forEach((p) => {
    standings[p] = { skinsWon: 0, netDollars: 0, holeDeltas: {} };
  });

  for (const r of results) {
    if (r.voided) {
      config.participantIds.forEach((p) => {
        standings[p]!.holeDeltas[r.holeN] = 0;
      });
      continue; // excluded from the ante count below too
    }
    if (r.winner) {
      standings[r.winner]!.skinsWon += r.skinsAtStake;
      standings[r.winner]!.holeDeltas[r.holeN] = r.skinsAtStake;
      config.participantIds
        .filter((p) => p !== r.winner)
        .forEach((p) => {
          // A resolved carry (e.g. 4 skins riding on one hole) is a 4-skin swing
          // for the losers too, not a flat -1 — mirrors the winner's +skinsAtStake
          // so the hole-by-hole breakdown reads as one consistent unit on both sides.
          standings[p]!.holeDeltas[r.holeN] = -r.skinsAtStake;
        });
    } else if (r.tiedPlayers.length > 0 && r.skinsAtStake > 0) {
      const share = r.skinsAtStake / r.tiedPlayers.length;
      r.tiedPlayers.forEach((p) => {
        standings[p]!.skinsWon += share;
        standings[p]!.holeDeltas[r.holeN] = share;
      });
      config.participantIds
        .filter((p) => !r.tiedPlayers.includes(p))
        .forEach((p) => {
          standings[p]!.holeDeltas[r.holeN] = -r.skinsAtStake;
        });
    } else {
      config.participantIds.forEach((p) => {
        standings[p]!.holeDeltas[r.holeN] = 0;
      });
    }
  }

  const participantCount = config.participantIds.length;
  const holesAnted = results.filter((r) => !r.voided).length;
  config.participantIds.forEach((p) => {
    standings[p]!.netDollars = config.stakePerHole * (standings[p]!.skinsWon * participantCount - holesAnted);
  });

  return standings;
}
