import { describe, expect, it } from 'vitest';

import { computeAggregateStandings, deriveRoundStatus, explainTieBreaks, findLowRound, hasSharedPlace, homeCardAction, ordinal, pickCurrentRound, positionSummary, roundsThrough, withLiveRound } from './multiRound';
import type { PlayerRoundEntry, RoundEntries, RoundRef } from './multiRound';

const played = (nett: number, thru = 18, par = 72): PlayerRoundEntry => ({
  kind: 'played',
  gross: nett + 10,
  nett,
  toPar: nett - (par * thru) / 18,
  thru,
  holes: 18,
});
const dns: PlayerRoundEntry = { kind: 'dns' };

// MR9's sample board after R2 of 3: Daniel 63+70 (−11), Marcus 69+66 (−9),
// Jason 72+71 (−1), Aisha 71 + DNS.
const rounds: RoundRef[] = [
  { index: 1, status: 'done' },
  { index: 2, status: 'done' },
  { index: 3, status: 'planned' },
];
const entries: RoundEntries = {
  daniel: { 1: played(63), 2: played(70) },
  marcus: { 1: played(69), 2: played(66) },
  jason: { 1: played(72), 2: played(71) },
  aisha: { 1: played(71), 2: dns },
};
const players = ['aisha', 'jason', 'marcus', 'daniel'];

describe('computeAggregateStandings', () => {
  it('ranks by aggregate nett to par over started rounds only', () => {
    const rows = computeAggregateStandings(players, rounds, entries, 'countback');
    expect(rows.map((r) => [r.playerId, r.rank, r.totalToPar])).toEqual([
      ['daniel', 1, -11],
      ['marcus', 2, -9],
      ['jason', 3, -1],
      ['aisha', null, -1],
    ]);
    expect(Object.keys(rows[0]!.rounds)).toEqual(['1', '2']);
  });

  it('puts DNS players last with no rank and lists the round they missed', () => {
    const aisha = computeAggregateStandings(players, rounds, entries, 'countback').find((r) => r.playerId === 'aisha')!;
    expect(aisha.rank).toBeNull();
    expect(aisha.missedRounds).toEqual([2]);
    expect(aisha.movement).toBeNull();
  });

  it('reports movement against the standings after the previous round', () => {
    // After R1: Daniel 1, Marcus 2, Aisha 3, Jason 4. After R2 Jason is 3rd.
    const rows = computeAggregateStandings(players, rounds, entries, 'countback');
    const movement = Object.fromEntries(rows.map((r) => [r.playerId, r.movement]));
    expect(movement).toEqual({ daniel: 0, marcus: 0, jason: 1, aisha: null });
  });

  it('has no movement after a single round', () => {
    const rows = computeAggregateStandings(players, [{ index: 1, status: 'done' }], entries, 'countback');
    expect(rows.every((r) => r.movement === null)).toBe(true);
  });

  it('counts a live round at its current thru', () => {
    const live: RoundRef[] = [
      { index: 1, status: 'done' },
      { index: 2, status: 'live' },
    ];
    const rows = computeAggregateStandings(['a', 'b'], live, {
      a: { 1: played(70), 2: played(22, 6) }, // −2, then −2 thru 6
      b: { 1: played(68), 2: played(25, 6) }, // −4, then +1 thru 6
    }, 'countback');
    expect(rows.map((r) => [r.playerId, r.totalToPar, r.holesPlayed])).toEqual([
      ['a', -4, 24],
      ['b', -3, 24],
    ]);
  });

  it('treats a seated player with no scores yet as level, not DNS', () => {
    const rows = computeAggregateStandings(['a', 'b'], [{ index: 1, status: 'live' }], { a: { 1: played(23, 6) } }, 'countback');
    expect(rows.find((r) => r.playerId === 'b')).toMatchObject({ rank: 2, totalToPar: 0, missedRounds: [] });
  });

  it('shares a place on a tie and skips the next one', () => {
    const rows = computeAggregateStandings(['a', 'b', 'c'], [{ index: 1, status: 'done' }], {
      a: { 1: played(70) },
      b: { 1: played(70) },
      c: { 1: played(71) },
    }, 'shared_place');
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3]);
  });
});

describe('findLowRound', () => {
  it('finds the best completed nett to par in a finished round', () => {
    expect(findLowRound(players, rounds, entries)).toEqual({ playerId: 'daniel', roundIndex: 1, nett: 63, toPar: -9 });
  });

  it('ignores live rounds and incomplete cards', () => {
    const live: RoundRef[] = [{ index: 1, status: 'live' }];
    expect(findLowRound(['a'], live, { a: { 1: played(60) } })).toBeNull();
    expect(findLowRound(['a'], [{ index: 1, status: 'done' }], { a: { 1: played(20, 6) } })).toBeNull();
  });
});

describe('deriveRoundStatus', () => {
  it('maps match state onto the round lifecycle', () => {
    expect(deriveRoundStatus(null)).toBe('planned');
    expect(deriveRoundStatus('lobby')).toBe('setup');
    expect(deriveRoundStatus('live')).toBe('live');
    expect(deriveRoundStatus('finished')).toBe('done');
  });
});

describe('computeAggregateStandings tie-break (R&A 5A(6)(d), multi-round)', () => {
  const twoRounds: RoundRef[] = [
    { index: 1, status: 'done' },
    { index: 2, status: 'done' },
  ];
  const withCountback = (nett: number, countback: number[]): PlayerRoundEntry => ({ ...(played(nett) as Extract<PlayerRoundEntry, { kind: 'played' }>), countback });

  it('breaks a tied total on the better last-round score', () => {
    // Both −6 overall: a 70 + 68, b 66 + 72 — a wins on R2.
    const rows = computeAggregateStandings(['b', 'a'], twoRounds, { a: { 1: played(70), 2: played(68) }, b: { 1: played(66), 2: played(72) } }, 'countback');
    expect(rows.map((r) => [r.playerId, r.rank])).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });

  it("falls back to the last round's card countback when the last-round scores tie too", () => {
    const rows = computeAggregateStandings(
      ['b', 'a'],
      twoRounds,
      { a: { 1: played(70), 2: withCountback(70, [600, 400]) }, b: { 1: played(70), 2: withCountback(70, [600, 410]) } },
      'countback',
    );
    expect(rows.map((r) => [r.playerId, r.rank])).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });

  it('shares the place when every comparison ties', () => {
    const same = withCountback(70, [600, 400]);
    const rows = computeAggregateStandings(['a', 'b'], twoRounds, { a: { 1: played(70), 2: same }, b: { 1: played(70), 2: same } }, 'countback');
    expect(rows.map((r) => r.rank)).toEqual([1, 1]);
  });

  it("doesn't count back on an unfinished last round", () => {
    const live: RoundRef[] = [
      { index: 1, status: 'done' },
      { index: 2, status: 'live' },
    ];
    const rows = computeAggregateStandings(['a', 'b'], live, { a: { 1: played(70), 2: played(20, 6) }, b: { 1: played(68), 2: played(22, 6) } }, 'countback');
    expect(rows.map((r) => r.rank)).toEqual([1, 1]);
  });

  it("ignores the tie-break under 'shared_place'", () => {
    const rows = computeAggregateStandings(['a', 'b'], twoRounds, { a: { 1: played(70), 2: played(68) }, b: { 1: played(66), 2: played(72) } }, 'shared_place');
    expect(rows.map((r) => r.rank)).toEqual([1, 1]);
  });
});

describe('pickCurrentRound', () => {
  const r = (index: number, status: RoundRef['status']) => ({ index, status });

  it('is in setup before Round 1 starts (MR6a)', () => {
    expect(pickCurrentRound([r(1, 'setup'), r(2, 'planned'), r(3, 'planned')])).toEqual({ phase: 'setup', current: r(1, 'setup'), previous: null });
  });

  it('is live while a round is being scored (MR6b)', () => {
    expect(pickCurrentRound([r(1, 'done'), r(2, 'live'), r(3, 'planned')])).toMatchObject({ phase: 'live', current: r(2, 'live'), previous: r(1, 'done') });
  });

  it('is between rounds once a round finishes and the next is not set up (MR6)', () => {
    expect(pickCurrentRound([r(1, 'done'), r(2, 'planned'), r(3, 'planned')])).toMatchObject({ phase: 'between', current: r(2, 'planned'), previous: r(1, 'done') });
  });

  it('is complete after the final round', () => {
    expect(pickCurrentRound([r(1, 'done'), r(2, 'done')])).toMatchObject({ phase: 'complete', current: r(2, 'done') });
  });

  it('treats a single-round tournament the same way', () => {
    expect(pickCurrentRound([r(1, 'live')])).toMatchObject({ phase: 'live', current: r(1, 'live') });
    expect(pickCurrentRound([])).toBeNull();
  });
});

describe('positionSummary (MR10)', () => {
  const first = (id: string) => ({ daniel: 'Daniel', marcus: 'Marcus', jason: 'Jason', aisha: 'Aisha' })[id] ?? id;
  const afterR1 = computeAggregateStandings(players, [{ index: 1, status: 'done' }, { index: 2, status: 'planned' }], entries, 'countback');

  it('says how far back the viewer is (the MR10 sample: 2nd, 6 back of Daniel)', () => {
    expect(positionSummary(afterR1, 'marcus', 1, 2, first)).toEqual({ title: '2nd overall after Round 1', detail: '6 back of Daniel with 2 rounds to go.' });
  });

  it('says how far clear the leader is', () => {
    expect(positionSummary(afterR1, 'daniel', 1, 1, first)).toEqual({ title: 'Leading after Round 1', detail: '6 shots clear of Marcus with 1 round to go.' });
  });

  it('calls out a shared lead', () => {
    const rows = computeAggregateStandings(['a', 'b'], [{ index: 1, status: 'done' }], { a: { 1: played(70) }, b: { 1: played(70) } }, 'shared_place');
    expect(positionSummary(rows, 'a', 1, 2, (id) => id.toUpperCase())).toEqual({ title: 'Tied for the lead after Round 1', detail: 'Level with B with 2 rounds to go.' });
  });

  it('explains a missed round', () => {
    expect(positionSummary(computeAggregateStandings(players, rounds, entries, 'countback'), 'aisha', 2, 1, first)?.title).toBe('Missed Round 2');
  });

  it('is null when the viewer is not on the board', () => {
    expect(positionSummary(afterR1, 'someone-else', 1, 2, first)).toBeNull();
  });

  it('ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
  });
});

describe('withLiveRound / roundsThrough', () => {
  const fetched: RoundRef[] = [
    { index: 1, status: 'done' },
    { index: 2, status: 'setup' }, // fetched before the round started
  ];
  const fetchedEntries: RoundEntries = { a: { 1: played(70) }, b: { 1: played(68) }, c: { 1: played(72), 2: dns } };

  it('swaps in the live round and its status, keeping DNS and earlier rounds', () => {
    const merged = withLiveRound(fetched, fetchedEntries, 2, 'live', { a: played(20, 6), b: played(26, 6) });
    expect(merged.rounds[1]).toEqual({ index: 2, status: 'live' });
    expect(merged.entries.c?.[2]).toEqual(dns);
    expect(merged.entries.a?.[1]).toEqual(played(70));
    const rows = computeAggregateStandings(['a', 'b', 'c'], merged.rounds, merged.entries, 'countback');
    expect(rows.map((r) => [r.playerId, r.rank, r.totalToPar])).toEqual([
      ['a', 1, -6],
      ['b', 2, -2],
      ['c', null, 0],
    ]);
  });

  it('does not mutate what was fetched', () => {
    withLiveRound(fetched, fetchedEntries, 2, 'live', { a: played(20, 6) });
    expect(fetchedEntries.a?.[2]).toBeUndefined();
    expect(fetched[1]?.status).toBe('setup');
  });

  it('roundsThrough drops later rounds from the standings', () => {
    const rows = computeAggregateStandings(players, roundsThrough(rounds, 1), entries, 'countback');
    expect(rows.map((r) => r.playerId)).toEqual(['daniel', 'marcus', 'aisha', 'jason']);
    expect(rows.every((r) => r.missedRounds.length === 0)).toBe(true);
  });
});

describe('homeCardAction (MR12)', () => {
  it('follows the handoff table', () => {
    expect(homeCardAction(true, 'between', true)).toBe('beginRound');
    expect(homeCardAction(false, 'between', true)).toBe('waitingForSetup');
    expect(homeCardAction(false, 'setup', true)).toBe('openLobby');
    expect(homeCardAction(false, 'live', true)).toBe('joinScoring');
    expect(homeCardAction(false, 'live', false)).toBe('viewLeaderboard');
    expect(homeCardAction(false, 'setup', false)).toBe('viewLeaderboard');
  });

  it('keeps the organiser on the lobby even when they are not playing', () => {
    expect(homeCardAction(true, 'live', false)).toBe('openLobby');
    expect(homeCardAction(true, 'live', true)).toBe('joinScoring');
  });
});

describe('explainTieBreaks', () => {
  const done3: RoundRef[] = [
    { index: 1, status: 'done' },
    { index: 2, status: 'done' },
    { index: 3, status: 'done' },
  ];
  const name = (id: string) => id[0]!.toUpperCase() + id.slice(1);
  const withCb = (nett: number, countback: number[]): PlayerRoundEntry => ({ ...played(nett), countback } as PlayerRoundEntry);

  it('explains a three-way tie split by the final round nett', () => {
    // All +16: Yao 75/79/78, Chua 71/78/83, Cyc 68/79/85.
    const tied: RoundEntries = {
      yao: { 1: played(75), 2: played(79), 3: played(78) },
      chua: { 1: played(71), 2: played(78), 3: played(83) },
      cyc: { 1: played(68), 2: played(79), 3: played(85) },
    };
    const rows = computeAggregateStandings(['cyc', 'chua', 'yao'], done3, tied, 'countback');
    expect(rows.map((r) => [r.playerId, r.rank])).toEqual([
      ['yao', 1],
      ['chua', 2],
      ['cyc', 3],
    ]);
    const { decidedIds, notes } = explainTieBreaks(rows, 'countback', name);
    expect([...decidedIds].sort()).toEqual(['chua', 'cyc', 'yao']);
    expect(notes).toEqual(['Yao, Chua and Cyc finished level on +16. The lower Round 3 nett takes the higher place: Yao 78, Chua 83, Cyc 85.']);
  });

  it('names the countback segment when the final round nett is also level', () => {
    const tied: RoundEntries = {
      ann: { 1: played(70), 2: withCb(74, [600, 400, 200, 70, 400, 200, 70]) },
      ben: { 1: played(70), 2: withCb(74, [600, 410, 200, 70, 400, 200, 70]) },
    };
    const rows = computeAggregateStandings(['ben', 'ann'], done3.slice(0, 2), tied, 'countback');
    const { notes } = explainTieBreaks(rows, 'countback', name);
    expect(notes).toEqual(['Ann and Ben finished level on E. Ann and Ben both had 74, so Ann took it on countback (better Round 2 last 6).']);
  });

  it('says so when the tie-break cannot split them', () => {
    const cb = [600, 400, 200, 70, 400, 200, 70];
    const tied: RoundEntries = {
      ann: { 1: played(70), 2: withCb(74, cb) },
      ben: { 1: played(70), 2: withCb(74, cb) },
      cat: { 1: played(72), 2: withCb(73, cb) },
    };
    const rows = computeAggregateStandings(['ann', 'ben', 'cat'], done3.slice(0, 2), tied, 'countback');
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3]);
    // Ann and Ben share 1st outright — no group left with a split, so nothing to explain.
    expect(explainTieBreaks(rows, 'countback', name).notes).toEqual([]);
  });

  it('stays silent under the shared-place rule', () => {
    const tied: RoundEntries = {
      ann: { 1: played(70), 2: played(74) },
      ben: { 1: played(74), 2: played(70) },
    };
    const rows = computeAggregateStandings(['ann', 'ben'], done3.slice(0, 2), tied, 'shared_place');
    expect(explainTieBreaks(rows, 'shared_place', name)).toEqual({ decidedIds: new Set(), notes: [] });
  });
});

describe('ties mid-tournament', () => {
  const withCb = (nett: number, countback: number[]): PlayerRoundEntry => ({ ...played(nett), countback } as PlayerRoundEntry);
  // All on 82 after Round 1 of 3, with different back 9s.
  const tiedR1: RoundEntries = {
    yao: { 1: withCb(82, [700, 400, 200, 70, 400, 200, 70]) },
    chua: { 1: withCb(82, [710, 400, 200, 70, 400, 200, 70]) },
    cyc: { 1: withCb(82, [720, 400, 200, 70, 400, 200, 70]) },
  };

  it('shares the place while rounds remain, even under the countback rule', () => {
    const rounds: RoundRef[] = [
      { index: 1, status: 'done' },
      { index: 2, status: 'planned' },
      { index: 3, status: 'planned' },
    ];
    const rows = computeAggregateStandings(['yao', 'chua', 'cyc'], rounds, tiedR1, 'countback');
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 1]);
    expect(hasSharedPlace(rows)).toBe(true);
  });

  it('applies the tie-break once every round is done', () => {
    const rows = computeAggregateStandings(['cyc', 'chua', 'yao'], [{ index: 1, status: 'done' }], tiedR1, 'countback');
    expect(rows.map((r) => [r.playerId, r.rank])).toEqual([
      ['yao', 1],
      ['chua', 2],
      ['cyc', 3],
    ]);
    expect(hasSharedPlace(rows)).toBe(false);
  });
});
