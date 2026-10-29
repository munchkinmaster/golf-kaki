/**
 * Pure multi-round tournament standings — aggregate nett to par across
 * rounds (design_handoff_multi_round MR9/MR10/MR13). No Supabase here, same
 * "pure derivation" convention as strokePlay.ts: the caller works out each
 * player's per-round figures (computeTournamentStandings already does this
 * for one round) and this module only combines rounds.
 *
 * Only standings_mode 'aggregate' is implemented — 'best_n' is MR1's SOON
 * option.
 */

import { compareCountback } from './countback';
import type { MatchStatus } from './matches';

/** MR's round lifecycle — derived from tournament_rounds.match_id + matches.status, never stored (see 20261029120000_multi_round_tournaments.sql). */
export type TournamentRoundStatus = 'planned' | 'setup' | 'live' | 'done';

/** planned → setup → live → done, from whether the round has a match yet and that match's own status. */
export function deriveRoundStatus(matchStatus: MatchStatus | null): TournamentRoundStatus {
  if (matchStatus === null) return 'planned';
  if (matchStatus === 'lobby') return 'setup';
  return matchStatus === 'live' ? 'live' : 'done';
}

export type RoundRef = { index: number; status: TournamentRoundStatus };

/**
 * Where a tournament is in its schedule, from the lobby's point of view:
 * - 'setup': `current` has a match that hasn't started (MR6a before R1, or a later round after MR11 confirmed it)
 * - 'live': `current` is being scored (MR6b)
 * - 'between': the last round played is done and `current` (the next) isn't set up yet (MR6)
 * - 'complete': every round is done; `current` is the final round
 * `previous` is the latest finished round before `current` (null before any finish).
 */
export type TournamentPhase = 'setup' | 'live' | 'between' | 'complete';

export function pickCurrentRound<R extends RoundRef>(rounds: R[]): { phase: TournamentPhase; current: R; previous: R | null } | null {
  const sorted = [...rounds].sort((a, b) => a.index - b.index);
  const current = sorted.find((r) => r.status !== 'done');
  if (!current) {
    const last = sorted[sorted.length - 1];
    return last ? { phase: 'complete', current: last, previous: last } : null;
  }
  const previous = [...sorted].reverse().find((r) => r.status === 'done' && r.index < current.index) ?? null;
  const phase: TournamentPhase = current.status === 'live' ? 'live' : current.status === 'setup' ? 'setup' : 'between';
  return { phase, current, previous };
}

/** One player's result for one round. 'dns' = on the roster but not playing that round (MR11 attendance off). `countback` is countback.ts's countbackKey for that round's card — only needed under the 'countback' tie-break rule. */
export type PlayerRoundEntry =
  | { kind: 'played'; gross: number; nett: number; toPar: number; thru: number; holes: number; countback?: number[] }
  | { kind: 'dns' };

export type TieBreakRule = 'countback' | 'shared_place';

/** entries[playerId][roundIndex]. A missing entry for a counted round reads as played-but-not-started (thru 0), not DNS. */
export type RoundEntries = Record<string, Record<number, PlayerRoundEntry | undefined>>;

export type AggregateStandingRow = {
  playerId: string;
  /** Per-round cell for every counted round, keyed by round index. */
  rounds: Record<number, PlayerRoundEntry>;
  /** Sum of toPar over the rounds this player played. */
  totalToPar: number;
  totalNett: number;
  holesPlayed: number;
  /** Counted rounds this player didn't start (MR9 "Missed R2"). */
  missedRounds: number[];
  /** 1-based; ties share a rank (1, 2, 2, 4). Null for anyone who missed a round — MR9's "—". */
  rank: number | null;
  /** Places gained since the previous counted round (MR9's ▲1 is +1, a drop is negative). Null when there's no previous round or either rank is null. */
  movement: number | null;
};

/** Rounds that have started — the only ones that count toward standings. */
function countedRounds(rounds: RoundRef[]): number[] {
  return rounds
    .filter((r) => r.status === 'live' || r.status === 'done')
    .map((r) => r.index)
    .sort((a, b) => a - b);
}

/**
 * R&A Committee Procedures 5A(6)(d) for a multi-round event: the best score
 * for the LAST round wins the tie, then that round's card is counted back
 * (last 9 / 6 / 3 / 18th … — countback.ts). Only applies once both players
 * have a complete card for that round; anything less stays a shared place,
 * same stance as single-round computeTournamentStandings.
 */
function compareLastRound(a: PlayerRoundEntry | undefined, b: PlayerRoundEntry | undefined): number {
  if (a?.kind !== 'played' || b?.kind !== 'played' || a.thru < a.holes || b.thru < b.holes) return 0;
  if (a.nett !== b.nett) return a.nett - b.nett;
  return a.countback && b.countback ? compareCountback(a.countback, b.countback) : 0;
}

function rank(playerIds: string[], roundIndexes: number[], entries: RoundEntries, tieBreakRule: TieBreakRule): Omit<AggregateStandingRow, 'movement'>[] {
  const rows = playerIds.map((playerId) => {
    const cells: Record<number, PlayerRoundEntry> = {};
    const missedRounds: number[] = [];
    let totalToPar = 0;
    let totalNett = 0;
    let holesPlayed = 0;
    for (const index of roundIndexes) {
      const entry = entries[playerId]?.[index] ?? { kind: 'played', gross: 0, nett: 0, toPar: 0, thru: 0, holes: 18 };
      cells[index] = entry;
      if (entry.kind === 'dns') {
        missedRounds.push(index);
        continue;
      }
      totalToPar += entry.toPar;
      totalNett += entry.nett;
      holesPlayed += entry.thru;
    }
    return { playerId, rounds: cells, totalToPar, totalNett, holesPlayed, missedRounds };
  });

  const lastRound = roundIndexes[roundIndexes.length - 1];
  const tieOrder = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
    tieBreakRule === 'countback' && lastRound !== undefined ? compareLastRound(a.rounds[lastRound], b.rounds[lastRound]) : 0;

  // Everyone who's played every counted round, by total to par; then DNS
  // players (MR9: "DNS players stay on the board but rank after everyone
  // who has completed every round") — fewest missed rounds first, then total.
  rows.sort((a, b) => {
    if (a.missedRounds.length !== b.missedRounds.length) return a.missedRounds.length - b.missedRounds.length;
    if (a.totalToPar !== b.totalToPar) return a.totalToPar - b.totalToPar;
    return tieOrder(a, b);
  });

  const ranked: Omit<AggregateStandingRow, 'movement'>[] = [];
  rows.forEach((row, i) => {
    if (row.missedRounds.length > 0) {
      ranked.push({ ...row, rank: null });
      return;
    }
    // Shares the place above when the totals match and the tie-break
    // couldn't separate them (or the tournament uses shared_place).
    const prevRow = rows[i - 1];
    const prevRank = ranked[i - 1]?.rank ?? null;
    const sharesRank = prevRow !== undefined && prevRank !== null && prevRow.totalToPar === row.totalToPar && tieOrder(prevRow, row) === 0;
    ranked.push({ ...row, rank: sharesRank ? prevRank : i + 1 });
  });
  return ranked;
}

/**
 * MR9 "Overall" — aggregate nett to par over every round that has started
 * (a live round counts at its current thru, which is what MR7's "Overall −5
 * · 2nd · 5 back" strip shows mid-round).
 */
export function computeAggregateStandings(
  playerIds: string[],
  rounds: RoundRef[],
  entries: RoundEntries,
  tieBreakRule: TieBreakRule,
): AggregateStandingRow[] {
  const counted = countedRounds(rounds);
  // The tie-break settles the FINAL result only — mid-event, level totals
  // share the place (T1), the same as any golf leaderboard. Before this, a
  // three-way tie after Round 1 showed 1st/2nd/3rd off that round's back 9.
  // `rounds` keeps every round (roundsThrough marks later ones 'planned'),
  // so "all done" really means the tournament is over.
  const complete = rounds.length > 0 && rounds.every((r) => r.status === 'done');
  const current = rank(playerIds, counted, entries, complete ? tieBreakRule : 'shared_place');
  if (counted.length < 2) return current.map((row) => ({ ...row, movement: null }));

  const previousRank = new Map(rank(playerIds, counted.slice(0, -1), entries, 'shared_place').map((row) => [row.playerId, row.rank]));
  return current.map((row) => {
    const before = previousRank.get(row.playerId) ?? null;
    return { ...row, movement: before !== null && row.rank !== null ? before - row.rank : null };
  });
}

export type LowRound = { playerId: string; roundIndex: number; nett: number; toPar: number };

/** MR9/MR13 "Low round" — the best nett to par among completed cards in finished rounds. Earliest round wins a tie. */
export function findLowRound(playerIds: string[], rounds: RoundRef[], entries: RoundEntries): LowRound | null {
  let best: LowRound | null = null;
  const done = rounds.filter((r) => r.status === 'done').map((r) => r.index).sort((a, b) => a - b);
  for (const roundIndex of done) {
    for (const playerId of playerIds) {
      const entry = entries[playerId]?.[roundIndex];
      if (entry?.kind !== 'played' || entry.thru < entry.holes) continue;
      if (best === null || entry.toPar < best.toPar) best = { playerId, roundIndex, nett: entry.nett, toPar: entry.toPar };
    }
  }
  return best;
}

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th, 21st. */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * MR10's position card — "2nd overall after Round 1 / 6 back of Daniel with
 * 2 rounds to go." `rows` are computeAggregateStandings after `roundIndex`.
 * Null when the viewer isn't on the board.
 */
export function positionSummary(
  rows: AggregateStandingRow[],
  viewerId: string | undefined,
  roundIndex: number,
  roundsToGo: number,
  firstNameOf: (playerId: string) => string,
): { title: string; detail: string } | null {
  const me = rows.find((r) => r.playerId === viewerId);
  if (!me) return null;
  if (me.rank === null) {
    return { title: `Missed Round ${me.missedRounds.join(' & ')}`, detail: 'You stay on the board and rank after everyone who completes every round.' };
  }
  const toGo = roundsToGo > 0 ? ` with ${roundsToGo} round${roundsToGo === 1 ? '' : 's'} to go` : '';
  const shots = (n: number) => `${n} shot${n === 1 ? '' : 's'}`;
  if (me.rank === 1) {
    const level = rows.filter((r) => r.rank === 1 && r.playerId !== me.playerId);
    if (level.length > 0) {
      return { title: `Tied for the lead after Round ${roundIndex}`, detail: `Level with ${level.map((r) => firstNameOf(r.playerId)).join(' & ')}${toGo}.` };
    }
    const next = rows.find((r) => r.rank !== null && r.playerId !== me.playerId);
    return {
      title: `Leading after Round ${roundIndex}`,
      detail: next ? `${shots(next.totalToPar - me.totalToPar)} clear of ${firstNameOf(next.playerId)}${toGo}.` : `Out on your own${toGo}.`,
    };
  }
  const leader = rows.find((r) => r.rank === 1)!;
  return { title: `${ordinal(me.rank)} overall after Round ${roundIndex}`, detail: `${me.totalToPar - leader.totalToPar} back of ${firstNameOf(leader.playerId)}${toGo}.` };
}

/**
 * The Tie-break row on the review/lobby "Format & rules" cards — what every
 * player sees before tee-off, so a countback result later isn't a surprise.
 * Multi-round compares the final round first (compareLastRound); a single
 * round goes straight to the card's back 9 / 6 / 3 / 18th.
 */
export function tieBreakSummary(rule: TieBreakRule, multiRound: boolean): { label: string; sub: string } {
  if (rule === 'shared_place') return { label: 'Shared place', sub: 'Level scores share the position.' };
  return multiRound
    ? { label: 'Final round, then countback', sub: 'Level on total? Better final-round nett wins, then its last 9, 6, 3 and 18th.' }
    : { label: 'Back-9 countback', sub: 'Level? Better last 9 wins, then last 6, 3 and the 18th.' };
}

/** The note under a multi-round table that has shared places — why level players aren't split yet, and what happens if they're still level at the end. */
export function sharedPlaceNote(rule: TieBreakRule): string {
  return rule === 'countback'
    ? 'Level scores share the place until the tournament ends. Only a tie on the final total goes to the tie-break: better final-round nett, then countback.'
    : 'Level scores share the place. This tournament doesn’t break ties.';
}

/** True when any ranked row shares its place with another — the cue to show sharedPlaceNote. */
export function hasSharedPlace(rows: { rank: number | null }[]): boolean {
  const ranks = rows.flatMap((r) => (r.rank === null ? [] : [r.rank]));
  return new Set(ranks).size < ranks.length;
}

/** countback.ts's SEGMENTS, in the same order, as they read in a sentence. */
const COUNTBACK_SEGMENT_LABEL = ['last 9', 'last 6', 'last 3', '18th hole', "front 9's last 6", "front 9's last 3", '9th hole'];

function joinNames(names: string[]): string {
  return names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function signedToPar(toPar: number): string {
  if (toPar === 0) return 'E';
  return toPar < 0 ? `−${Math.abs(toPar)}` : `+${toPar}`;
}

/**
 * Why players level on total got different places (MR13 / leaderboard) — a
 * plain "1st / 2nd / 3rd" beside three identical totals reads as a bug unless
 * it's spelled out. One note per level group, mirroring compareLastRound's
 * order: lower last-round nett first, then that card's countback; anyone the
 * tie-break couldn't split shares the place. `decidedIds` = players whose
 * place came from the tie-break (they get a "Countback" tag in the table).
 * `rows` are computeAggregateStandings output.
 */
export function explainTieBreaks(
  rows: AggregateStandingRow[],
  tieBreakRule: TieBreakRule,
  firstNameOf: (playerId: string) => string,
): { decidedIds: Set<string>; notes: string[] } {
  const decidedIds = new Set<string>();
  const notes: string[] = [];
  if (tieBreakRule !== 'countback') return { decidedIds, notes };

  const ranked = rows.filter((r) => r.rank !== null);
  for (let start = 0; start < ranked.length; ) {
    let end = start + 1;
    while (end < ranked.length && ranked[end]!.totalToPar === ranked[start]!.totalToPar) end++;
    const group = ranked.slice(start, end);
    start = end;
    if (group.length < 2 || group.every((r) => r.rank === group[0]!.rank)) continue;

    const lastRound = Math.max(...Object.keys(group[0]!.rounds).map(Number));
    const cards = group.map((r) => r.rounds[lastRound]);
    const allComplete = cards.every((c) => c?.kind === 'played' && c.thru >= c.holes);
    const sentences = [`${joinNames(group.map((r) => firstNameOf(r.playerId)))} finished level on ${signedToPar(group[0]!.totalToPar)}.`];

    if (allComplete && new Set(cards.map((c) => (c as Extract<PlayerRoundEntry, { kind: 'played' }>).nett)).size > 1) {
      const netts = group.map((r, i) => `${firstNameOf(r.playerId)} ${(cards[i] as Extract<PlayerRoundEntry, { kind: 'played' }>).nett}`);
      sentences.push(`The lower Round ${lastRound} nett takes the higher place: ${netts.join(', ')}.`);
    }

    for (let i = 1; i < group.length; i++) {
      const above = group[i - 1]!;
      const below = group[i]!;
      const a = cards[i - 1];
      const b = cards[i];
      const aName = firstNameOf(above.playerId);
      const bName = firstNameOf(below.playerId);
      if (above.rank === below.rank) {
        sentences.push(`${aName} and ${bName} couldn't be separated and share ${ordinal(above.rank!)}.`);
      } else if (a?.kind === 'played' && b?.kind === 'played' && a.nett === b.nett && a.countback && b.countback) {
        const segment = a.countback.findIndex((v, idx) => v !== b.countback![idx]);
        sentences.push(`${aName} and ${bName} both had ${a.nett}, so ${aName} took it on countback (better Round ${lastRound} ${COUNTBACK_SEGMENT_LABEL[segment]}).`);
      }
    }

    group.forEach((r) => {
      if (group.filter((o) => o.rank === r.rank).length === 1) decidedIds.add(r.playerId);
    });
    notes.push(sentences.join(' '));
  }
  return { decidedIds, notes };
}

/**
 * Swaps the round being played for its LIVE figures — the rest of the
 * tournament comes from a one-off fetchTournamentResults, while the screen's
 * own useTournamentRound keeps this round current hole by hole. Only seated
 * players get a live entry; anyone DNS for the round keeps that.
 */
export function withLiveRound<R extends RoundRef>(
  rounds: R[],
  entries: RoundEntries,
  roundIndex: number,
  status: TournamentRoundStatus,
  live: Record<string, PlayerRoundEntry>,
): { rounds: R[]; entries: RoundEntries } {
  const merged: RoundEntries = {};
  for (const [playerId, byRound] of Object.entries(entries)) merged[playerId] = { ...byRound };
  for (const [playerId, entry] of Object.entries(live)) (merged[playerId] ??= {})[roundIndex] = entry;
  return { rounds: rounds.map((r) => (r.index === roundIndex ? { ...r, status } : r)), entries: merged };
}

/** The same rounds with everything after `roundIndex` treated as not yet played — "standings after R1" while R2 is live (MR8, MR10). */
export function roundsThrough<R extends RoundRef>(rounds: R[], roundIndex: number): R[] {
  return rounds.map((r) => (r.index <= roundIndex ? r : { ...r, status: 'planned' as const }));
}

/** The Home tournament card's call to action (design_handoff_multi_round MR12 table). */
export type HomeCardAction = 'beginRound' | 'waitingForSetup' | 'openLobby' | 'joinScoring' | 'viewLeaderboard';

/**
 * MR12: organiser between rounds → "Begin Round N" (MR11); a player then →
 * waiting on the organiser. Once set up → "Open lobby"; live → "Join scoring"
 * for anyone seated. A player marked DNS for the round gets the leaderboard
 * instead — the organiser always keeps the lobby, playing or not, since
 * they run the round.
 */
export function homeCardAction(isOrganiser: boolean, phase: Exclude<TournamentPhase, 'complete'>, seatedThisRound: boolean): HomeCardAction {
  if (phase === 'between') return isOrganiser ? 'beginRound' : 'waitingForSetup';
  if (!seatedThisRound) return isOrganiser ? 'openLobby' : 'viewLeaderboard';
  return phase === 'live' ? 'joinScoring' : 'openLobby';
}
