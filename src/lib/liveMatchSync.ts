/**
 * Shared per-match realtime subscription + fallback poll, deduped across
 * every mounted screen watching the same match.
 *
 * Why: useLiveRound/useTournamentRound are called independently by every
 * live-round screen (Scorecard, Leaderboard, Lobby, Finish, Recap), and
 * React Navigation keeps earlier stack screens mounted underneath the
 * current one — so several instances of the same hook, for the SAME match,
 * are routinely alive on one device at once. Each used to open its own
 * `postgres_changes` channel plus its own 20s poll `setInterval` and run its
 * own full reload independently — so one phone with 3 stack screens open
 * for one match ran 3x the realtime connections and 3x the poll traffic for
 * identical data. This module keys a single channel + single poll timer per
 * `key` (one per match), ref-counted across joins: the first caller to join
 * a key creates the subscription and does the fetch; every later join for
 * the same key just adds a listener and gets the already-fetched data
 * (or, if none has landed yet, shares the one in-flight fetch); the
 * underlying channel/timer only tears down once the last listener leaves.
 */

import { AppState } from 'react-native';
import type { NativeEventSubscription } from 'react-native';

import { supabase } from './supabase';

/**
 * A table to watch over realtime. `refetch`, if given, is a cheaper partial
 * reload for a change on this table alone: it takes the last full result and
 * returns it with just the affected part re-fetched (e.g. only `scores`
 * after a score write, instead of the whole round). Without it, a change
 * triggers a full `fetchFn` reload.
 */
export type TableWatch<T> = { table: string; filter: string; refetch?: (prev: T) => Promise<T> };
type Listener<T> = { onData: (data: T) => void; onError: (err: unknown) => void };

type Entry<T> = {
  listeners: Set<Listener<T>>;
  channel: ReturnType<typeof supabase.channel>;
  pollTimer: ReturnType<typeof setInterval> | null;
  syncTimer: ReturnType<typeof setTimeout> | null;
  appStateSub: NativeEventSubscription;
  lastData: T | null;
  fetchAndBroadcast: () => void;
};

const registry = new Map<string, Entry<unknown>>();

/**
 * Fallback poll interval. Was 20s; the poll now also pauses while the app is
 * hidden and refetches on return (which covered the main way realtime events
 * get missed), so it only has to catch the rarer foreground websocket drop.
 */
const POLL_MS = 60000;

/**
 * Join the shared subscription for `key`, creating it if this is the first
 * joiner. Returns an unsubscribe function — call it on unmount.
 *
 * `fetchFn`, `tables` and `isSettled` are only actually used when this call
 * creates the entry; a joiner arriving after the entry already exists reuses
 * whatever the first joiner registered. That's safe here because every caller
 * for a given key (i.e. every live-round screen for the same matchId) fetches
 * and watches the exact same thing — see useLiveRound/useTournamentRound.
 *
 * `isSettled` marks data that's no longer expected to change (e.g. a finished
 * match): once the latest fetch is settled, the fallback poll stops. Realtime
 * stays subscribed, so a change that does still land is picked up — and if
 * it un-settles the data, the poll resumes.
 */
export function joinMatchSync<T>(
  key: string,
  fetchFn: () => Promise<T>,
  tables: TableWatch<T>[],
  onData: (data: T) => void,
  onError: (err: unknown) => void,
  isSettled?: (data: T) => boolean,
): () => void {
  let entry = registry.get(key) as Entry<T> | undefined;

  if (!entry) {
    const listeners = new Set<Listener<T>>();
    let inFlight: Promise<void> | null = null;
    let inFlightFull = false;

    const isSettledNow = () => entry!.lastData !== null && (isSettled?.(entry!.lastData) ?? false);

    // postgres_changes isn't guaranteed delivery — a backgrounded tab or a
    // brief websocket drop can silently miss an event. This bounds how long
    // any client can stay out of sync without noticing — a rare-miss
    // fallback, not the primary sync path (that's realtime, below). It only
    // runs while the app is in the foreground and the data isn't settled —
    // a hidden tab or a finished match used to keep polling indefinitely.
    const updatePoll = () => {
      // A fetch still in flight when the last listener left resolves after
      // teardown — don't let it start a timer nothing will ever clear.
      if (registry.get(key) !== entry) return;
      const shouldPoll = AppState.currentState === 'active' && !isSettledNow();
      if (shouldPoll && !entry!.pollTimer) {
        entry!.pollTimer = setInterval(fetchAndBroadcast, POLL_MS);
      } else if (!shouldPoll && entry!.pollTimer) {
        clearInterval(entry!.pollTimer);
        entry!.pollTimer = null;
      }
    };

    // What the next sync still has to fetch: everything, or just the partial
    // refetches of the tables that changed. Realtime changes accumulate here
    // over the debounce window (and while another fetch is in flight), so a
    // burst of score writes costs one scores reload, not one per write.
    let pendingFull = false;
    const pendingPartials = new Set<(prev: T) => Promise<T>>();

    const runSync = () => {
      if (inFlight) return; // picked up when the in-flight fetch settles
      const prev = entry!.lastData;
      const wantsFull = pendingFull;
      const partials = [...pendingPartials];
      pendingFull = false;
      pendingPartials.clear();
      if (!wantsFull && partials.length === 0) return;

      inFlightFull = wantsFull || prev === null;
      const work =
        wantsFull || prev === null ? fetchFn() : partials.reduce<Promise<T>>((acc, refetch) => acc.then(refetch), Promise.resolve(prev));
      inFlight = work
        .then((data) => {
          entry!.lastData = data;
          listeners.forEach((l) => l.onData(data));
          updatePoll();
        })
        .catch((err) => {
          listeners.forEach((l) => l.onError(err));
        })
        .finally(() => {
          inFlight = null;
          // A realtime change that landed mid-fetch may not be in what this
          // fetch read — run it now rather than leaving it to the next poll.
          if (registry.get(key) === entry && (pendingFull || pendingPartials.size > 0)) runSync();
        });
    };

    const fetchAndBroadcast = () => {
      // A poll tick, a resume and a forced refresh can land close together;
      // if a full fetch for this key is already in flight, let its result
      // cover whoever asked instead of firing a second overlapping request.
      // (A partial one in flight doesn't cover it — queue the full behind it.)
      if (inFlight && inFlightFull) return;
      pendingFull = true;
      runSync();
    };

    const scheduleSync = (watch: TableWatch<T>) => {
      if (watch.refetch) pendingPartials.add(watch.refetch);
      else pendingFull = true;
      if (entry!.syncTimer) clearTimeout(entry!.syncTimer);
      entry!.syncTimer = setTimeout(() => {
        entry!.syncTimer = null;
        runSync();
      }, 250);
    };

    let channelBuilder = supabase.channel(key);
    for (const t of tables) {
      channelBuilder = channelBuilder.on('postgres_changes', { event: '*', schema: 'public', table: t.table, filter: t.filter }, () => scheduleSync(t));
    }
    const channel = channelBuilder.subscribe();

    // Coming back to the foreground is exactly when missed realtime events
    // are most likely, so catch up straight away rather than waiting out a
    // poll interval.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !isSettledNow()) fetchAndBroadcast();
      updatePoll();
    });

    entry = { listeners, channel, pollTimer: null, syncTimer: null, appStateSub, lastData: null, fetchAndBroadcast };
    registry.set(key, entry as Entry<unknown>);
    updatePoll();
  }

  const listener: Listener<T> = { onData, onError };
  entry.listeners.add(listener);
  if (entry.lastData !== null) onData(entry.lastData);
  else entry.fetchAndBroadcast();

  return () => {
    const current = registry.get(key) as Entry<T> | undefined;
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size === 0) {
      if (current.syncTimer) clearTimeout(current.syncTimer);
      if (current.pollTimer) clearInterval(current.pollTimer);
      current.appStateSub.remove();
      supabase.removeChannel(current.channel);
      registry.delete(key);
    }
  };
}

/** Forces an immediate re-fetch + broadcast for `key`, if anyone's currently joined to it. */
export function refreshMatchSync(key: string): void {
  const entry = registry.get(key);
  if (entry) entry.fetchAndBroadcast();
}
