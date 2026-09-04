/**
 * The one live-round data source, called independently by each of the 5
 * live-round screens (Scorecard, Leaderboard, InGameLobby, Finish, Recap)
 * with their own `route.params.matchId`. Each hook instance keeps its own
 * local state (so a screen's mutation functions can still do their own
 * optimistic updates), but the actual network side — the realtime
 * subscription and the fallback poll — is shared across every instance
 * watching the same match via joinMatchSync (see lib/liveMatchSync.ts),
 * which scopes "one match's subscription" to exactly the screens currently
 * showing that match without needing a React context.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { MatchupEditorPlayer, PairSetting } from '../components/MatchupEditor';
import { recalculateAndSaveMomentBadges } from '../data/badgeMoments';
import { fetchLedgerStrokesForGroup } from '../data/kaki';
import { recalculateAndSaveHandicap } from '../data/handicap';
import { recalculateAndSaveStreaks } from '../data/streaks';
import { fetchMatchLobby, fetchMatchups, upsertMatchup } from '../data/matches';
import type { MatchStatus, MatchupPair, StrokeMode } from '../data/matches';
import { fetchCourseCatalog, getComboHoles } from '../data/courses';
import { buildAllPairs, buildPlayOrder, computeThru, getBackNineNet, getNextRoundNet, pairKey } from '../data/round';
import type { GrossMap, Hole, HoleScoreMap, RoundSchedule, StrokeDeal } from '../data/round';
import { fetchScores, finishMatchAndSettleLedger, saveScore, upsertMatchupBackNine } from '../data/scores';
import type { LedgerDeal } from '../data/scores';
import { useAuth } from '../state/AuthContext';
import { joinMatchSync } from '../lib/liveMatchSync';

export type LiveRoundPlayer = MatchupEditorPlayer & { isHost: boolean };

/** Everything a round's `load()` fetches, as one value — lets the fetch (shared across every screen watching this match, see liveMatchSync.ts) stay separate from applying it to any one screen's own state. */
type RoundData = {
  hostId: string | null;
  matchCode: string;
  matchStatus: MatchStatus;
  finishedAt: string | null;
  holesToPlay: 9 | 18;
  strokesBasis: 9 | 18;
  startHole: number;
  stakePerHole: number;
  roster: LiveRoundPlayer[];
  holes: Hole[];
  scores: HoleScoreMap;
  matchupRows: MatchupPair[];
  pairSettings: PairSetting[];
};

function seedPair(playerAId: string, playerBId: string, existing: MatchupPair | undefined, ledgerNet18: number): PairSetting {
  if (existing) return { playerAId, playerBId, strokes: Math.abs(existing.frontNineStrokes), aGives: existing.frontNineStrokes > 0 };
  return { playerAId, playerBId, strokes: Math.round(Math.abs(ledgerNet18) / 2), aGives: ledgerNet18 > 0 };
}

function pairSettingsToDeals(pairSettings: PairSetting[]): StrokeDeal[] {
  return pairSettings
    .filter((p) => p.strokes > 0)
    .map((p) =>
      p.aGives ? { giver: p.playerAId, receiver: p.playerBId, amount: p.strokes } : { giver: p.playerBId, receiver: p.playerAId, amount: p.strokes },
    );
}

/** Null until every pair in the roster has a persisted back-9 re-strike — see the restrike effect below for who computes it. */
function buildBackNineDeals(rosterIds: string[], matchups: MatchupPair[]): StrokeDeal[] | null {
  const pairs = buildAllPairs(rosterIds);
  const rows = pairs.map(([a, b]) => matchups.find((m) => m.playerAId === a && m.playerBId === b));
  if (rows.some((r) => r?.backNineStrokes == null)) return null;
  const deals: StrokeDeal[] = [];
  rows.forEach((r, i) => {
    const [a, b] = pairs[i]!;
    const v = r!.backNineStrokes!;
    if (v > 0) deals.push({ giver: a, receiver: b, amount: v });
    else if (v < 0) deals.push({ giver: b, receiver: a, amount: -v });
  });
  return deals;
}

export function useLiveRound(matchId: string) {
  const { session } = useAuth();
  const viewerId = session?.user.id ?? null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [matchCode, setMatchCode] = useState('');
  const [matchStatus, setMatchStatus] = useState<MatchStatus>('lobby');
  const [finishedAt, setFinishedAt] = useState<string | null>(null);
  const [holesToPlay, setHolesToPlay] = useState<9 | 18>(18);
  const [strokesBasis, setStrokesBasis] = useState<9 | 18>(9);
  const [startHole, setStartHole] = useState(1);
  const [stakePerHole, setStakePerHole] = useState(0);
  const [roster, setRoster] = useState<LiveRoundPlayer[]>([]);
  const [holes, setHoles] = useState<Hole[]>([]);
  const [scores, setScores] = useState<HoleScoreMap>({});
  const [pairSettings, setPairSettings] = useState<PairSetting[]>([]);
  const [matchupRows, setMatchupRows] = useState<MatchupPair[]>([]);

  const rosterIds = useMemo(() => roster.map((p) => p.playerId), [roster]);
  const schedule: RoundSchedule = useMemo(() => ({ holesToPlay, strokesBasis, startHole }), [holesToPlay, strokesBasis, startHole]);
  const playOrder = useMemo(() => buildPlayOrder(startHole).slice(0, holes.length), [startHole, holes.length]);
  const isHostViewer = hostId !== null && hostId === viewerId;

  const fetchRoundData = useCallback(async (): Promise<RoundData> => {
    const lobby = await fetchMatchLobby(matchId);
    const catalog = await fetchCourseCatalog();
    const course = catalog.find((c) => c.id === lobby.courseId);
    if (!course) throw new Error('Could not find this match’s course.');
    const allHoles = getComboHoles(course, lobby.comboId);
    const nextHoles = lobby.holesToPlay === 9 ? allHoles.slice(0, 9) : allHoles;

    const nextRosterIds = lobby.players.map((p) => p.playerId);
    const [scoreMap, matchups, ledger] = await Promise.all([
      fetchScores(matchId),
      fetchMatchups(matchId),
      fetchLedgerStrokesForGroup(nextRosterIds),
    ]);

    const existingByPair = new Map(matchups.map((m) => [pairKey(m.playerAId, m.playerBId), m]));
    const nextPairSettings = buildAllPairs(nextRosterIds).map(([a, b]) => {
      const key = pairKey(a, b);
      return seedPair(a, b, existingByPair.get(key), ledger[key] ?? 0);
    });

    return {
      hostId: lobby.hostId,
      matchCode: lobby.matchCode,
      matchStatus: lobby.status,
      finishedAt: lobby.finishedAt,
      holesToPlay: lobby.holesToPlay,
      strokesBasis: lobby.strokesBasis,
      startHole: lobby.startHole,
      stakePerHole: lobby.stakePerHole,
      roster: lobby.players.map((p) => ({ playerId: p.playerId, name: p.name, handicap: p.handicap, isHost: p.isHost })),
      holes: nextHoles,
      scores: scoreMap,
      matchupRows: matchups,
      pairSettings: nextPairSettings,
    };
  }, [matchId]);

  const applyRoundData = useCallback((data: RoundData) => {
    setHostId(data.hostId);
    setMatchCode(data.matchCode);
    setMatchStatus(data.matchStatus);
    setFinishedAt(data.finishedAt);
    setHolesToPlay(data.holesToPlay);
    setStrokesBasis(data.strokesBasis);
    setStartHole(data.startHole);
    setStakePerHole(data.stakePerHole);
    setRoster(data.roster);
    setHoles(data.holes);
    setScores(data.scores);
    setMatchupRows(data.matchupRows);
    setPairSettings(data.pairSettings);
  }, []);

  const load = useCallback(async () => {
    applyRoundData(await fetchRoundData());
  }, [fetchRoundData, applyRoundData]);

  // Realtime + fallback poll, shared across every screen currently watching
  // this same match — see liveMatchSync.ts for the mechanics and why.
  //
  // Every live-round screen (Scorecard, Leaderboard, Lobby, Finish, Recap)
  // calls this hook independently, and React Navigation keeps earlier stack
  // screens mounted underneath the current one — so several instances of
  // this hook for the SAME match are routinely alive at once. This used to
  // mean each instance opened its own realtime channel and ran its own 20s
  // poll loop independently (one phone with 3 stack screens open = 3x the
  // connections and 3x the reload traffic for identical data — a meaningful
  // chunk of this project's egress). joinMatchSync collapses every instance
  // down to one channel + one poll timer per match, ref-counted: the first
  // instance to mount creates it, later ones just add a listener and get
  // whatever's already loaded, and it only tears down once the last
  // instance for this match unmounts.
  useEffect(() => {
    return joinMatchSync(
      `round-${matchId}`,
      fetchRoundData,
      [
        { table: 'scores', filter: `match_id=eq.${matchId}` },
        { table: 'game_matchups', filter: `match_id=eq.${matchId}` },
        { table: 'matches', filter: `id=eq.${matchId}` },
      ],
      (data) => {
        applyRoundData(data);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err instanceof Error ? err.message : "Couldn't load this round.");
        setLoading(false);
      },
    );
  }, [matchId, fetchRoundData, applyRoundData]);

  const gross: GrossMap = useMemo(() => {
    const map: GrossMap = {};
    rosterIds.forEach((id) => {
      map[id] = holes.map((h) => scores[id]?.[h.n] ?? h.par);
    });
    return map;
  }, [rosterIds, holes, scores]);

  const thru = useMemo(() => computeThru(rosterIds, scores, playOrder), [rosterIds, scores, playOrder]);

  const frontNineDeals = useMemo(() => pairSettingsToDeals(pairSettings), [pairSettings]);
  const backNineDeals = useMemo(() => buildBackNineDeals(rosterIds, matchupRows), [rosterIds, matchupRows]);

  // The mid-round re-strike (18-hole/9-strokes-basis matches only): once the
  // front 9 is complete (thru >= 9), compute the back-9 deal and persist it
  // for every pair this viewer can legally write (game_matchups RLS: either
  // participant, or the host as admin override).
  //
  // Filling all of a 4+ player roster's pairs usually takes more than one
  // client — each viewer only has write access to their own pairs (or all of
  // them, if host) — so this diffs against what's already persisted and only
  // upserts pairs where the freshly-computed net actually differs, instead of
  // firing once and latching. A one-shot version previously locked in
  // whatever a single racing client happened to compute (sometimes off a
  // stale matchup snapshot) the moment every pair had *some* value, with no
  // way for a later, better-informed client (e.g. the host reopening the
  // Scorecard) to ever correct it. Comparing first also makes this safe to
  // depend on `matchupRows` directly: once every writable pair matches, the
  // diff is empty and the effect no-ops, so it can't loop forever chasing its
  // own `load()`.
  //
  // Deliberately `thru >= 9`, not `=== 9`: this used to only fire in the
  // instant window between everyone finishing hole 9 and everyone finishing
  // hole 10. If no client holding write access to some pair (that pair's own
  // two players, or the host) had the round open in that exact window — e.g.
  // off on the Leaderboard tab, or the app was briefly backgrounded — that
  // pair's back_nine_strokes stayed null forever, and getFlags/dealsAndRankForHole
  // falls back to zero strokes for the WHOLE match (not just that pair) for
  // every hole from 10 on, until every pair resolves (round.ts's
  // dealsAndRankForHole comment). `>= 9` lets any later client passing
  // through — even mid-back-nine — catch and repair a still-missing pair;
  // the diff-and-only-upsert-what-changed check above keeps this idempotent
  // once every writable pair is already correct.
  useEffect(() => {
    if (schedule.holesToPlay !== 18 || schedule.strokesBasis !== 9) return;
    if (thru < 9) return;

    const net = getBackNineNet(rosterIds, gross, frontNineDeals, holes, schedule);
    const rowByPair = new Map(matchupRows.map((m) => [pairKey(m.playerAId, m.playerBId), m]));
    const stalePairs = buildAllPairs(rosterIds)
      .filter(([a, b]) => isHostViewer || a === viewerId || b === viewerId)
      .filter(([a, b]) => rowByPair.get(pairKey(a, b))?.backNineStrokes !== (net[pairKey(a, b)] ?? 0));
    if (stalePairs.length === 0) return;

    Promise.all(stalePairs.map(([a, b]) => upsertMatchupBackNine(matchId, a, b, net[pairKey(a, b)] ?? 0)))
      .then(() => load())
      .catch(() => {});
  }, [schedule, thru, rosterIds, gross, frontNineDeals, holes, matchupRows, isHostViewer, viewerId, matchId, load]);

  function adjustScore(playerId: string, holeIndex: number, delta: number) {
    const hole = holes[holeIndex];
    if (!hole) return;
    const current = scores[playerId]?.[hole.n] ?? hole.par;
    const next = Math.max(1, current + delta);
    setScores((prev) => ({ ...prev, [playerId]: { ...prev[playerId], [hole.n]: next } }));
    saveScore(matchId, playerId, hole.n, next).catch(() => {
      setError("Couldn't save that score — try again.");
      load().catch(() => {});
    });
  }

  function persistPair(pair: PairSetting) {
    const mode: StrokeMode = pair.aGives ? 'give' : 'get';
    upsertMatchup(matchId, pair.playerAId, pair.playerBId, pair.strokes, mode).catch(() => {
      setError("Couldn't save that stroke change — try again.");
      load().catch(() => {});
    });
  }

  function updatePair(a: string, b: string, updater: (p: PairSetting) => PairSetting) {
    setPairSettings((prev) => {
      const current = prev.find((p) => p.playerAId === a && p.playerBId === b);
      if (!current) return prev;
      const updated = updater(current);
      persistPair(updated);
      return prev.map((p) => (p.playerAId === a && p.playerBId === b ? updated : p));
    });
  }

  function adjustPairStrokes(a: string, b: string, delta: number) {
    updatePair(a, b, (p) => ({ ...p, strokes: Math.max(0, p.strokes + delta) }));
  }

  function setPairAGives(a: string, b: string, aGivesNext: boolean) {
    updatePair(a, b, (p) => ({ ...p, aGives: aGivesNext }));
  }

  /**
   * Finishes the round: computes every pairwise carry-forward deal in the
   * roster (not just the host's own pairs) and settles them into the kaki
   * ledger together with the status flip, in one atomic RPC — see
   * finishMatchAndSettleLedger/finish_match's migration comment. Recap no
   * longer writes the ledger at all, so reopening any match's recap, old or
   * new, can never drag a pair's ledger backwards in time.
   */
  async function finishRound() {
    if (!isHostViewer) return;
    const net = getNextRoundNet(rosterIds, gross, frontNineDeals, holes, schedule, backNineDeals);
    const deals: LedgerDeal[] = buildAllPairs(rosterIds).map(([a, b]) => ({
      playerAId: a,
      playerBId: b,
      netStrokesPer9: net[pairKey(a, b)] ?? 0,
    }));
    const finishedAtIso = await finishMatchAndSettleLedger(matchId, deals);
    setFinishedAt(finishedAtIso);
    if (viewerId) await recalculateAndSaveHandicap(viewerId, matchId).catch(() => {});
    if (viewerId) await recalculateAndSaveStreaks(viewerId).catch(() => {});
    if (viewerId) await recalculateAndSaveMomentBadges(viewerId, matchId).catch(() => {});
    setMatchStatus('finished');
  }

  // Recomputes the viewer's own handicap/streaks/badges the moment their
  // client notices this match finished — from whichever of the 5 live-round
  // screens they currently have open, not just Recap. Each of these recalc
  // functions only ever runs for "the viewer, right now" (RLS lets a player
  // write only their own handicap/streak/badge rows, never a host writing on
  // someone else's behalf — see 20260714120000_moment_badges.sql's RLS policy
  // comment), so a non-host player who finishes a round and backs out from
  // Finish or Scorecard straight to Home, without ever opening the full
  // Recap screen, previously had their own stats for that match silently
  // never computed. RecapScreen's own mount effect does the same thing; both
  // are safe to run for the same match (each recalc function is documented
  // idempotent).
  const ownStatsSynced = useRef(false);
  useEffect(() => {
    if (matchStatus !== 'finished' || !viewerId) return;
    if (ownStatsSynced.current) return;
    ownStatsSynced.current = true;
    Promise.all([recalculateAndSaveHandicap(viewerId, matchId), recalculateAndSaveStreaks(viewerId), recalculateAndSaveMomentBadges(viewerId, matchId)]).catch(
      () => {
        ownStatsSynced.current = false;
      },
    );
  }, [matchStatus, viewerId, matchId]);

  function refresh() {
    load().catch((err) => setError(err instanceof Error ? err.message : "Couldn't refresh this round."));
  }

  return {
    loading,
    error,
    viewerId,
    hostId,
    isHostViewer,
    matchCode,
    matchStatus,
    finishedAt,
    roster,
    holes,
    holesToPlay,
    schedule,
    playOrder,
    gross,
    scores,
    thru,
    frontNineDeals,
    backNineDeals,
    pairSettings,
    stakePerHole,
    refresh,
    adjustScore,
    adjustPairStrokes,
    setPairAGives,
    finishRound,
  };
}
