import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef } from 'react';

import type { MatchStatus } from '../data/matches';

/**
 * Auto-navigates the viewer to the round's Finish/Recap screen the instant
 * the match transitions to 'finished' while they're sitting on any other
 * in-round screen (Scorecard, Leaderboard, Lobby). Same edge-triggered
 * pattern as TournamentLobbyScreen's own lobby->live redirect: it only
 * fires on the false->true transition observed while mounted, never on
 * mount into an already-finished round — so deliberately tapping back to
 * Scorecard or Lobby to review a round that finished a while ago doesn't
 * get force-navigated away again.
 *
 * `hasData` MUST be true only once the caller's data hook has delivered a
 * REAL result at least once (useLiveRound/useTournamentRound's `hasData`).
 * Both hooks initialize matchStatus to a 'lobby' placeholder, and both flip
 * `loading` to false on a failed fetch too — so gating on `loading` alone
 * let a failed first load (flaky mobile network on browser resume) record
 * the placeholder 'lobby' as "not finished", and the next successful
 * refetch then read as a fresh 'lobby' -> 'finished' edge for a round that
 * had finished days ago, pushing its recap on top of whatever the viewer
 * was doing (2026-11-20: the Malaysia Open recap kept resurfacing).
 *
 * It also only fires while the calling screen is FOCUSED. React Navigation
 * keeps earlier stack screens mounted underneath the current one; without
 * this, a Scorecard/Lobby buried in the stack could push a recap over an
 * unrelated screen (and several buried screens would each push their own).
 * An edge seen while unfocused is consumed, not deferred.
 *
 * Exists because the host's own "Finish round" tap only ever navigated
 * THEM — every other player just had their status pill/thru count update
 * via the same realtime channel that already drove this, with nothing
 * acting on it. Confirmed live: a player who stayed on Scorecard through
 * the host's finish was left there, still looking "live", able to keep
 * tapping the stepper (see useLiveRound/useTournamentRound's matching
 * canEdit guards for the other half of that fix).
 */
export function useFinishRedirect(matchStatus: MatchStatus, hasData: boolean, onFinish: () => void) {
  const navigation = useNavigation();
  const wasFinished = useRef<boolean | null>(null);
  useEffect(() => {
    if (!hasData) return;
    const nowFinished = matchStatus === 'finished';
    const justFinished = wasFinished.current === false && nowFinished;
    wasFinished.current = nowFinished;
    if (justFinished && navigation.isFocused()) onFinish();
  }, [matchStatus, hasData, onFinish, navigation]);
}
