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
 * `loading` MUST be passed and MUST be the same hook's own loading flag —
 * useLiveRound/useTournamentRound both initialize matchStatus to 'lobby'
 * before their first fetch resolves, so without this every screen showing
 * an ALREADY-finished round bounced straight back to Finish the instant
 * data loaded (a false 'lobby' -> 'finished' edge from the placeholder
 * default, not a real transition) — confirmed live: opening the Scorecard
 * grid for a finished round looked like it "couldn't display" because it
 * redirected away before anything rendered. While loading, matchStatus is
 * meaningless, so nothing is tracked or fired until the real value is in.
 *
 * Exists because the host's own "Finish round" tap only ever navigated
 * THEM — every other player just had their status pill/thru count update
 * via the same realtime channel that already drove this, with nothing
 * acting on it. Confirmed live: a player who stayed on Scorecard through
 * the host's finish was left there, still looking "live", able to keep
 * tapping the stepper (see useLiveRound/useTournamentRound's matching
 * canEdit guards for the other half of that fix).
 */
export function useFinishRedirect(matchStatus: MatchStatus, loading: boolean, onFinish: () => void) {
  const wasFinished = useRef<boolean | null>(null);
  useEffect(() => {
    if (loading) return;
    const nowFinished = matchStatus === 'finished';
    const justFinished = wasFinished.current === false && nowFinished;
    wasFinished.current = nowFinished;
    if (justFinished) onFinish();
  }, [matchStatus, loading, onFinish]);
}
