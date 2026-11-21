/**
 * Which cells (a score, a pair's stroke deal) this client has written
 * locally, and for how long its optimistic value should win over a fetch.
 *
 * Why a claim at all: every live-round screen applies the same shared fetch
 * (see liveMatchSync.ts), and a fetch that started before this client's own
 * write landed reads the pre-write value — applying it blindly rolls an
 * optimistic edit backward on screen.
 *
 * Why the claim has to END: it used to be a plain Set that was never
 * cleared, so once a device had edited a cell, that device ignored every
 * later value for it — including a correction made on someone else's phone.
 * The 2026-11-20 round showed exactly that: one hole read 7 on one phone and
 * 6 on the other for the rest of the round, and Refresh couldn't fix it
 * (refresh goes through the same merge).
 *
 * So a claim lasts only while this client's write is unconfirmed: until it
 * resolves, plus until a fetch that STARTED after it resolved has been
 * applied. That fetch read the row after the write committed, so whatever
 * it holds — this client's value, or a newer one from another device — is
 * the truth. Writes to the same key also run one at a time, in tap order:
 * concurrent upserts (plus withRetry's backoff) could otherwise land out of
 * order and leave the server holding an older tap than the screen shows.
 */

type Claim = { pending: number; settledAt: number };

export class LocalEdits {
  private claims = new Map<string, Claim>();
  private chains = new Map<string, Promise<void>>();

  constructor(private now: () => number = Date.now) {}

  /**
   * Runs `write` after any earlier write to the same key has finished,
   * claiming the key until it's confirmed (see the module comment). A failed
   * write drops the claim once nothing else is pending for that key, so the
   * caller's resync shows what the server actually holds.
   */
  write(key: string, write: () => Promise<void>): Promise<void> {
    const claim = this.claims.get(key) ?? { pending: 0, settledAt: 0 };
    claim.pending += 1;
    this.claims.set(key, claim);

    const result = (this.chains.get(key) ?? Promise.resolve()).then(write).then(
      () => {
        claim.pending -= 1;
        claim.settledAt = this.now();
      },
      (err: unknown) => {
        claim.pending -= 1;
        if (claim.pending === 0 && this.claims.get(key) === claim) this.claims.delete(key);
        throw err;
      },
    );
    const tail = result.catch(() => {});
    this.chains.set(key, tail);
    tail.then(() => {
      if (this.chains.get(key) === tail) this.chains.delete(key);
    });
    return result;
  }

  /** Drops every claim a fetch that started at `fetchStartedAt` has already caught up with. Call before merging that fetch. */
  release(fetchStartedAt: number): void {
    this.claims.forEach((claim, key) => {
      if (claim.pending === 0 && claim.settledAt > 0 && fetchStartedAt > claim.settledAt) this.claims.delete(key);
    });
  }

  /** True while this client's local value for `key` should win over a fetched one. */
  has(key: string): boolean {
    return this.claims.has(key);
  }

  get size(): number {
    return this.claims.size;
  }
}
