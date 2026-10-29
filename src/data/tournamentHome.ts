/**
 * The viewer's in-progress multi-round tournaments, shaped for the Home
 * tournament card (design_handoff_multi_round MR12) and the tournament
 * notices in Notifications. A plain fetch — callers refresh on focus, like
 * the rest of Home.
 *
 * Notices follow the app's existing model (see useNotificationCount): no
 * read/unread state, an item simply stops showing once it's been acted on —
 * "Round 2 is set up" until the round starts, "Round 2 has started" until the
 * viewer enters their first score in it. Neither goes to the organiser, who
 * caused both.
 */

import { fetchCourseCatalog } from './courses';
import { computeAggregateStandings, homeCardAction, ordinal, pickCurrentRound } from './multiRound';
import type { HomeCardAction, TournamentPhase } from './multiRound';
import { formatRoundDate, localDateString } from './roundDates';
import { teePresentation } from './tees';
import { fetchTournamentResults } from './tournamentResults';
import type { TournamentRound } from './tournaments';
import { fetchTournamentLobby } from './tournaments';
import { withRetry } from '../lib/retry';
import { supabase } from '../lib/supabase';

export type TournamentNotice = {
  key: string;
  kind: 'roundSetUp' | 'roundStarted';
  tournamentId: string;
  matchId: string;
  title: string;
  body: string;
};

export type ActiveTournament = {
  tournamentId: string;
  name: string;
  isOrganiser: boolean;
  hostFirstName: string;
  phase: Exclude<TournamentPhase, 'complete'>;
  round: TournamentRound;
  roundsCount: number;
  /** "Tanah Merah CC · Blue tee", "Sentosa GC · planned", or "Course on the day". */
  courseLine: string;
  /** Overline — "LIVE · ROUND 2 OF 3", "TODAY · ROUND 2 OF 3", "NEXT · ROUND 2 OF 3". */
  overline: string;
  /** Chip — "Thru 4" while live, else the round's date ("Today" / "Sat 25 Jul"). */
  chip: string;
  overall: { toPar: number; place: string } | null;
  action: HomeCardAction;
  /** One state per round for the progress bar. */
  timeline: ('done' | 'live' | 'current' | 'upcoming')[];
  /** Where Lobby / Join scoring / View leaderboard go: the current round's match, else the last one played. */
  matchId: string;
  notice: TournamentNotice | null;
};

/** Every tournament the viewer is seated in that has more than one round. */
async function fetchViewerMultiRoundTournaments(viewerId: string): Promise<{ id: string; name: string; host_id: string }[]> {
  return withRetry(async () => {
    const { data: seats, error: seatsError } = await supabase.from('match_players').select('match_id').eq('player_id', viewerId).eq('status', 'joined');
    if (seatsError) throw seatsError;
    const matchIds = (seats as { match_id: string }[]).map((s) => s.match_id);
    if (matchIds.length === 0) return [];

    const { data: matches, error: matchesError } = await supabase.from('matches').select('tournament_id').in('id', matchIds).not('tournament_id', 'is', null);
    if (matchesError) throw matchesError;
    const tournamentIds = [...new Set((matches as { tournament_id: string }[]).map((m) => m.tournament_id))];
    if (tournamentIds.length === 0) return [];

    const { data: tournaments, error: tError } = await supabase.from('tournaments').select('id, name, host_id').in('id', tournamentIds).gt('rounds_count', 1);
    if (tError) throw tError;
    return tournaments as { id: string; name: string; host_id: string }[];
  });
}

const PHASE_RANK: Record<Exclude<TournamentPhase, 'complete'>, number> = { live: 0, setup: 1, between: 2 };

/** In-progress multi-round tournaments, most urgent first (live, then set up, then waiting on a round to be set up; earliest date breaks ties). */
export async function fetchActiveTournaments(viewerId: string): Promise<ActiveTournament[]> {
  const [tournaments, catalog] = await Promise.all([fetchViewerMultiRoundTournaments(viewerId), fetchCourseCatalog()]);
  const today = localDateString();

  const built = await Promise.all(
    tournaments.map(async (t): Promise<ActiveTournament | null> => {
      const results = await fetchTournamentResults(t.id);
      const picked = pickCurrentRound(results.rounds);
      if (!picked || picked.phase === 'complete') return null;
      const { phase, current: round, previous } = picked;
      const rosterIds = results.roster.filter((p) => p.status === 'joined').map((p) => p.id);
      if (!rosterIds.includes(viewerId)) return null;

      const lobby = round.matchId ? await fetchTournamentLobby(t.id, round.matchId) : null;
      const seat = lobby?.players.find((p) => p.id === viewerId && p.status === 'joined');
      const isOrganiser = t.host_id === viewerId;

      const courseId = round.courseId ?? round.plannedCourseId;
      const course = catalog.find((c) => c.id === courseId);
      const courseLine = !course
        ? 'Course on the day'
        : round.courseId
          ? [course.name, seat ? `${teePresentation(course.id, seat.teeColor).label} tee` : null].filter(Boolean).join(' · ')
          : `${course.name} · planned`;

      const roundOf = `Round ${round.index} of ${results.rounds.length}`;
      const isToday = round.date === today;
      const overline = phase === 'live' ? `Live · ${roundOf}` : isToday ? `Today · ${roundOf}` : round.index === 1 ? roundOf : `Next · ${roundOf}`;
      const chip = phase === 'live' ? `Thru ${lobby?.thru ?? round.thru}` : isToday ? 'Today' : formatRoundDate(round.date);

      const rows = computeAggregateStandings(rosterIds, results.rounds, results.entries, results.tieBreakRule);
      const me = rows.find((r) => r.playerId === viewerId);
      const anyCounted = results.rounds.some((r) => r.status === 'done' || r.status === 'live');
      const overall = anyCounted && me && me.rank !== null ? { toPar: me.totalToPar, place: `${ordinal(me.rank)} overall` } : null;

      const myEntry = results.entries[viewerId]?.[round.index];
      const seatedThisRound = seat !== undefined;
      const host = results.roster.find((p) => p.id === t.host_id);
      const matchId = round.matchId ?? previous?.matchId ?? results.rounds[0]!.matchId!;

      let notice: TournamentNotice | null = null;
      if (!isOrganiser && seatedThisRound && round.index > 1 && round.matchId) {
        if (phase === 'setup') {
          notice = {
            key: `setup:${round.matchId}`,
            kind: 'roundSetUp',
            tournamentId: t.id,
            matchId: round.matchId,
            title: `${t.name} · Round ${round.index} is set`,
            body: `${course?.name ?? 'Course confirmed'} — check your tee and Play HC before tee-off.`,
          };
        } else if (phase === 'live' && (myEntry?.kind !== 'played' || myEntry.thru === 0)) {
          notice = {
            key: `live:${round.matchId}`,
            kind: 'roundStarted',
            tournamentId: t.id,
            matchId: round.matchId,
            title: `${t.name} · Round ${round.index} has started`,
            body: 'Scoring is open — jump in when you tee off.',
          };
        }
      }

      return {
        tournamentId: t.id,
        name: t.name,
        isOrganiser,
        hostFirstName: host?.name.split(' ')[0] ?? 'the organiser',
        phase,
        round,
        roundsCount: results.rounds.length,
        courseLine,
        overline,
        chip,
        overall,
        action: homeCardAction(isOrganiser, phase, seatedThisRound),
        timeline: results.rounds.map((r) => (r.status === 'done' ? 'done' : r.status === 'live' ? 'live' : r.index === round.index ? 'current' : 'upcoming')),
        matchId,
        notice,
      };
    }),
  );

  return built
    .filter((t): t is ActiveTournament => t !== null)
    .sort((a, b) => PHASE_RANK[a.phase] - PHASE_RANK[b.phase] || a.round.date.localeCompare(b.round.date));
}

/** Just the notices — for the bell count and the Notifications screen. */
export async function fetchTournamentNotices(viewerId: string): Promise<TournamentNotice[]> {
  return (await fetchActiveTournaments(viewerId)).flatMap((t) => (t.notice ? [t.notice] : []));
}
