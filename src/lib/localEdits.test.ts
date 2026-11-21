import { describe, expect, it } from 'vitest';

import { LocalEdits } from './localEdits';

function deferred() {
  let resolve!: () => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('LocalEdits', () => {
  it('holds a claim while the write is in flight, whatever fetches land', async () => {
    let t = 100;
    const edits = new LocalEdits(() => t);
    const w = deferred();
    edits.write('p1:5', () => w.promise);

    t = 200;
    edits.release(150);
    expect(edits.has('p1:5')).toBe(true);
    w.resolve();
    await flush();
  });

  it('keeps the claim against a fetch that started before the write landed', async () => {
    let t = 100;
    const edits = new LocalEdits(() => t);
    const w = deferred();
    const done = edits.write('p1:5', () => w.promise);
    t = 300;
    w.resolve();
    await done;

    edits.release(250); // fetch started before the write resolved at 300
    expect(edits.has('p1:5')).toBe(true);
  });

  // The 2026-11-20 hole 5 bug: this device wrote 7, another device later wrote
  // 6. The old never-cleared Set kept showing 7 here forever.
  it('lets go once a fetch that started after the write lands, so a newer value from elsewhere shows', async () => {
    let t = 100;
    const edits = new LocalEdits(() => t);
    const done = edits.write('p1:5', () => Promise.resolve());
    t = 300;
    await done;

    edits.release(301);
    expect(edits.has('p1:5')).toBe(false);
    expect(edits.size).toBe(0);
  });

  it('runs writes to the same key one at a time, in order', async () => {
    const edits = new LocalEdits();
    const order: string[] = [];
    const first = deferred();
    edits.write('p1:5', async () => {
      order.push('start 6');
      await first.promise;
      order.push('end 6');
    });
    const second = edits.write('p1:5', async () => {
      order.push('start 7');
    });

    await flush();
    expect(order).toEqual(['start 6']);
    first.resolve();
    await second;
    expect(order).toEqual(['start 6', 'end 6', 'start 7']);
  });

  it('still runs the next write when an earlier one to the same key failed', async () => {
    const edits = new LocalEdits();
    const ran: number[] = [];
    const failed = edits.write('p1:5', async () => {
      throw new Error('offline');
    });
    const next = edits.write('p1:5', async () => {
      ran.push(7);
    });
    await expect(failed).rejects.toThrow('offline');
    await next;
    expect(ran).toEqual([7]);
  });

  it('drops the claim on a failed write so a resync shows the server value', async () => {
    const edits = new LocalEdits();
    await expect(
      edits.write('p1:5', async () => {
        throw new Error('offline');
      }),
    ).rejects.toThrow();
    expect(edits.has('p1:5')).toBe(false);
  });

  it('keeps the claim while a later write to the key is still pending after an earlier one failed', async () => {
    const edits = new LocalEdits();
    const later = deferred();
    const failed = edits.write('p1:5', async () => {
      throw new Error('offline');
    });
    edits.write('p1:5', () => later.promise);
    await expect(failed).rejects.toThrow();
    expect(edits.has('p1:5')).toBe(true);
    later.resolve();
    await flush();
  });

  it('tracks keys independently', async () => {
    let t = 100;
    const edits = new LocalEdits(() => t);
    const a = edits.write('p1:5', () => Promise.resolve());
    t = 200;
    await a;
    const pending = deferred();
    edits.write('p2:5', () => pending.promise);

    edits.release(500);
    expect(edits.has('p1:5')).toBe(false);
    expect(edits.has('p2:5')).toBe(true);
    pending.resolve();
    await flush();
  });
});
