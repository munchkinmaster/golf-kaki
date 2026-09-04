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
import { joinMatchSync } from '../lib/liveMatchSync';

export type TournamentRoundPlayer = TournamentLobbyPlayer;

/** Everything a round's `load()` fetches, as one value — lets the fetch (shared across every screen watching this match, see liveMatchSync.ts) stay separate from applying it to any one screen's own state. */
type TournamentRoundData = {
  matchName: string;
  handicapAllowancePct: number;
  standingsBasis: TournamentStandingsBasis;
  scoringFormat: TournamentScoringFormat;
  tieBreakRule: TournamentTieBreakRule;
  matchStatus: MatchStatus;
  hostId: string | null;
  startHole: number;
  courseId: string | null;
  roster: TournamentRoundPlayer[];
  holes: ComboHole[];
  scores: HoleScoreMap;
  sideGames: SkinsConfig[];
};

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

  const fetchRoundData = useCallback(async (): Promise<TournamentRoundData> => {
    const lobby = await fetchTournamentLobby(tournamentId);
    const catalog = await fetchCourseCatalog();
    const course = catalog.find((c) => c.id === lobby.courseId);
    if (!course) throw new Error('Could not find this round’s course.');
    const comboHoles = getComboHoles(course, lobby.comboId);

    const scoreMap = await fetchScores(matchId);

    return {
      matchName: lobby.name,
      handicapAllowancePct: lobby.handicapAllowancePct,
      standingsBasis: lobby.standingsBasis,
      scoringFormat: lobby.scoringFormat,
      tieBreakRule: lobby.tieBreakRule,
      matchStatus: lobby.matchStatus,
      hostId: lobby.hostId,
      startHole: lobby.startHole,
      courseId: lobby.courseId,
      // Invited-but-not-yet-joined players never score — computeThru requires
      // every roster id to have a hole entry, so counting them would stall
      // `thru` at 0 forever.
      roster: lobby.players.filter((p) => p.status === 'joined'),
      holes: comboHoles,
      scores: scoreMap,
      sideGames: lobby.sideGames,
    };
  }, [tournamentId, matchId]);

  const applyRoundData = useCallback((data: TournamentRoundData) => {
    setMatchName(data.matchName);
    setHandicapAllowancePct(data.handicapAllowancePct);
    setStandingsBasis(data.standingsBasis);
    setScoringFormat(data.scoringFormat);
    setTieBreakRule(data.tieBreakRule);
    setMatchStatus(data.matchStatus);
    setHostId(data.hostId);
    setStartHole(data.startHole);
    setCourseId(data.courseId);
    setRoster(data.roster);
    setHoles(data.holes);
    setScores(data.scores);
    setSideGames(data.sideGames);
  }, []);

  const load = useCallback(async () => {
    applyRoundData(await fetchRoundData());
  }, [fetchRoundData, applyRoundData]);

  // Realtime + fallback poll, shared across every screen currently watching
  // this same round — same proven pattern as useLiveRound (see
  // liveMatchSync.ts): every one of the 5 tournament screens calls this hook
  // independently, and React Navigation keeps earlier stack screens mounted
  // underneath the current one, so joinMatchSync collapses what used to be
  // one realtime channel + one 20s poll loop *per mounted screen* down to
  // one of each per round, shared and ref-counted across all of them.
  useEffect(() => {
    return joinMatchSync(
      `tournament-round-${matchId}`,
      fetchRoundData,
      [
        { table: 'scores', filter: `match_id=eq.${matchId}` },
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

  /**
   * Own row (self) or host, AND the round isn't finished yet — mirrors the
   * `scores` table's own RLS (20260827140000_lock_scores_after_finish.sql
   * added the finished-match clause there; this keeps the UI in sync with
   * what the server will actually accept, rather than showing a live-looking
   * stepper that silently no-ops or errors on tap).
   */
  function canEditPlayer(playerId: string): boolean {
    return (playerId === viewerId || isHostViewer) && matchStatus !== 'finished';
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
