import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import { fetchAttestableBadges } from '../data/attestations';
import { fetchKakiOverview } from '../data/kaki';
import { fetchMatchInvites } from '../data/matches';
import { fetchTournamentNotices } from '../data/tournamentHome';

/**
 * How long a fetched count is reused. Rounds/Kaki/Profile each show the bell
 * and used to refetch all four sources (tournament notices being a full
 * fetchActiveTournaments) on every tab switch. Anything that changes the
 * count from inside the app calls invalidateNotificationCount, so the window
 * only delays items arriving from elsewhere without a realtime push (kaki
 * requests, attestable badges, tournament notices).
 */
const CACHE_TTL_MS = 60000;

let cache: { viewerId: string; count: number; fetchedAt: number } | null = null;
let inFlight: { viewerId: string; promise: Promise<number> } | null = null;

function fetchCount(viewerId: string): Promise<number> {
  if (inFlight?.viewerId === viewerId) return inFlight.promise;
  const promise = Promise.all([
    fetchMatchInvites(viewerId),
    fetchKakiOverview(viewerId),
    fetchAttestableBadges(viewerId),
    fetchTournamentNotices(viewerId).catch(() => []),
  ])
    .then(([invites, overview, attestable, notices]) => {
      const count = invites.length + overview.requests.length + attestable.length + notices.length;
      // Skip the write if something invalidated (or a different viewer
      // fetched) while this was in flight — it may already be stale.
      if (inFlight?.promise === promise) cache = { viewerId, count, fetchedAt: Date.now() };
      return count;
    })
    .finally(() => {
      if (inFlight?.promise === promise) inFlight = null;
    });
  inFlight = { viewerId, promise };
  return promise;
}

/** Forces the next bell to refetch — call after anything that adds or clears a notification (accepting an invite, attesting, a new invite landing). */
export function invalidateNotificationCount(): void {
  cache = null;
  inFlight = null;
}

/**
 * Total actionable items for the header bell's badge — pending game invites,
 * pending kaki requests, attestable badges, and multi-round tournament
 * notices (a round set up / started — see tournamentHome.ts). No separate read/unread
 * state: an item stops counting the moment it's acted on (accepted, declined,
 * ignored, or attested), same as it already disappears from Home's inline
 * cards today.
 */
export function useNotificationCount(viewerId: string | null): number {
  const [count, setCount] = useState(() => (cache && cache.viewerId === viewerId ? cache.count : 0));

  useFocusEffect(
    useCallback(() => {
      if (!viewerId) return;
      if (cache && cache.viewerId === viewerId && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
        setCount(cache.count);
        return;
      }
      fetchCount(viewerId)
        .then(setCount)
        .catch(() => {});
    }, [viewerId]),
  );

  return count;
}
