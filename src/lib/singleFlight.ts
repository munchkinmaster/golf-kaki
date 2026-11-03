/**
 * Runs an async operation at most once: the first `run` starts it, and any
 * `run` made while it's in flight — or after it has succeeded — gets that
 * same result back with `started: false` instead of starting another. A failure clears it so the next `run` can retry. `reset`
 * forgets a past success (e.g. a new draft).
 */
export function singleFlight<T>() {
  let current: Promise<T> | null = null;

  return {
    async run(fn: () => Promise<T>): Promise<{ value: T; started: boolean }> {
      if (current) return { value: await current, started: false };
      const promise = fn();
      current = promise;
      try {
        return { value: await promise, started: true };
      } catch (err) {
        if (current === promise) current = null;
        throw err;
      }
    },
    reset() {
      current = null;
    },
  };
}
