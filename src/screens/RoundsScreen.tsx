import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronRight, CircleCheckBig, SlidersHorizontal, Trash2 } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { BottomNav } from '../components/BottomNav';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { IconButton } from '../components/IconButton';
import { NotificationBell } from '../components/NotificationBell';
import { deleteMatch } from '../data/matches';
import type { RoundSummary } from '../data/rounds';
import { fetchRoundSummaries } from '../data/rounds';
import { moneyLabel } from '../data/round';
import { useNotificationCount } from '../hooks/useNotificationCount';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../state/AuthContext';
import { colors, getFontFamily, getPlayerColors, palette, radius, screenGutter, shadows, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Rounds'>;

type RoundsTab = 'live' | 'past';

function initialsFor(round: RoundSummary): string[] {
  return round.players.map((p) => p.name.charAt(0).toUpperCase());
}

function shortDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
}

export function RoundsScreen({ navigation, route }: Props) {
  const { session } = useAuth();
  const viewerId = session?.user.id ?? null;
  const notificationCount = useNotificationCount(viewerId);
  const [tab, setTab] = useState<RoundsTab>(route.params?.initialTab ?? 'live');
  const [liveRounds, setLiveRounds] = useState<RoundSummary[]>([]);
  const [pastRounds, setPastRounds] = useState<RoundSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmRound, setConfirmRound] = useState<RoundSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!viewerId) return;
    const [live, past] = await Promise.all([fetchRoundSummaries(viewerId, 'live'), fetchRoundSummaries(viewerId, 'finished')]);
    setLiveRounds(live);
    setPastRounds(past);
  }, [viewerId]);

  // Refetch every time this screen gains focus — the viewer just as often
  // arrives here right after finishing a round (from Recap) or starting one
  // (from Match Lobby) as from cold mount.
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch((err) => setLoadError(err instanceof Error ? err.message : "Couldn't load your rounds."))
        .finally(() => setLoading(false));
    }, [load]),
  );

  function openLiveRound(round: RoundSummary) {
    navigation.navigate('Scorecard', {
      matchId: round.matchId,
      matchName: round.matchName,
      courseName: round.courseName,
      gameModeName: round.gameModeName,
      isHost: false,
    });
  }

  function openPastRound(round: RoundSummary) {
    navigation.navigate('Recap', {
      matchId: round.matchId,
      matchName: round.matchName,
      courseName: round.courseName,
      gameModeName: round.gameModeName,
    });
  }

  function showToast(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }

  async function confirmDeleteRound() {
    if (!confirmRound || deleting) return;
    setDeleting(true);
    try {
      await deleteMatch(confirmRound.matchId);
      setLiveRounds((prev) => prev.filter((r) => r.matchId !== confirmRound.matchId));
      showToast(`${confirmRound.matchName} deleted`);
      setConfirmRound(null);
    } catch {
      // Leave the sheet open — the confirm/cancel buttons stay tappable so they can retry or back out.
    } finally {
      setDeleting(false);
    }
  }

  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Rounds</Text>
          <View style={styles.headerActions}>
            <NotificationBell count={notificationCount} onPress={() => navigation.navigate('Notifications')} />
            <IconButton icon={SlidersHorizontal} iconSize={17} />
          </View>
        </View>

        <View style={styles.segmentWrap}>
          <SegmentedControl tab={tab} liveCount={liveRounds.length} onChange={setTab} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {loadError ? <Text style={styles.stateText}>{loadError}</Text> : null}
          {!loadError && loading ? <Text style={styles.stateText}>Loading rounds…</Text> : null}

          {!loading && !loadError && tab === 'live' ? (
            liveRounds.length > 0 ? (
              <View style={styles.liveList}>
                {liveRounds.map((round) => (
                  <LiveRoundCard
                    key={round.matchId}
                    round={round}
                    isHost={round.hostId === viewerId}
                    onResume={() => openLiveRound(round)}
                    onDelete={() => setConfirmRound(round)}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.stateText}>No live rounds right now — start one from Home.</Text>
            )
          ) : null}

          {!loading && !loadError && tab === 'past' ? (
            pastRounds.length > 0 ? (
              <View style={styles.pastList}>
                {pastRounds.map((round) => (
                  <PastRoundRow key={round.matchId} round={round} onPress={() => openPastRound(round)} />
                ))}
              </View>
            ) : (
              <Text style={styles.stateText}>No past rounds yet.</Text>
            )
          ) : null}
        </ScrollView>

        <BottomNav
          active="rounds"
          onNavigate={(navTab) => {
            if (navTab === 'home') navigation.navigate('Home');
            if (navTab === 'kaki') navigation.navigate('Kaki');
            if (navTab === 'profile') navigation.navigate('Profile');
          }}
          onStart={() => navigation.navigate('SelectCourse')}
        />

        <DeleteRoundSheet round={confirmRound} deleting={deleting} onCancel={() => setConfirmRound(null)} onConfirm={confirmDeleteRound} />

        {toast ? (
          <View style={styles.toastWrap} pointerEvents="none">
            <View style={styles.toast}>
              <CircleCheckBig size={16} color={palette.green[300]} />
              <Text style={styles.toastLabel}>{toast}</Text>
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

// Static, not pulsing — temporary experiment to check whether iOS Safari's
// tap unresponsiveness is caused by continuous JS-driven Animated loops
// (useNativeDriver doesn't offload to a native thread on web the way it does
// in the native app). This one's the likeliest offender: one loop per live
// round card, all running at once on the Live tab. Revert if this doesn't help.
function PulseDot({ color, size = 7 }: { color: string; size?: number }) {
  return <View style={[styles.pulseDot, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]} />;
}

function SegmentedControl({
  tab,
  liveCount,
  onChange,
}: {
  tab: RoundsTab;
  liveCount: number;
  onChange: (tab: RoundsTab) => void;
}) {
  return (
    <View style={styles.segmentTrack}>
      <Pressable style={[styles.segment, tab === 'live' && styles.segmentActive]} onPress={() => onChange('live')}>
        <PulseDot color={tab === 'live' ? colors.accent : palette.sand[400]} />
        <Text style={[styles.segmentLabel, tab === 'live' && styles.segmentLabelActive]}>Live</Text>
        <View style={[styles.segmentCount, tab === 'live' ? styles.segmentCountActive : styles.segmentCountInactive]}>
          <Text style={[styles.segmentCountLabel, tab === 'live' ? styles.segmentCountLabelActive : styles.segmentCountLabelInactive]}>
            {liveCount}
          </Text>
        </View>
      </Pressable>
      <Pressable style={[styles.segment, tab === 'past' && styles.segmentActive]} onPress={() => onChange('past')}>
        <Text style={[styles.segmentLabel, tab === 'past' && styles.segmentLabelActive]}>Past</Text>
      </Pressable>
    </View>
  );
}

function PlayerAvatarStack({ players, onGreen }: { players: string[]; onGreen: boolean }) {
  return (
    <View style={styles.avatarStack}>
      {players.map((initial, index) => {
        const playerColor = getPlayerColors(index);
        return (
          <View
            key={`${initial}-${index}`}
            style={[
              styles.stackedAvatar,
              index > 0 && styles.stackedAvatarOverlap,
              { backgroundColor: playerColor.background, borderColor: onGreen ? colors.primary : colors.surfaceCard },
            ]}
          >
            <Text style={[styles.stackedAvatarLabel, { color: playerColor.color }]}>{initial}</Text>
          </View>
        );
      })}
    </View>
  );
}

function LiveRoundCard({
  round,
  isHost,
  onResume,
  onDelete,
}: {
  round: RoundSummary;
  isHost: boolean;
  onResume: () => void;
  onDelete: () => void;
}) {
  const up = round.viewerUp ?? 0;
  const scoreValue = round.viewerUp === null ? '–' : String(Math.abs(up));
  const scoreUnit = round.viewerUp === null ? '' : up > 0 ? 'up' : up < 0 ? 'down' : 'square';
  const sub = [round.courseName, round.comboLabel, `Thru ${round.thru}`].filter(Boolean).join(' · ');

  return (
    <Card variant="inverse" watermark>
      <View style={styles.liveCardTop}>
        <View style={styles.liveCardInfo}>
          <View style={styles.liveOverlineRow}>
            <PulseDot color={colors.accent} size={7} />
            <Text style={styles.liveOverline}>
              Live · {round.gameModeName}
            </Text>
          </View>
          <Text style={styles.liveTitle}>{round.matchName}</Text>
          <Text style={styles.liveSubtitle}>{sub}</Text>
        </View>
        <View style={styles.liveScoreWrap}>
          <Text style={styles.liveScoreValue}>{scoreValue}</Text>
          <Text style={styles.liveScoreUnit}>{scoreUnit}</Text>
        </View>
      </View>
      <View style={styles.liveCardBottom}>
        <PlayerAvatarStack players={initialsFor(round)} onGreen />
        <View style={styles.liveCardActions}>
          {isHost ? (
            <Pressable style={styles.deleteButton} onPress={onDelete}>
              <Trash2 size={17} color="rgba(255,255,255,0.8)" />
            </Pressable>
          ) : null}
          <Button
            label="Resume"
            variant="accent"
            size="sm"
            icon={<ChevronRight size={16} color={colors.textOnAccent} />}
            iconPosition="right"
            onPress={onResume}
          />
        </View>
      </View>
    </Card>
  );
}

function DeleteRoundSheet({
  round,
  deleting,
  onCancel,
  onConfirm,
}: {
  round: RoundSummary | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal transparent visible={round !== null} animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.sheetScrim} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetIcon}>
            <Trash2 size={21} color={colors.statusDanger} />
          </View>
          <Text style={styles.sheetTitle}>Delete this live round?</Text>
          <Text style={styles.sheetBody}>
            <Text style={styles.sheetBodyStrong}>{round?.matchName}</Text> will be removed for{' '}
            <Text style={styles.sheetBodyStrong}>all players</Text> and every score entered so far will be lost. This can't be undone.
          </Text>
          <View style={styles.sheetActions}>
            <Pressable style={styles.sheetCancelButton} onPress={onCancel} disabled={deleting}>
              <Text style={styles.sheetCancelLabel}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.sheetDeleteButton} onPress={onConfirm} disabled={deleting}>
              <Text style={styles.sheetDeleteLabel}>{deleting ? 'Deleting…' : 'Delete'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PastRoundRow({ round, onPress }: { round: RoundSummary; onPress: () => void }) {
  const money = round.viewerMoney ?? 0;
  const moneyColor = money > 0 ? colors.statusSuccess : money < 0 ? colors.statusDanger : colors.textDisabled;
  const club = [round.courseName, round.comboLabel].filter(Boolean).join(' · ');

  return (
    <Pressable onPress={onPress}>
    <Card>
      <View style={styles.pastTopRow}>
        <View style={styles.pastInfo}>
          <Text style={styles.pastName} numberOfLines={1}>
            {round.matchName}
          </Text>
          <Text style={styles.pastMeta} numberOfLines={1}>
            {club} · {shortDate(round.finishedAt)}
          </Text>
        </View>
        <View style={styles.pastScoreWrap}>
          <Text style={styles.pastGross}>{round.viewerGross ?? '–'}</Text>
          <Text style={styles.pastGrossLabel}>gross</Text>
          <Text style={[styles.pastMoney, { color: moneyColor }]}>{round.viewerMoney === null ? '' : moneyLabel(money)}</Text>
        </View>
      </View>
      <PlayerAvatarStack players={initialsFor(round)} onGreen={false} />
    </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.surfacePage,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenGutter,
    paddingTop: screenGutter,
  },
  headerTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 22,
    color: colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 2,
  },
  segmentWrap: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[3] + 2,
    paddingBottom: spacing[2],
  },
  segmentTrack: {
    flexDirection: 'row',
    gap: 3,
    backgroundColor: palette.sand[300],
    borderRadius: radius.pill,
    padding: 3,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1] + 3,
    paddingVertical: spacing[2] + 1,
    borderRadius: radius.pill,
  },
  segmentActive: {
    backgroundColor: colors.surfaceCard,
    shadowColor: '#0E3A28',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.textDisabled,
  },
  segmentLabelActive: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    color: colors.primary,
  },
  segmentCount: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: spacing[1] + 1,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentCountActive: {
    backgroundColor: palette.orange[100],
  },
  segmentCountInactive: {
    backgroundColor: palette.sand[300],
  },
  segmentCountLabel: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 11,
  },
  segmentCountLabelActive: {
    color: palette.orange[600],
  },
  segmentCountLabelInactive: {
    color: colors.textDisabled,
  },
  pulseDot: {
    flexShrink: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingBottom: spacing[7],
  },
  stateText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: colors.textDisabled,
    textAlign: 'center',
    marginTop: spacing[5],
  },
  liveList: {
    gap: spacing[3] + 2,
  },
  liveCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  liveCardInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing[2] + 2,
  },
  liveOverlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 3,
    marginBottom: spacing[1] + 3,
  },
  liveOverline: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 1.4,
    color: palette.orange[300],
    textTransform: 'uppercase',
  },
  liveTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 20,
    color: palette.white,
  },
  liveSubtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 4,
  },
  liveScoreWrap: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  liveScoreValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 28,
    lineHeight: 28,
    color: palette.green[300],
  },
  liveScoreUnit: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  liveCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[4],
  },
  liveCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 2,
  },
  deleteButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarStack: {
    flexDirection: 'row',
  },
  stackedAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackedAvatarOverlap: {
    marginLeft: -9,
  },
  stackedAvatarLabel: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 11,
  },
  pastList: {
    gap: spacing[2] + 2,
  },
  pastTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  pastInfo: {
    flex: 1,
    minWidth: 0,
  },
  pastName: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 16,
    color: colors.textPrimary,
  },
  pastMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    marginTop: 2,
  },
  pastScoreWrap: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  pastGross: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 22,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  pastGrossLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  pastMoney: {
    fontFamily: getFontFamily('numeric', '600'),
    fontWeight: '600',
    fontSize: 12,
    marginTop: 3,
  },
  sheetScrim: {
    flex: 1,
    backgroundColor: 'rgba(20,32,24,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surfaceCard,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing[6],
    paddingBottom: spacing[7],
  },
  sheetIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(178,59,46,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3] + 2,
  },
  sheetTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 19,
    color: colors.textPrimary,
  },
  sheetBody: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textMuted,
    marginTop: spacing[2],
  },
  sheetBodyStrong: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing[2] + 2,
    marginTop: spacing[5] + 2,
  },
  sheetCancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.sand[300],
    borderRadius: radius.md,
    paddingVertical: spacing[3] + 2,
  },
  sheetCancelLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 15,
    color: colors.textSecondary,
  },
  sheetDeleteButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.statusDanger,
    borderRadius: radius.md,
    paddingVertical: spacing[3] + 2,
    ...shadows.md,
  },
  sheetDeleteLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: palette.white,
  },
  toastWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 100,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
    backgroundColor: colors.textPrimary,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4] + 2,
    borderRadius: radius.pill,
    ...shadows.lg,
  },
  toastLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13.5,
    color: palette.white,
  },
});
