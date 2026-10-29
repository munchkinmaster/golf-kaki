import { describe, expect, it } from 'vitest';

import { groupPastRounds } from './pastGames';

const r = (matchId: string, tournamentId: string | null = null, tournamentRoundsCount: number | null = null) => ({ matchId, tournamentId, tournamentRoundsCount });

describe('groupPastRounds', () => {
  it('folds a multi-round tournament into one entry where its latest round sits', () => {
    const entries = groupPastRounds([r('m-r2', 't1', 3), r('friday'), r('m-r1', 't1', 3), r('single-t', 't2', 1)]);
    expect(entries.map((e) => e.key)).toEqual(['t:t1', 'friday', 'single-t']);
    const tournament = entries[0]!;
    expect(tournament.kind === 'tournament' && tournament.rounds.map((x) => x.matchId)).toEqual(['m-r2', 'm-r1']);
  });

  it('leaves single rounds and single-round tournaments alone', () => {
    expect(groupPastRounds([r('a'), r('b', 't2', 1)]).every((e) => e.kind === 'round')).toBe(true);
  });
});
