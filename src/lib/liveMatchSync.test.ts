import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state = {
    appState: 'active' as string,
    appStateListener: null as ((s: string) => void) | null,
    tableHandlers: new Map<string, () => void>(),
  };
  return {
    state,
    reactNative: {
      AppState: {
        get currentState() {
          return state.appState;
        },
        addEventListener: (_: string, cb: (s: string) => void) => {
          state.appStateListener = cb;
          return { remove: () => (state.appStateListener = null) };
        },
      },
    },
    supabase: {
      channel: () => {
        const builder = {
          on: (_: string, opts: { table: string }, cb: () => void) => {
            state.tableHandlers.set(opts.table, cb);
            return builder;
          },
          subscribe: () => ({}),
        };
        return builder;
      },
      removeChannel: () => {},
    },
  };
});

vi.mock('react-native', () => mocks.reactNative);
vi.mock('./supabase', () => ({ supabase: mocks.supabase }));

import { joinMatchSync } from './liveMatchSync';

type Data = { status: 'live' | 'finished'; scores: number; other: number };

/** A promise you resolve by hand, so a test can hold a fetch "in flight". */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const flush = () => vi.advanceTimersByTimeAsync(0);
const fire = (table: string) => mocks.state.tableHandlers.get(table)!();

let leave: (() => void) | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  mocks.state.appState = 'active';
  mocks.state.tableHandlers.clear();
});

afterEach(() => {
  leave?.();
  leave = null;
  vi.useRealTimers();
});

function setup(isSettled?: (d: Data) => boolean) {
  let data: Data = { status: 'live', scores: 0, other: 0 };
  const fetchFn = vi.fn(async () => ({ ...data }));
  const refetchScores = vi.fn(async (prev: Data) => ({ ...prev, scores: data.scores }));
  const onData = vi.fn();
  leave = joinMatchSync<Data>(
    `test-${Math.random()}`,
    fetchFn,
    [
      { table: 'scores', filter: '', refetch: refetchScores },
      { table: 'matches', filter: '' },
    ],
    onData,
    () => {},
    isSettled,
  );
  return { fetchFn, refetchScores, onData, set: (next: Partial<Data>) => (data = { ...data, ...next }) };
}

describe('joinMatchSync', () => {
  it('reloads only scores on a scores change, and everything on any other table', async () => {
    const { fetchFn, refetchScores, onData, set } = setup();
    await flush();
    expect(fetchFn).toHaveBeenCalledTimes(1);

    set({ scores: 4, other: 9 });
    fire('scores');
    fire('scores');
    await vi.advanceTimersByTimeAsync(250);
    expect(refetchScores).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    // Only the scores part moved; `other` still holds the last full fetch's value.
    expect(onData).toHaveBeenLastCalledWith({ status: 'live', scores: 4, other: 0 });

    fire('matches');
    await vi.advanceTimersByTimeAsync(250);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(onData).toHaveBeenLastCalledWith({ status: 'live', scores: 4, other: 9 });
  });

  it('runs a change that lands mid-fetch once that fetch settles', async () => {
    const { fetchFn, refetchScores, onData } = setup();
    await flush();

    const slow = deferred<Data>();
    fetchFn.mockReturnValueOnce(slow.promise);
    fire('matches');
    await vi.advanceTimersByTimeAsync(250);
    expect(fetchFn).toHaveBeenCalledTimes(2);

    fire('scores');
    await vi.advanceTimersByTimeAsync(250);
    expect(refetchScores).not.toHaveBeenCalled();

    slow.resolve({ status: 'live', scores: 1, other: 1 });
    await flush();
    expect(refetchScores).toHaveBeenCalledTimes(1);
    expect(onData).toHaveBeenCalledTimes(3);
  });

  it('polls only while active and not settled, and catches up on resume', async () => {
    const { fetchFn, set } = setup((d) => d.status === 'finished');
    await flush();

    await vi.advanceTimersByTimeAsync(60000);
    expect(fetchFn).toHaveBeenCalledTimes(2);

    mocks.state.appState = 'background';
    mocks.state.appStateListener!('background');
    await vi.advanceTimersByTimeAsync(180000);
    expect(fetchFn).toHaveBeenCalledTimes(2);

    mocks.state.appState = 'active';
    mocks.state.appStateListener!('active');
    await flush();
    expect(fetchFn).toHaveBeenCalledTimes(3);

    set({ status: 'finished' });
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetchFn).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(180000);
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });
});
