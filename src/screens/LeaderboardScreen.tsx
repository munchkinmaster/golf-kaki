import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  CircleCheckBig,
  Coffee,
  Crown,
  List,
  RefreshCw,
  Swords,
  Trophy,
  Users,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { holeUpValue, money, record, runningUp, upLabel } from '../data/round';
import type { GrossMap, Hole, RoundSchedule, StrokeDeal } from '../data/round';
import { useLiveRound } from '../hooks/useLiveRound';
import type { RootStackParamList } from '../navigation/types';
import { colors, getFontFamily, getPlayerColors, palette, radius, screenGutter, shadows, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Leaderboard'>;

type Track = { n: number; label: string; up: boolean; down: boolean };

function buildTrack(
  playerId: string,
  players: string[],
  thru: number,
  gross: GrossMap,
  holes: Hole[],
  frontNineDeals: StrokeDeal[],
  schedule: RoundSchedule,
  backNineDeals: StrokeDeal[] | null,
): Track[] {
  const track: Track[] = [];
  for (let i = 0; i < thru; i++) {
    const net = holeUpValue(players, playerId, i, gross, holes, frontNineDeals, schedule, backNineDeals);
    track.push({
      n: holes[i]!.n,
      label: net > 0 ? `${net}↑` : net < 0 ? `${-net}↓` : 'AS',
      up: net > 0,
      down: net < 0,
    });
  }
  return track;
}

function recordLabel(
  playerId: string,
  players: string[],
  thru: number,
  gross: GrossMap,
  holes: Hole[],
  frontNineDeals: StrokeDeal[],
  schedule: RoundSchedule,
  backNineDeals: StrokeDeal[] | null,
) {
  const { w, l, h } = record(players, playerId, thru, gross, holes, frontNineDeals, schedule, backNineDeals);
  return `${w}W ${l}L ${h}H`;
}

/**
 * The per-hole track row, as its own component so the drag-to-scroll effect
 * below can hook a fresh `ScrollView` ref each time a different player's
 * panel expands (only one panel is ever mounted at a time).
 *
 * RN's `ScrollView` only picks up trackpad/scrollbar/touch input for
 * horizontal panning — a mouse click-drag does nothing, since the underlying
 * web `<div>` doesn't listen for that. With 18 holes and no scroll indicator,
 * a desktop/web tester has no way to see holes past what fits on screen. Wire
 * up manual pointer-drag panning on web only; native touch scrolling on
 * iOS/Android already works without this.
 */
function HoleTrack({ track }: { track: Track[] }) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = (scrollRef.current as unknown as { getScrollableNode?: () => HTMLElement } | null)?.getScrollableNode?.();
    if (!node) return;

    let dragging = false;
    let startX = 0;
    let startScrollLeft = 0;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      startX = e.clientX;
      startScrollLeft = node.scrollLeft;
      node.setPointerCapture(e.pointerId);
      node.style.cursor = 'grabbing';
      e.preventDefault();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      node.scrollLeft = startScrollLeft - (e.clientX - startX);
    };
    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      node.style.cursor = 'grab';
      if (node.hasPointerCapture(e.pointerId)) node.releasePointerCapture(e.pointerId);
    };

    node.style.cursor = 'grab';
    node.style.userSelect = 'none';
    node.addEventListener('pointerdown', onPointerDown);
    node.addEventListener('pointermove', onPointerMove);
    node.addEventListener('pointerup', onPointerUp);
    node.addEventListener('pointercancel', onPointerUp);

    return () => {
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('pointermove', onPointerMove);
      node.removeEventListener('pointerup', onPointerUp);
      node.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  return (
    <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trackRow}>
      {track.map((c) => (
        <View key={c.n} style={styles.trackChipColumn}>
          <Text style={styles.trackChipHole}>{c.n}</Text>
          <View style={[styles.trackChip, c.up ? styles.trackChipUp : c.down ? styles.trackChipDown : styles.trackChipFlat]}>
            <Text style={[styles.trackChipLabel, (c.up || c.down) && styles.trackChipLabelStrong]}>{c.label}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

export function LeaderboardScreen({ navigation, route }: Props) {
  const { matchId, matchName, courseName, gameModeName } = route.params;
  const { loading, viewerId, hostId, roster, holes, schedule, gross, thru, frontNineDeals, backNineDeals, stakePerHole, refresh: refreshRound } =
    useLiveRound(matchId);

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;

  function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    refreshRound();
    spin.setValue(0);
    Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }).start(() => {
      setRefreshing(false);
    });
  }

  function toggleExpanded(key: string) {
    setExpandedKey((prev) => (prev === key ? null : key));
  }

  const rosterIds = useMemo(() => roster.map((p) => p.playerId), [roster]);

  const rows = useMemo(() => {
    const ranked = [...roster].sort(
      (a, b) =>
        money(rosterIds, b.playerId, thru, gross, holes, frontNineDeals, schedule, backNineDeals, stakePerHole) -
          money(rosterIds, a.playerId, thru, gross, holes, frontNineDeals, schedule, backNineDeals, stakePerHole) ||
        (a.handicap ?? 0) - (b.handicap ?? 0),
    );
    return ranked.map((p, i) => ({
      player: p,
      leader: i === 0,
      rank: i + 1,
      net: runningUp(rosterIds, p.playerId, thru, gross, holes, frontNineDeals, schedule, backNineDeals),
      track: buildTrack(p.playerId, rosterIds, thru, gross, holes, frontNineDeals, schedule, backNineDeals),
      record: recordLabel(p.playerId, rosterIds, thru, gross, holes, frontNineDeals, schedule, backNineDeals),
    }));
  }, [roster, rosterIds, gross, holes, thru, frontNineDeals, schedule, backNineDeals, stakePerHole]);

  const spinRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <Pressable style={styles.backButton} onPress={() => navigation.navigate('Home')}>
              <ChevronLeft size={20} color="rgba(255,255,255,0.8)" />
            </Pressable>
            <Text style={styles.headerTitle}>Leaderboard</Text>
            <View style={styles.headerActions}>
              <View style={styles.thruBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.thruLabel}>THRU {thru}</Text>
              </View>
              <Pressable style={styles.refreshButton} onPress={refresh}>
                <Animated.View style={{ transform: [{ rotate: spinRotate }] }}>
                  <RefreshCw size={16} color={refreshing ? colors.accent : 'rgba(255,255,255,0.85)'} />
                </Animated.View>
              </Pressable>
            </View>
          </View>
          <View style={styles.liveRow}>
            <View style={styles.liveDotSmall} />
            <Text style={styles.liveCaption}>Live · updated just now · pull to refresh</Text>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.standingsRow}>
            <Swords size={15} color={colors.primary} />
            <Text style={styles.standingsLabel}>Standings counted for</Text>
            <View style={styles.standingsPill}>
              <Text style={styles.standingsPillLabel}>{gameModeName}</Text>
            </View>
          </View>

          {loading ? <Text style={styles.loadingText}>Loading leaderboard…</Text> : null}

          {rows.map(({ player, leader, rank, net, track, record }) => {
            const isViewer = player.playerId === viewerId;
            const isExpanded = expandedKey === player.playerId;
            const upColor = net > 0 ? colors.statusSuccess : net < 0 ? colors.statusDanger : colors.textDisabled;

            const dividerColor = leader ? 'rgba(138,106,18,0.3)' : isViewer ? palette.green[200] : colors.borderSubtle;
            const playerColor = getPlayerColors(rosterIds.indexOf(player.playerId));

            return (
              <View
                key={player.playerId}
                style={[styles.cardWrap, leader ? styles.cardWrapLeader : isViewer ? styles.cardWrapViewer : styles.cardWrapDefault]}
              >
                <Pressable
                  style={[styles.row, leader && styles.rowLeaderPadding]}
                  onPress={() => toggleExpanded(player.playerId)}
                >
                  <View style={styles.rank}>
                    {leader ? (
                      <Crown size={20} color={colors.scoreEagle} />
                    ) : (
                      <Text style={styles.rankNumber}>{rank}</Text>
                    )}
                  </View>
                  <View style={[styles.avatar, leader && styles.avatarLeader, { backgroundColor: playerColor.background }]}>
                    <Text style={[styles.avatarLabel, leader && styles.avatarLabelLeader, { color: playerColor.color }]}>
                      {player.name.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.rowBody}>
                    <View style={styles.nameRow}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {player.name}
                        {isViewer ? ' (You)' : ''}
                      </Text>
                    </View>
                    <Text style={[styles.rowSub, leader && styles.rowSubLeader]}>
                      {player.handicap !== null ? `HCP ${player.handicap} · ` : ''}
                      {record}
                    </Text>
                  </View>
                  <View style={styles.rowEnd}>
                    <Text style={[styles.upValue, { fontSize: leader ? 26 : 20 }, { color: leader ? colors.primary : upColor }]}>
                      {upLabel(net)}
                    </Text>
                    {leader ? <Text style={styles.leaderTag}>Leader</Text> : null}
                  </View>
                  {isExpanded ? (
                    <ChevronUp size={16} color={palette.sand[400]} style={styles.rowChevron} />
                  ) : (
                    <ChevronDown size={16} color={palette.sand[400]} style={styles.rowChevron} />
                  )}
                </Pressable>

                {isExpanded ? (
                  <View style={[styles.expandedPanel, { borderTopColor: dividerColor }]}>
                    <View style={styles.expandedHeader}>
                      <Text style={styles.expandedLabel}>Match status · thru {thru}</Text>
                      <View
                        style={[
                          styles.expandedTotal,
                          { backgroundColor: net > 0 ? 'rgba(35,126,26,0.12)' : net < 0 ? 'rgba(178,59,46,0.12)' : 'rgba(138,149,140,0.14)' },
                        ]}
                      >
                        <Text style={[styles.expandedTotalLabel, { color: upColor }]}>{upLabel(net)}</Text>
                      </View>
                    </View>
                    <HoleTrack track={track} />
                    <Text style={styles.expandedLegend}>
                      Net holes vs the field ·{' '}
                      <Text style={styles.expandedLegendUp}>&uarr;</Text> up ·{' '}
                      <Text style={styles.expandedLegendDown}>&darr;</Text> down · AS all square
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}

          <View style={styles.stakesCard}>
            <View style={styles.stakesHeader}>
              <View style={styles.stakesHeaderLeft}>
                <Coffee size={16} color={palette.orange[700]} />
                <Text style={styles.stakesTitle}>Stakes</Text>
              </View>
              <Text style={styles.stakesMeta}>set in lobby</Text>
            </View>
            <View style={styles.stakesRow}>
              <Text style={styles.stakesDesc}>Teh tarik plus your ego</Text>
              <View style={styles.stakesPill}>
                <Text style={styles.stakesPillLabel}>${stakePerHole} / hole</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.inRoundNav}>
          <Pressable
            style={styles.inRoundTab}
            onPress={() => navigation.navigate('Scorecard', { matchId, matchName, courseName, gameModeName, isHost: viewerId === hostId })}
          >
            <List size={21} color={palette.sand[400]} />
            <Text style={styles.inRoundTabLabel}>Scorecard</Text>
          </Pressable>
          <View style={styles.inRoundTab}>
            <Trophy size={21} color={colors.primary} />
            <Text style={[styles.inRoundTabLabel, styles.inRoundTabLabelActive]}>Leaderboard</Text>
          </View>
          <Pressable
            style={styles.inRoundTab}
            onPress={() => navigation.navigate('InGameLobby', { matchId, matchName, courseName, gameModeName })}
          >
            <Users size={21} color={palette.sand[400]} />
            <Text style={styles.inRoundTabLabel}>Lobby</Text>
          </Pressable>
          <Pressable
            style={styles.inRoundTab}
            onPress={() => navigation.navigate('Finish', { matchId, matchName, courseName, gameModeName })}
          >
            <CircleCheckBig size={21} color={palette.sand[400]} />
            <Text style={styles.inRoundTabLabel}>Finish</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
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
    backgroundColor: colors.primary,
    paddingHorizontal: screenGutter,
    paddingTop: screenGutter,
    paddingBottom: spacing[3] + 2,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  backButton: {
    width: 28,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 18,
    color: palette.white,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexShrink: 0,
  },
  thruBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.pill,
    paddingVertical: spacing[1] + 1,
    paddingHorizontal: spacing[2] + 1,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  thruLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    color: palette.orange[300],
  },
  refreshButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
    marginTop: spacing[2],
  },
  liveDotSmall: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: palette.green[300],
  },
  liveCaption: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
  },
  standingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 3,
    marginBottom: spacing[3] + 2,
  },
  standingsLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textMuted,
  },
  standingsPill: {
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1,
    borderColor: palette.green[200],
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: spacing[2] + 2,
  },
  standingsPillLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 12,
    color: colors.primary,
  },
  loadingText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    marginBottom: spacing[2],
  },
  cardWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing[2] + 2,
  },
  cardWrapDefault: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.xs,
  },
  cardWrapViewer: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: palette.green[200],
    ...shadows.xs,
  },
  cardWrapLeader: {
    backgroundColor: 'rgba(201,138,35,0.16)',
    borderWidth: 1.5,
    borderColor: colors.scoreEagle,
    shadowColor: colors.scoreEagle,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3] + 1,
  },
  rowLeaderPadding: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[3] + 2,
  },
  rank: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rankNumber: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 17,
    color: palette.sand[400],
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarLeader: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: palette.white,
  },
  avatarLabel: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 15,
  },
  avatarLabelLeader: {
    fontSize: 17,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
  },
  rowName: {
    flexShrink: 1,
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.textPrimary,
  },
  rowSub: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: 2,
  },
  rowSubLeader: {
    color: '#7A6320',
  },
  rowEnd: {
    alignItems: 'flex-end',
  },
  upValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    lineHeight: undefined,
  },
  leaderTag: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#7A6320',
    marginTop: 2,
  },
  rowChevron: {
    marginLeft: 2,
  },
  expandedPanel: {
    borderTopWidth: 1,
    padding: spacing[3] + 1,
  },
  expandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2] + 2,
  },
  expandedLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  expandedTotal: {
    borderRadius: radius.pill,
    paddingVertical: spacing[1] + 1,
    paddingHorizontal: spacing[2] + 3,
  },
  expandedTotalLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 12,
  },
  trackRow: {
    flexDirection: 'row',
    gap: spacing[1] + 1,
    paddingBottom: 2,
  },
  trackChipColumn: {
    width: 30,
    alignItems: 'center',
  },
  trackChipHole: {
    fontFamily: getFontFamily('numeric', '400'),
    fontSize: 10,
    color: colors.textDisabled,
    marginBottom: spacing[1],
  },
  trackChip: {
    width: 30,
    height: 24,
    borderRadius: radius.sm - 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackChipUp: {
    backgroundColor: colors.statusSuccess,
  },
  trackChipDown: {
    backgroundColor: colors.statusDanger,
  },
  trackChipFlat: {
    backgroundColor: colors.surfaceSunken,
  },
  trackChipLabel: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 11,
    color: colors.textMuted,
  },
  trackChipLabelStrong: {
    color: palette.white,
  },
  expandedLegend: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    color: colors.textDisabled,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing[2] + 1,
    marginTop: spacing[2],
  },
  expandedLegendUp: {
    color: colors.statusSuccess,
    fontWeight: '700',
  },
  expandedLegendDown: {
    color: colors.statusDanger,
    fontWeight: '700',
  },
  stakesCard: {
    backgroundColor: palette.orange[100],
    borderWidth: 1,
    borderColor: palette.orange[200],
    borderRadius: radius.lg,
    padding: spacing[3] + 2,
    marginTop: spacing[2],
    ...shadows.xs,
  },
  stakesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing[2] + 2,
  },
  stakesHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  stakesTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: palette.orange[700],
  },
  stakesMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: palette.orange[700],
  },
  stakesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stakesDesc: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: colors.textSecondary,
  },
  stakesPill: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: palette.orange[200],
    borderRadius: radius.pill,
    paddingVertical: spacing[1] + 2,
    paddingHorizontal: spacing[3] + 2,
  },
  stakesPillLabel: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.textPrimary,
  },
  inRoundNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
    backgroundColor: colors.surfaceCard,
    paddingTop: spacing[2],
    paddingBottom: spacing[3] + 2,
  },
  inRoundTab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  inRoundTabLabel: {
    fontFamily: getFontFamily('body', '500'),
    fontWeight: '500',
    fontSize: 10,
    color: palette.sand[400],
  },
  inRoundTabLabelActive: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    color: colors.primary,
  },
});
