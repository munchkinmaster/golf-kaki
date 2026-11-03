/**
 * A screen's own realtime channel + fallback poll, live only while that
 * screen is focused and the app is in the foreground.
 *
 * Why: React Navigation keeps earlier stack screens mounted underneath the
 * current one, so a channel + poll set up in a plain useEffect keeps running
 * for as long as the screen exists — TournamentLobby sits under the
 * scorecard for a whole round, reloading the lobby and the multi-round
 * results every 20s that nobody could see. Scoping it to focus is safe
 * because every screen using this also reloads on focus, which covers
 * whatever changed while it was hidden; coming back to the foreground
 * reloads straight away for the same reason.
 *
 * For a live round's data (shared across several screens at once), see
 * lib/liveMatchSync.ts instead.
 */

import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { POLL_MS } from '../lib/liveMatchSync';
import { supabase } from '../lib/supabase';

export type RealtimeWatch = { table: string; filter: string; event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE' };

/**
 * `channelName` null = nothing to watch yet (e.g. no matchId). `onChange`
 * may change identity freely — the latest one is always called, without
 * resubscribing.
 */
export function useFocusedRealtime(channelName: string | null, watches: RealtimeWatch[], onChange: () => void) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const watchesKey = JSON.stringify(watches);

  useFocusEffect(
    useCallback(() => {
      if (!channelName) return;
      const parsed = JSON.parse(watchesKey) as RealtimeWatch[];

      let syncTimer: ReturnType<typeof setTimeout> | null = null;
      const scheduleSync = () => {
        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = setTimeout(() => {
          syncTimer = null;
          onChangeRef.current();
        }, 250);
      };

      let channelBuilder = supabase.channel(channelName);
      for (const w of parsed) {
        channelBuilder = channelBuilder.on('postgres_changes', { event: w.event ?? '*', schema: 'public', table: w.table, filter: w.filter }, scheduleSync);
      }
      const channel = channelBuilder.subscribe();

      // postgres_changes isn't guaranteed delivery — bounds how long this
      // screen can stay out of sync without noticing, while anyone can see it.
      let pollTimer: ReturnType<typeof setInterval> | null = null;
      const updatePoll = () => {
        const shouldPoll = AppState.currentState === 'active';
        if (shouldPoll && !pollTimer) pollTimer = setInterval(() => onChangeRef.current(), POLL_MS);
        else if (!shouldPoll && pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      };
      updatePoll();
      const appStateSub = AppState.addEventListener('change', (state) => {
        if (state === 'active') onChangeRef.current();
        updatePoll();
      });

      return () => {
        if (syncTimer) clearTimeout(syncTimer);
        if (pollTimer) clearInterval(pollTimer);
        appStateSub.remove();
        supabase.removeChannel(channel);
      };
    }, [channelName, watchesKey]),
  );
}
