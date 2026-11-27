import type { NavigationState } from '@react-navigation/native';
import { describe, expect, it } from 'vitest';

import { NAV_STATE_MAX_AGE_MS, parseNavState, serializeNavState } from './persistedNavState';

const NOW = 1_800_000_000_000;

function stack(...names: string[]): NavigationState {
  return {
    key: 'stack-1',
    index: names.length - 1,
    routeNames: names,
    routes: names.map((name, i) => ({ key: `${name}-${i}`, name })),
    type: 'stack',
    stale: false,
    preloadedRoutes: [],
  } as NavigationState;
}

describe('parseNavState', () => {
  it('resumes a recent mid-round stack', () => {
    const state = stack('Home', 'TournamentLobby', 'TournamentScorecard');
    expect(parseNavState(serializeNavState(state, NOW - 60_000), NOW)).toEqual(state);
  });

  it('starts fresh instead of reopening a tournament recap', () => {
    const state = stack('Home', 'TournamentLobby', 'TournamentScorecard', 'TournamentComplete');
    expect(parseNavState(serializeNavState(state, NOW - 60_000), NOW)).toBeUndefined();
  });

  it('starts fresh instead of reopening a round recap or a single-game recap', () => {
    expect(parseNavState(serializeNavState(stack('Home', 'TournamentRoundRecap'), NOW), NOW)).toBeUndefined();
    expect(parseNavState(serializeNavState(stack('Home', 'Recap'), NOW), NOW)).toBeUndefined();
  });

  it('starts fresh once the saved stack is older than the max age', () => {
    const state = stack('Home', 'TournamentScorecard');
    expect(parseNavState(serializeNavState(state, NOW - NAV_STATE_MAX_AGE_MS - 1), NOW)).toBeUndefined();
  });

  it('discards the old timestamp-less format, garbage, and empty storage', () => {
    expect(parseNavState(JSON.stringify(stack('Home', 'TournamentComplete')), NOW)).toBeUndefined();
    expect(parseNavState('{not json', NOW)).toBeUndefined();
    expect(parseNavState(null, NOW)).toBeUndefined();
  });
});
