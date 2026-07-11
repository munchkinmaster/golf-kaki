/**
 * The one live-round data source, called independently by each of the 5
 * live-round screens (Scorecard, Leaderboard, InGameLobby, Finish, Recap)
 * with their own `route.params.matchId` — mirrors MatchLobbyScreen's own
 * fetch-in-screen + realtime-channel pattern rather than a shared global
 * context, since a global context can't cleanly scope "one match's realtime
 * subscription" to just the screens currently showing that match.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { MatchupEditorPlayer, PairSetting } from '../components/MatchupEditor';
import { recalculateAndSaveMomentBadges } from '../data/badgeMoments';
import { fetchLedgerStrokesForGroup, updateLedgerStrokes } from '../data/kaki';
import { recalculateAndSaveHandicap } from '../data/handicap';
import { recalculateAndSaveStreaks } from '../data/streaks';
import { fetchMatchLobby, fetchMatchups, upsertMatchup } from '../data/matches';
import type { MatchStatus, MatchupPair, StrokeMode } from '../data/matches';
import { fetchCourseCatalog, getComboHoles } from '../data/courses';
import { buildAllPairs, computeThru, getBackNineNet, getNextRoundNet, pairKey } from '../data/round';
import type { GrossMap, Hole, HoleScoreMap, RoundSchedule, StrokeDeal } from '../data/round';
import { fetchScores, finishMatch, saveScore, upsertMatchupBackNine } from '../data/scores';
import { useAuth } from '../state/AuthContext';
import { supabase } from '../lib/supabase';

export type LiveRoundPlayer = MatchupEditorPlayer & { isHost: boolean };

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
  const [stakePerHole, setStakePerHole] = useState(0);
  const [roster, setRoster] = useState<LiveRoundPlayer[]>([]);
  const [holes, setHoles] = useState<Hole[]>([]);
  const [scores, setScores] = useState<HoleScoreMap>({});
  const [pairSettings, setPairSettings] = useState<PairSetting[]>([]);
  const [matchupRows, setMatchupRows] = useState<MatchupPair[]>([]);

  const rosterIds = useMemo(() => roster.map((p) => p.playerId), [roster]);
  const schedule: RoundSchedule = useMemo(() => ({ holesToPlay, strokesBasis }), [holesToPlay, strokesBasis]);
  const isHostViewer = hostId !== null && hostId === viewerId;

  const load = useCallback(async () => {
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

    setHostId(lobby.hostId);
    setMatchCode(lobby.matchCode);
    setMatchStatus(lobby.status);
    setFinishedAt(lobby.finishedAt);
    setHolesToPlay(lobby.holesToPlay);
    setStrokesBasis(lobby.strokesBasis);
    setStakePerHole(lobby.stakePerHole);
    setRoster(lobby.players.map((p) => ({ playerId: p.playerId, name: p.name, handicap: p.handicap, isHost: p.isHost })));
    setHoles(nextHoles);
    setScores(scoreMap);
    setMatchupRows(matchups);
    setPairSettings(nextPairSettings);
  }, [matchId]);

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load this round."))
      .finally(() => setLoading(false));
  }, [load]);

  // Realtime: another player's score entry, stroke edit, or the host finishing
  // the round should show up without a manual refresh, mirroring
  // MatchLobbyScreen's own debounced postgres_changes subscription.
  //
  // Every live-round screen (Scorecard, Leaderboard, Lobby, Finish, Recap)
  // calls this hook independently, and React Navigation keeps earlier stack
  // screens mounted underneath the current one — so two instances of this
  // hook for the SAME match are routinely alive at once. Supabase reuses the
  // channel object for an identical topic name, so a shared `round-${matchId}`
  // topic meant the second mount's `.on(...)` calls landed on a channel the
  // first mount had already subscribed, which throws. A per-mount suffix
  // keeps every instance's channel independent.
  const channelId = useRef(Math.random().toString(36).slice(2)).current;
  useEffect(() => {
    let syncTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleSync = () => {
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        load().catch(() => {});
      }, 250);
    };

    const channel = supabase
      .channel(`round-${matchId}-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: `match_id=eq.${matchId}` }, scheduleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_matchups', filter: `match_id=eq.${matchId}` }, scheduleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, scheduleSync)
      .subscribe();

    // postgres_changes isn't guaranteed delivery — a backgrounded tab or a
    // brief websocket drop can silently miss an event (seen in practice: a
    // client's mid-round back-9 re-strike value went stale and never
    // recovered). This bounds how long any client can stay out of sync
    // without the viewer having to notice and tap manual refresh themselves.
    const pollTimer = setInterval(() => {
      load().catch(() => {});
    }, 6000);

    return () => {
      if (syncTimer) clearTimeout(syncTimer);
      clearInterval(pollTimer);
      supabase.removeChannel(channel);
    };
  }, [matchId, load]);

  const gross: GrossMap = useMemo(() => {
    const map: GrossMap = {};
    rosterIds.forEach((id) => {
      map[id] = holes.map((h) => scores[id]?.[h.n] ?? h.par);
    });
    return map;
  }, [rosterIds, holes, scores]);

  const thru = useMemo(() => computeThru(rosterIds, scores, holes.length), [rosterIds, scores, holes.length]);

  const frontNineDeals = useMemo(() => pairSettingsToDeals(pairSettings), [pairSettings]);
  const backNineDeals = useMemo(() => buildBackNineDeals(rosterIds, matchupRows), [rosterIds, matchupRows]);

  // The mid-round re-strike (18-hole/9-strokes-basis matches only): right at
  // the turn (thru === 9, before anyone's back-9 card has a single hole on
  // it), compute the back-9 deal and persist it for every pair this viewer
  // can legally write (game_matchups RLS: either participant, or the host as
  // admin override).
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
  useEffect(() => {
    if (schedule.holesToPlay !== 18 || schedule.strokesBasis !== 9) return;
    if (thru !== 9) return;

    const net = getBackNineNet(rosterIds, gross, frontNineDeals, holes);
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
   * Writes this viewer's own pairs' carry-forward deal into the kaki ledger —
   * scoped to pairs containing the viewer, since kaki_relationships' UPDATE
   * RLS only allows a participant to touch their own pair (never the host
   * writing on someone else's behalf). Safe to call repeatedly (plain
   * UPDATE, same idempotent value each time) — called once from FinishScreen
   * and again from RecapScreen's mount, so a non-host player's own pairs
   * update even if they never open Finish.
   */
  async function syncLedger() {
    if (!viewerId) return;
    const net = getNextRoundNet(rosterIds, gross, frontNineDeals, holes, schedule, backNineDeals);
    const ownPairs = buildAllPairs(rosterIds).filter(([a, b]) => a === viewerId || b === viewerId);
    await Promise.all(ownPairs.map(([a, b]) => updateLedgerStrokes(a, b, net[pairKey(a, b)] ?? 0)));
  }

  async function finishRound() {
    if (!isHostViewer) return;
    await finishMatch(matchId);
    await syncLedger();
    if (viewerId) await recalculateAndSaveHandicap(viewerId, matchId).catch(() => {});
    if (viewerId) await recalculateAndSaveStreaks(viewerId).catch(() => {});
    if (viewerId) await recalculateAndSaveMomentBadges(viewerId, matchId).catch(() => {});
    setMatchStatus('finished');
  }

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
    syncLedger,
  };
}
