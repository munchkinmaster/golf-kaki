import type { NavigationState } from '@react-navigation/native';

import type { RootStackParamList } from './types';

export const NAVIGATION_STATE_KEY = 'golfkaki.navigationState';

/**
 * How long a saved stack stays worth resuming. Long enough to cover a mobile
 * browser reloading a backgrounded tab mid-round (the reason persistence
 * exists — see App.tsx); short enough that reopening the browser days later
 * starts on Home instead of whatever happened to be on screen back then.
 */
export const NAV_STATE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/**
 * End-of-flow result screens. A restore that would land on one of these is
 * dropped: a recap is something you look at once, not somewhere to resume —
 * and the stale in-round screens stacked under it aren't either. Without
 * this, a finished tournament's recap kept coming back on every browser
 * reload (2026-11-20).
 */
const RECAP_ROUTES = new Set<keyof RootStackParamList>(['TournamentComplete', 'TournamentRoundRecap', 'Recap']);

type SavedNavState = { savedAt: number; state: NavigationState };

export function serializeNavState(state: NavigationState | undefined, now: number): string {
  return JSON.stringify({ savedAt: now, state });
}

/**
 * Returns the stack to resume, or undefined to start fresh on the default
 * route. Anything unparseable, from the old timestamp-less format, too old,
 * or sitting on a recap screen is discarded.
 */
export function parseNavState(raw: string | null, now: number): NavigationState | undefined {
  if (!raw) return undefined;
  let saved: Partial<SavedNavState>;
  try {
    saved = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof saved?.savedAt !== 'number' || !saved.state || !Array.isArray(saved.state.routes)) return undefined;
  if (now - saved.savedAt > NAV_STATE_MAX_AGE_MS || saved.savedAt > now) return undefined;
  const top = saved.state.routes[saved.state.index ?? saved.state.routes.length - 1];
  if (!top || RECAP_ROUTES.has(top.name as keyof RootStackParamList)) return undefined;
  return saved.state;
}
