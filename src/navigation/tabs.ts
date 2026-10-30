import { CommonActions } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';

import type { BottomNavTab } from '../components/BottomNav';
import type { RootStackParamList } from './types';

const TAB_ROUTES = { home: 'Home', rounds: 'Rounds', kaki: 'Kaki', profile: 'Profile' } as const;

/**
 * Switches to a home-base tab without growing the stack. React Navigation 7's
 * `navigate` only reuses a route if it's the focused one — otherwise it
 * pushes a fresh copy — so every BottomNav tap used to stack another mounted
 * Home/Rounds/Kaki/Profile on top of the last, each re-running its focus
 * fetches and re-rendering on every ProfileContext change. That pile grew
 * for the whole session and made Profile (the heaviest of the four) visibly
 * laggy on iOS Safari.
 *
 * Instead, the stack is trimmed back to Home (kept mounted — it's the base
 * every tab sits on) and the target tab, if not Home itself, is placed
 * directly above it. A tab already sitting there keeps its key, so it's
 * reused rather than remounted.
 */
export function goToTab<T extends BottomNavTab>(
  navigation: NavigationProp<RootStackParamList>,
  tab: T,
  params?: RootStackParamList[(typeof TAB_ROUTES)[T]],
) {
  const name = TAB_ROUTES[tab];
  navigation.dispatch((state) => {
    const homeIndex = state.routes.findLastIndex((r) => r.name === 'Home');
    const base = homeIndex === -1 ? [{ name: 'Home' }] : state.routes.slice(0, homeIndex + 1);
    if (name === 'Home') {
      return CommonActions.reset({ ...state, routes: base, index: base.length - 1 });
    }
    const existing = homeIndex === -1 ? undefined : state.routes[base.length];
    const target = existing?.name === name ? { ...existing, params: params ?? existing.params } : { name, params };
    const routes = [...base, target];
    return CommonActions.reset({ ...state, routes, index: routes.length - 1 });
  });
}
