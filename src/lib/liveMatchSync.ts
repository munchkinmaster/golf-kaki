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

import { supabase } from './supabase';

type TableWatch = { table: string; filter: string };
type Listener<T> = { onData: (data: T) => void; onError: (err: unknown) => void };

type Entry<T> = {
  listeners: Set<Listener<T>>;
  channel: ReturnType<typeof supabase.channel>;
  pollTimer: ReturnType<typeof setInterval>;
  syncTimer: ReturnType<typeof setTimeout> | null;
  lastData: T | null;
  fetchAndBroadcast: () => void;
};

const registry = new Map<string, Entry<unknown>>();

/**
 * Join the shared subscription for `key`, creating it if this is the first
 * joiner. Returns an unsubscribe function — call it on unmount.
 *
 * `fetchFn` and `tables` are only actually used when this call creates the
 * entry; a joiner arriving after the entry already exists reuses whatever
 * the first joiner registered. That's safe here because every caller for a
 * given key (i.e. every live-round screen for the same matchId) fetches and
 * watches the exact same thing — see useLiveRound/useTournamentRound.
 */
export function joinMatchSync<T>(
  key: string,
  fetchFn: () => Promise<T>,
  tables: TableWatch[],
  onData: (data: T) => void,
  onError: (err: unknown) => void,
): () => void {
  let entry = registry.get(key) as Entry<T> | undefined;

  if (!entry) {
    const listeners = new Set<Listener<T>>();
    let inFlight: Promise<void> | null = null;

    const fetchAndBroadcast = () => {
      // A poll tick and a debounced realtime event can land close together;
      // if a fetch for this key is already in flight, let its result cover
      // whoever asked instead of firing a second overlapping request.
      if (inFlight) return;
      inFlight = fetchFn()
        .then((data) => {
          entry!.lastData = data;
          listeners.forEach((l) => l.onData(data));
        })
        .catch((err) => {
          listeners.forEach((l) => l.onError(err));
        })
        .finally(() => {
          inFlight = null;
        });
    };

    let syncTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleSync = () => {
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(fetchAndBroadcast, 250);
    };

    let channelBuilder = supabase.channel(key);
    for (const t of tables) {
      channelBuilder = channelBuilder.on('postgres_changes', { event: '*', schema: 'public', table: t.table, filter: t.filter }, scheduleSync);
    }
    const channel = channelBuilder.subscribe();

    // postgres_changes isn't guaranteed delivery — a backgrounded tab or a
    // brief websocket drop can silently miss an event. This bounds how long
    // any client can stay out of sync without noticing — a rare-miss
    // fallback, not the primary sync path (that's realtime, above).
    const pollTimer = setInterval(fetchAndBroadcast, 20000);

    entry = { listeners, channel, pollTimer, syncTimer, lastData: null, fetchAndBroadcast };
    registry.set(key, entry as Entry<unknown>);
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
      clearInterval(current.pollTimer);
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
