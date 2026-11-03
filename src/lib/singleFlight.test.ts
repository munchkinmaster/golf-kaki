import { describe, expect, it, vi } from 'vitest';

import { singleFlight } from './singleFlight';

describe('singleFlight', () => {
  it('runs an overlapping second call against the first one instead of starting another', async () => {
    const flight = singleFlight<string>();
    let resolve!: (v: string) => void;
    const fn = vi.fn(() => new Promise<string>((r) => (resolve = r)));

    const first = flight.run(fn);
    const second = flight.run(fn);
    resolve('6NPC');

    expect(await first).toEqual({ value: '6NPC', started: true });
    expect(await second).toEqual({ value: '6NPC', started: false });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('keeps returning a past success until reset', async () => {
    const flight = singleFlight<number>();
    const fn = vi.fn(async () => 1);
    await flight.run(fn);
    expect(await flight.run(fn)).toEqual({ value: 1, started: false });
    flight.reset();
    expect(await flight.run(fn)).toEqual({ value: 1, started: true });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('lets a failed run be retried, and fails the calls that joined it', async () => {
    const flight = singleFlight<number>();
    let reject!: (e: Error) => void;
    const first = flight.run(() => new Promise<number>((_, r) => (reject = r)));
    const joined = flight.run(async () => 99);
    reject(new Error('network'));

    await expect(first).rejects.toThrow('network');
    await expect(joined).rejects.toThrow('network');
    expect(await flight.run(async () => 2)).toEqual({ value: 2, started: true });
  });
});
