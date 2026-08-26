/**
 * Live data for tournament scoring (S7) — modeled on useLiveRound.ts but
 * trimmed to what stroke play actually needs: no pairSettings/matchupRows,
 * no back-9 restrike effect, no ledger settlement. A tournament round's
 * "deal" is just each player's own playingHandicap against the course's
 * stroke index (see data/strokePlay.ts), not a pairwise StrokeDeal.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { recalculateAndSaveMomentBadges } from '../data/badgeMoments';
import { fetchCourseCatalog, getComboHoles } from '../data/courses';
import type { ComboHole } from '../data/courses';
import { recalculateAndSaveHandicap } from '../data/handicap';
import { buildPlayOrder, computeThru } from '../data/round';
import type { GrossMap, HoleScoreMap } from '../data/round';
import { fetchScores, saveScore } from '../data/scores';
import type { SkinsConfig } from '../data/skins';
import { recalculateAndSaveStreaks } from '../data/streaks';
import type { TournamentLobbyPlayer, TournamentScoringFormat, TournamentStandingsBasis, TournamentTieBreakRule } from '../data/tournaments';
import { fetchTournamentLobby } from '../data/tournaments';
import type { MatchStatus } from '../data/matches';
import { useAuth } from '../state/AuthContext';
import { supabase } from '../lib/supabase';

export type TournamentRoundPlayer = TournamentLobbyPlayer;

export function useTournamentRound(tournamentId: string, matchId: string) {
  const { session } = useAuth();
  const viewerId = session?.user.id ?? null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchName, setMatchName] = useState('');
  const [handicapAllowancePct, setHandicapAllowancePct] = useState(100);
  const [standingsBasis, setStandingsBasis] = useState<TournamentStandingsBasis>('nett');
  const [scoringFormat, setScoringFormat] = useState<TournamentScoringFormat>('stroke_play');
  const [tieBreakRule, setTieBreakRule] = useState<TournamentTieBreakRule>('countback');
  const [matchStatus, setMatchStatus] = useState<MatchStatus>('lobby');
  const [hostId, setHostId] = useState<string | null>(null);
  const [startHole, setStartHole] = useState(1);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [roster, setRoster] = useState<TournamentRoundPlayer[]>([]);
  const [holes, setHoles] = useState<ComboHole[]>([]);
  const [scores, setScores] = useState<HoleScoreMap>({});
  const [sideGames, setSideGames] = useState<SkinsConfig[]>([]);

  const rosterIds = useMemo(() => roster.map((p) => p.id), [roster]);
  const playOrder = useMemo(() => buildPlayOrder(startHole).slice(0, holes.length), [startHole, holes.length]);
  const isHostViewer = hostId !== null && hostId === viewerId;

  const load = useCallback(async () => {
    const lobby = await fetchTournamentLobby(tournamentId);
    const catalog = await fetchCourseCatalog();
    const course = catalog.find((c) => c.id === lobby.courseId);
    if (!course) throw new Error('Could not find this round’s course.');
    const comboHoles = getComboHoles(course, lobby.comboId);

    const scoreMap = await fetchScores(matchId);

    setMatchName(lobby.name);
    setHandicapAllowancePct(lobby.handicapAllowancePct);
    setStandingsBasis(lobby.standingsBasis);
    setScoringFormat(lobby.scoringFormat);
    setTieBreakRule(lobby.tieBreakRule);
    setMatchStatus(lobby.matchStatus);
    setHostId(lobby.hostId);
    setStartHole(lobby.startHole);
    setCourseId(lobby.courseId);
    // Invited-but-not-yet-joined players never score — computeThru requires
    // every roster id to have a hole entry, so counting them would stall
    // `thru` at 0 forever.
    setRoster(lobby.players.filter((p) => p.status === 'joined'));
    setHoles(comboHoles);
    setScores(scoreMap);
    setSideGames(lobby.sideGames);
  }, [tournamentId, matchId]);

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load this round."))
      .finally(() => setLoading(false));
  }, [load]);

  // Realtime: another player's score entry or the round's own status change
  // should show up without a manual refresh — same proven pattern as
  // useLiveRound (per-mount channel suffix so two screens showing this same
  // round at once don't collide on one shared topic name).
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
      .channel(`tournament-round-${matchId}-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: `match_id=eq.${matchId}` }, scheduleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, scheduleSync)
      .subscribe();

    // postgres_changes isn't guaranteed delivery — bounds how long any client
    // can stay out of sync without noticing (same fallback useLiveRound uses).
    // 20s, not 6s — see useLiveRound's identical change for why.
    const pollTimer = setInterval(() => {
      load().catch(() => {});
    }, 20000);

    return () => {
      if (syncTimer) clearTimeout(syncTimer);
      clearInterval(pollTimer);
      supabase.removeChannel(channel);
    };
  }, [matchId, channelId, load]);

  const gross: GrossMap = useMemo(() => {
    const map: GrossMap = {};
    rosterIds.forEach((id) => {
      map[id] = holes.map((h) => scores[id]?.[h.n] ?? h.par);
    });
    return map;
  }, [rosterIds, holes, scores]);

  const thru = useMemo(() => computeThru(rosterIds, scores, playOrder), [rosterIds, scores, playOrder]);

  /** Own row (self) or host — mirrors the `scores` table's own RLS (own player_id or host). */
  function canEditPlayer(playerId: string): boolean {
    return playerId === viewerId || isHostViewer;
  }

  function adjustScore(playerId: string, holeIndex: number, delta: number) {
    const hole = holes[holeIndex];
    if (!hole || !canEditPlayer(playerId)) return;
    const current = scores[playerId]?.[hole.n] ?? hole.par;
    const next = Math.max(1, current + delta);
    setScores((prev) => ({ ...prev, [playerId]: { ...prev[playerId], [hole.n]: next } }));
    saveScore(matchId, playerId, hole.n, next).catch(() => {
      setError("Couldn't save that score — try again.");
      load().catch(() => {});
    });
  }

  function setScore(playerId: string, holeIndex: number, value: number) {
    const hole = holes[holeIndex];
    if (!hole || !canEditPlayer(playerId)) return;
    setScores((prev) => ({ ...prev, [playerId]: { ...prev[playerId], [hole.n]: value } }));
    saveScore(matchId, playerId, hole.n, value).catch(() => {
      setError("Couldn't save that score — try again.");
      load().catch(() => {});
    });
  }

  function refresh() {
    load().catch((err) => setError(err instanceof Error ? err.message : "Couldn't refresh this round."));
  }

  // Recomputes the viewer's own handicap/streaks/badges the moment their
  // client notices this round finished — from whichever of the 5 tournament
  // screens they currently have open, not just S10. Mirrors useLiveRound's
  // own identical effect; see that file's comment for why every recalc
  // function is safe to fire from more than one screen (each is
  // self-scoped-to-the-viewer and documented idempotent).
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

  return {
    loading,
    error,
    viewerId,
    hostId,
    isHostViewer,
    matchName,
    courseId,
    handicapAllowancePct,
    standingsBasis,
    scoringFormat,
    tieBreakRule,
    matchStatus,
    roster,
    holes,
    playOrder,
    scores,
    gross,
    thru,
    sideGames,
    canEditPlayer,
    adjustScore,
    setScore,
    refresh,
  };
}
