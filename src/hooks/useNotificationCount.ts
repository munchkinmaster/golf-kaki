import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import { fetchAttestableBadges } from '../data/attestations';
import { fetchKakiOverview } from '../data/kaki';
import { fetchMatchInvites } from '../data/matches';

/**
 * Total actionable items for the header bell's badge — pending game invites,
 * pending kaki requests, and attestable badges. No separate read/unread
 * state: an item stops counting the moment it's acted on (accepted, declined,
 * ignored, or attested), same as it already disappears from Home's inline
 * cards today.
 */
export function useNotificationCount(viewerId: string | null): number {
  const [count, setCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!viewerId) return;
      Promise.all([fetchMatchInvites(viewerId), fetchKakiOverview(viewerId), fetchAttestableBadges(viewerId)])
        .then(([invites, overview, attestable]) => setCount(invites.length + overview.requests.length + attestable.length))
        .catch(() => {});
    }, [viewerId]),
  );

  return count;
}
