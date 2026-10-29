import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import { fetchAttestableBadges } from '../data/attestations';
import { fetchKakiOverview } from '../data/kaki';
import { fetchMatchInvites } from '../data/matches';
import { fetchTournamentNotices } from '../data/tournamentHome';

/**
 * Total actionable items for the header bell's badge — pending game invites,
 * pending kaki requests, attestable badges, and multi-round tournament
 * notices (a round set up / started — see tournamentHome.ts). No separate read/unread
 * state: an item stops counting the moment it's acted on (accepted, declined,
 * ignored, or attested), same as it already disappears from Home's inline
 * cards today.
 */
export function useNotificationCount(viewerId: string | null): number {
  const [count, setCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!viewerId) return;
      Promise.all([
        fetchMatchInvites(viewerId),
        fetchKakiOverview(viewerId),
        fetchAttestableBadges(viewerId),
        fetchTournamentNotices(viewerId).catch(() => []),
      ])
        .then(([invites, overview, attestable, notices]) => setCount(invites.length + overview.requests.length + attestable.length + notices.length))
        .catch(() => {});
    }, [viewerId]),
  );

  return count;
}
