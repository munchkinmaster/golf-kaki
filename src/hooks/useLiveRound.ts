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
import {
  buildAllPairs,
  buildPlayOrder,
  computeThru,
  getBackNineNet,
  getNextRoundNet,
  hasCompleteFrontNine,
  missingFrontNineHoles,
  pairKey,
} from '../data/round';
import type { GrossMap, Hole, HoleScoreMap, RoundSchedule, StrokeDeal } from '../data/round';
import { fetchScores, finishMatchAndSettleLedger, saveScore, upsertMatchupBackNine } from '../data/scores';
import type { LedgerDeal } from '../data/scores';
import { useAuth } from '../state/AuthContext';
import { joinMatchSync, refreshMatchSync } from '../lib/liveMatchSync';

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

/**
 * Every pair's back-9 deal: the persisted re-strike where it has landed, and
 * the identical arithmetic run locally where it hasn't yet.
 *
 * The local fallback matters because persistence is not a precondition for
 * knowing the answer — `getBackNineNet` is pure, every client feeds it the
 * same front-9 scores and the same front-9 deals, so they all derive the same
 * number the moment the cards allow it. Reading only `game_matchups` (as this
 * used to) meant the whole match played the back 9 at scratch during any
 * window where the value was computable but nobody with write access to some
 * pair had happened to be on a live-round screen to persist it — and because
 * this returns null unless EVERY pair resolves, one such pair blacked out the
 * strokes for all of them. The re-strike effect below still writes the value
 * through; that's now a background catch-up for the read paths that have no
 * scores to derive from (data/rounds.ts, data/kaki.ts) rather than the thing
 * the live round waits on.
 *
 * Still null while `allFrontNinesComplete` is false: a pair whose two cards
 * aren't both finished has no derivable deal, and no honest value to show.
 * That state is surfaced, not papered over — see BackNineStrokesPendingNotice.
 */
function buildBackNineDeals(
  rosterIds: string[],
  matchups: MatchupPair[],
  derivedNet: Record<string, number>,
  allFrontNinesComplete: boolean,
): StrokeDeal[] | null {
  if (!allFrontNinesComplete) return null;
  const deals: StrokeDeal[] = [];
  buildAllPairs(rosterIds).forEach(([a, b]) => {
    const key = pairKey(a, b);
    const row = matchups.find((m) => m.playerAId === a && m.playerBId === b);
    const v = row?.backNineStrokes ?? derivedNet[key] ?? 0;
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

  // Cells/pairs this specific screen instance has locally edited and not yet
  // seen echoed back — see applyRoundData below for why these exist and are
  // never cleared. Refs (not state): they gate a merge inside a setter, not
  // something a render needs to react to.
  const touchedScoresRef = useRef<Set<string>>(new Set());
  const touchedPairsRef = useRef<Set<string>>(new Set());

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

  // `data` here comes from the shared fetch in liveMatchSync.ts's registry,
  // not necessarily from something this instance itself requested — every
  // screen watching this match (Scorecard, Leaderboard, InGameLobby, ...)
  // gets the SAME broadcast applied to its OWN local state. A fetch that
  // races ahead of (or merely predates) this instance's own still-in-flight
  // `saveScore`/`persistPair` write reads the pre-write value, and applying
  // it unconditionally rolls the local optimistic update backward — visibly,
  // a score or stroke deal this screen already showed reverts and has to be
  // re-entered. Confirmed 2026-09: switching to the Leaderboard tab near the
  // turn (mounting a second instance, which pulls in whatever the shared
  // cache last held) reset every pair's strokes to 0 and cleared hole 8/9
  // scores this way. For any cell this instance has itself locally edited,
  // keep that local value instead of the incoming one — it only stops
  // reflecting the fetch once a later write from elsewhere touches that same
  // cell again, which arrives as its own fresh broadcast.
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
    setScores((prev) => {
      if (touchedScoresRef.current.size === 0) return data.scores;
      const merged: HoleScoreMap = {};
      new Set([...Object.keys(prev), ...Object.keys(data.scores)]).forEach((playerId) => {
        const playerHoles = { ...data.scores[playerId] };
        Object.keys(prev[playerId] ?? {}).forEach((holeStr) => {
          const holeN = Number(holeStr);
          if (touchedScoresRef.current.has(`${playerId}:${holeN}`)) playerHoles[holeN] = prev[playerId]![holeN];
        });
        merged[playerId] = playerHoles;
      });
      return merged;
    });
    setMatchupRows(data.matchupRows);
    setPairSettings((prev) => {
      if (touchedPairsRef.current.size === 0) return data.pairSettings;
      return data.pairSettings.map((p) => {
        const key = pairKey(p.playerAId, p.playerBId);
        if (!touchedPairsRef.current.has(key)) return p;
        return prev.find((pp) => pp.playerAId === p.playerAId && pp.playerBId === p.playerBId) ?? p;
      });
    });
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

  // Who can have their deals re-struck at all yet. Per player, not the group's
  // `thru` — see hasCompleteFrontNine for why that distinction is the whole
  // bug. `blockedBy` drives the Scorecard's pending notice, so the people
  // holding the back 9 up are named instead of the strokes just vanishing.
  const frontNineComplete = useMemo(
    () => new Set(rosterIds.filter((id) => hasCompleteFrontNine(id, scores, schedule))),
    [rosterIds, scores, schedule],
  );
  const blockedBy = useMemo(
    () =>
      roster
        .filter((p) => !frontNineComplete.has(p.playerId))
        .map((p) => ({ playerId: p.playerId, name: p.name, holes: missingFrontNineHoles(p.playerId, scores, schedule) })),
    [roster, frontNineComplete, scores, schedule],
  );

  const backNineNet = useMemo(
    () => getBackNineNet(rosterIds, gross, frontNineDeals, holes, schedule),
    [rosterIds, gross, frontNineDeals, holes, schedule],
  );
  const backNineDeals = useMemo(
    () => buildBackNineDeals(rosterIds, matchupRows, backNineNet, blockedBy.length === 0),
    [rosterIds, matchupRows, backNineNet, blockedBy.length],
  );

  // The mid-round re-strike (18-hole/9-strokes-basis matches only): once a
  // pair's two players have both finished their front 9, compute that pair's
  // back-9 deal and persist it — for every pair this viewer can legally write
  // (game_matchups RLS: either participant, or the host as admin override).
  //
  // Note this is now a catch-up write, not the thing the live round waits on:
  // buildBackNineDeals derives the same value locally for display the moment
  // the cards allow it. Persisting still matters for the read paths that have
  // no scores to derive from — data/rounds.ts's history rows and
  // data/kaki.ts's ledger preview — and for the finish settle.
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
  // The gate is per pair, not the group-wide `thru`. It used to be
  // `thru >= 9` — "nobody's deal re-strikes until the slowest card in the
  // match has finished its front 9" — which is far stronger than the
  // arithmetic actually needs: restrikeNet reads a pair's own two cards and
  // nothing else. In the 2026-09-26 round that cost the whole match its back
  // 9: three players, one entering scores two holes at a time, so his hole 9
  // landed only at the end of hole 10. `thru` sat at 8 through the turn, this
  // effect returned early, no pair was ever written, and buildBackNineDeals'
  // null-unless-every-pair-resolves rule put every pairing — including the
  // two that player wasn't in, whose cards were both complete at the 9th —
  // on zero strokes for holes 10 and 11. Gating each pair on its own two
  // players lets those deals re-strike on time regardless of a third card.
  //
  // Still `>= 9` in spirit rather than `=== 9`: there's no instant-window
  // requirement here at all. A client passing through later — even
  // mid-back-nine — re-evaluates and repairs any pair it can write, and the
  // diff-and-only-upsert-what-changed check above keeps that idempotent.
  useEffect(() => {
    if (schedule.holesToPlay !== 18 || schedule.strokesBasis !== 9) return;

    const net = backNineNet;
    const rowByPair = new Map(matchupRows.map((m) => [pairKey(m.playerAId, m.playerBId), m]));
    const stalePairs = buildAllPairs(rosterIds)
      // Both cards complete — otherwise this pair's entry in `net` was read
      // off holes `gross` filled in with par (see that memo), which is a
      // guess, and persisting a guess is how it stops being correctable.
      .filter(([a, b]) => frontNineComplete.has(a) && frontNineComplete.has(b))
      .filter(([a, b]) => isHostViewer || a === viewerId || b === viewerId)
      .filter(([a, b]) => rowByPair.get(pairKey(a, b))?.backNineStrokes !== (net[pairKey(a, b)] ?? 0));
    if (stalePairs.length === 0) return;

    // refreshMatchSync, not the local `load()` bypass: `load()` only updates
    // THIS instance's own state, leaving liveMatchSync's shared cache (what
    // every OTHER screen watching this match, current or not-yet-mounted,
    // reads on join) holding the pre-restrike snapshot until the next
    // realtime-triggered or polled fetch happens to land. A screen mounted
    // in that gap — e.g. switching to Leaderboard right after the turn —
    // picks up that stale cache. Less load-bearing than it was now that
    // buildBackNineDeals derives the deal locally rather than waiting on this
    // write, but still the difference between every screen agreeing at once
    // and them agreeing at the next incidental fetch.
    Promise.all(stalePairs.map(([a, b]) => upsertMatchupBackNine(matchId, a, b, net[pairKey(a, b)] ?? 0)))
      .then(() => refreshMatchSync(`round-${matchId}`))
      .catch(() => {});
  }, [schedule, frontNineComplete, rosterIds, backNineNet, matchupRows, isHostViewer, viewerId, matchId]);

  function adjustScore(playerId: string, holeIndex: number, delta: number) {
    // Mirrors scores' own RLS (20260827140000_lock_scores_after_finish.sql)
    // — this hook had no editability guard at all before (ScorecardScreen's
    // own canEdit() only ever checked host/self, never match status), so a
    // player who lingered on the Scorecard after the host finished the round
    // could keep tapping the stepper. The write would now just fail
    // server-side; short-circuiting here avoids the optimistic local update
    // flashing a "saved" score that never actually persists.
    if (matchStatus === 'finished') return;
    const hole = holes[holeIndex];
    if (!hole) return;
    const current = scores[playerId]?.[hole.n] ?? hole.par;
    const next = Math.max(1, current + delta);
    touchedScoresRef.current.add(`${playerId}:${hole.n}`);
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
    touchedPairsRef.current.add(pairKey(a, b));
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
    /** Players whose front 9 isn't fully entered yet, with the holes they're missing — why `backNineDeals` is still null, in a form the UI can name. */
    blockedBy,
    pairSettings,
    stakePerHole,
    refresh,
    adjustScore,
    adjustPairStrokes,
    setPairAGives,
    finishRound,
  };
}
