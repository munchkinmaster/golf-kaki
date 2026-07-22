import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from './AuthContext';
import { Avatar } from '../components/Avatar';
import type { MatchInvite } from '../data/matches';
import { fetchMatchInvites } from '../data/matches';
import { getInitials } from '../data/profile';
import { supabase } from '../lib/supabase';
import { navigationRef } from '../navigation/navigationRef';
import { colors, getFontFamily, getPlayerColors, motion, palette, radius, shadows, spacing } from '../theme/tokens';

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 10000;
const DISMISS_THRESHOLD = 45;
const CARD_HEIGHT = 72;
const STACK_OFFSET = 9;

/**
 * Global "New invite" push toast — mounted once at the app root (see App.tsx)
 * so it can surface over whatever screen the viewer is actually on, not just
 * Home. Subscribes to match_players INSERTs for the signed-in viewer (already
 * on the supabase_realtime publication — see the Match Lobby realtime
 * migration) and stacks up to 3 at a time. "View" is deliberately a nudge to
 * the Notifications screen rather than a shortcut into the match itself — the
 * invite hasn't been accepted yet, so there's nothing to view there.
 */
export function InviteToastProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const viewerId = session?.user.id ?? null;
  const [queue, setQueue] = useState<MatchInvite[]>([]);
  const seenMatchIds = useRef(new Set<string>());

  useEffect(() => {
    seenMatchIds.current = new Set();
    setQueue([]);
    if (!viewerId) return;

    const channel = supabase
      .channel(`invite-toasts-${viewerId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'match_players', filter: `player_id=eq.${viewerId}` },
        (payload) => {
          const row = payload.new as { match_id: string; status: string };
          if (row.status !== 'invited' || seenMatchIds.current.has(row.match_id)) return;
          fetchMatchInvites(viewerId)
            .then((invites) => {
              const invite = invites.find((i) => i.matchId === row.match_id);
              if (!invite || seenMatchIds.current.has(invite.matchId)) return;
              seenMatchIds.current.add(invite.matchId);
              setQueue((prev) => [...prev, invite]);
            })
            .catch(() => {});
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [viewerId]);

  const dismiss = useCallback((matchId: string) => {
    setQueue((prev) => prev.filter((i) => i.matchId !== matchId));
  }, []);

  const onView = useCallback((invite: MatchInvite) => {
    dismiss(invite.matchId);
    if (navigationRef.isReady()) navigationRef.navigate('Notifications');
  }, [dismiss]);

  return (
    <>
      {children}
      <InviteToastStack queue={queue.slice(0, MAX_VISIBLE)} onDismiss={dismiss} onView={onView} />
    </>
  );
}

function InviteToastStack({
  queue,
  onDismiss,
  onView,
}: {
  queue: MatchInvite[];
  onDismiss: (matchId: string) => void;
  onView: (invite: MatchInvite) => void;
}) {
  if (queue.length === 0) return null;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.stackWrap} pointerEvents="box-none">
          {queue.map((invite, index) => (
            <InviteToastCard
              key={invite.matchId}
              invite={invite}
              index={index}
              isFront={index === 0}
              onDismiss={() => onDismiss(invite.matchId)}
              onView={() => onView(invite)}
            />
          ))}
        </View>
      </View>
    </Modal>
  );
}

function InviteToastCard({
  invite,
  index,
  isFront,
  onDismiss,
  onView,
}: {
  invite: MatchInvite;
  index: number;
  isFront: boolean;
  onDismiss: () => void;
  onView: () => void;
}) {
  const stackY = useRef(new Animated.Value(-140)).current;
  const stackOpacity = useRef(new Animated.Value(0)).current;
  const stackScale = useRef(new Animated.Value(1)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissedRef = useRef(false);

  const restingY = index * STACK_OFFSET;
  const restingOpacity = 1 - index * 0.12;
  const restingScale = 1 - index * 0.045;

  // Entrance (new card only) or reposition (an existing card promoting up the
  // stack as the one in front of it gets dismissed) — same values, just a
  // slower/plainer transition once it's already on screen.
  const hasEnteredRef = useRef(false);
  useEffect(() => {
    const entering = !hasEnteredRef.current;
    hasEnteredRef.current = true;
    const [c1, c2, c3, c4] = entering ? motion.easing.bounce : motion.easing.out;
    Animated.parallel([
      Animated.timing(stackY, {
        toValue: restingY,
        duration: entering ? 500 : 280,
        easing: Easing.bezier(c1, c2, c3, c4),
        useNativeDriver: false,
      }),
      Animated.timing(stackOpacity, {
        toValue: restingOpacity,
        duration: entering ? 500 : 280,
        easing: Easing.bezier(...motion.easing.out),
        useNativeDriver: false,
      }),
      Animated.timing(stackScale, {
        toValue: restingScale,
        duration: entering ? 500 : 280,
        easing: Easing.bezier(...motion.easing.out),
        useNativeDriver: false,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restingY, restingOpacity, restingScale]);

  const triggerDismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    Animated.parallel([
      Animated.timing(dragY, { toValue: -140 - restingY, duration: 250, easing: Easing.bezier(...motion.easing.out), useNativeDriver: false }),
      Animated.timing(stackOpacity, { toValue: 0, duration: 250, easing: Easing.bezier(...motion.easing.out), useNativeDriver: false }),
    ]).start(({ finished }) => {
      if (finished) onDismiss();
    });
  }, [dragY, onDismiss, restingY, stackOpacity]);

  // Auto-dismiss the front card after ~10s if the viewer never touches it —
  // re-armed for whichever card is newly promoted to front.
  useEffect(() => {
    if (!isFront) return;
    dismissTimer.current = setTimeout(triggerDismiss, AUTO_DISMISS_MS);
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [isFront, triggerDismiss]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isFront,
      onMoveShouldSetPanResponder: (_evt, gesture) => isFront && Math.abs(gesture.dy) > 4,
      onPanResponderGrant: () => {
        if (dismissTimer.current) clearTimeout(dismissTimer.current);
      },
      onPanResponderMove: (_evt, gesture) => {
        dragY.setValue(Math.min(0, gesture.dy));
      },
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dy < -DISMISS_THRESHOLD) {
          triggerDismiss();
          return;
        }
        Animated.timing(dragY, { toValue: 0, duration: 200, easing: Easing.bezier(...motion.easing.out), useNativeDriver: false }).start();
        dismissTimer.current = setTimeout(triggerDismiss, AUTO_DISMISS_MS);
      },
    }),
  ).current;

  const dragOpacity = dragY.interpolate({ inputRange: [-90, 0], outputRange: [0, 1], extrapolate: 'clamp' });
  const playerColor = getPlayerColors(0);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          zIndex: MAX_VISIBLE - index,
          opacity: Animated.multiply(stackOpacity, dragOpacity),
          transform: [{ translateY: Animated.add(stackY, dragY) }, { scale: stackScale }],
        },
      ]}
      pointerEvents={isFront ? 'auto' : 'none'}
      {...(isFront ? panResponder.panHandlers : {})}
    >
      <View style={styles.grabHandle} />
      <View style={styles.cardRow}>
        <Avatar initials={getInitials(invite.hostName)} size={40} backgroundColor={playerColor.background} color={playerColor.color} />
        <View style={styles.cardBody}>
          <View style={styles.overlineRow}>
            <View style={styles.liveDot} />
            <Text style={styles.overline}>New invite</Text>
          </View>
          <Text style={styles.cardText}>
            <Text style={styles.cardTextStrong}>{invite.hostName}</Text> invited you to <Text style={styles.cardTextStrong}>{invite.matchName}</Text>
          </Text>
        </View>
        <Pressable onPress={onView}>
          <View style={styles.viewButton}>
            <Text style={styles.viewButtonLabel}>View</Text>
          </View>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  stackWrap: {
    position: 'absolute',
    top: 46,
    left: '50%',
    marginLeft: -162,
    width: 324,
    height: CARD_HEIGHT,
  },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing[3],
    ...shadows.xl,
  },
  grabHandle: {
    alignSelf: 'center',
    width: 34,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginBottom: spacing[2],
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  overlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
    marginBottom: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  overline: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.orange[300],
  },
  cardText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
  },
  cardTextStrong: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    color: palette.white,
  },
  viewButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3] + 2,
    borderRadius: radius.pill,
  },
  viewButtonLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.primary,
  },
});
