import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ChevronLeft,
  CircleCheckBig,
  Flag,
  List,
  Minus,
  Plus,
  RefreshCw,
  Save,
  Trophy,
  Users,
} from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { ScoreBadge } from '../components/ScoreBadge';
import { HOLES, PLAYERS, VIEWER_KEY, getFlags, pairwiseResult } from '../data/round';
import type { PlayerKey } from '../data/round';
import type { RootStackParamList } from '../navigation/types';
import { useRound } from '../state/RoundContext';
import { colors, getFontFamily, palette, radius, screenGutter, shadows, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Scorecard'>;

type Nine = 'front' | 'back';

function firstName(name: string) {
  return name.split(' ')[0];
}

type ResultTint = 'win' | 'lose' | 'halve' | null;

export function ScorecardScreen({ navigation, route }: Props) {
  const { matchName, courseName, gameModeName, isHost } = route.params;

  // `thru` is the match's shared progress — holes up to and including it are
  // played. `activeHole`/`activePlayerKey` are whichever card is open for
  // editing right now, which defaults to your own live hole but can detour to
  // any earlier hole (or, for the host, any player) via a grid tap.
  const { gross, thru, frontNineDeals, adjustScore, setThru } = useRound();
  const [activeHole, setActiveHole] = useState(6);
  const [activePlayerKey, setActivePlayerKey] = useState<PlayerKey>(VIEWER_KEY);
  const [nineOverride, setNineOverride] = useState<Nine | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;

  const nine: Nine = nineOverride ?? (thru > 9 ? 'back' : 'front');
  const displayHoles = nine === 'back' ? HOLES.slice(9, 18) : HOLES.slice(0, 9);
  const activeHoleData = HOLES[activeHole - 1];
  const activeScore = gross[activePlayerKey][activeHole - 1];
  const activePlayerName = PLAYERS.find((p) => p.key === activePlayerKey)?.name;
  const editingOwnCard = activePlayerKey === VIEWER_KEY;
  const onLiveHole = activeHole === thru;
  const roundComplete = thru >= HOLES.length;

  function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    spin.setValue(0);
    Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }).start(() => {
      setRefreshing(false);
    });
  }

  function canEdit(playerKey: PlayerKey) {
    return isHost || playerKey === VIEWER_KEY;
  }

  function selectCell(playerKey: PlayerKey, holeN: number) {
    if (!canEdit(playerKey)) return;
    setActivePlayerKey(playerKey);
    setActiveHole(holeN);
  }

  function adjustActiveScore(delta: number) {
    adjustScore(activePlayerKey, activeHole - 1, delta);
  }

  function saveActiveScore() {
    if (onLiveHole && roundComplete) {
      navigation.navigate('Finish', { matchName, courseName, gameModeName });
      return;
    }
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 900);
    if (onLiveHole) {
      const nextHole = Math.min(HOLES.length, thru + 1);
      setThru(nextHole);
      setActiveHole(nextHole);
    } else {
      setActiveHole(thru);
    }
    setActivePlayerKey(VIEWER_KEY);
  }

  function getResultTint(playerKey: PlayerKey, holeIndex: number, holeN: number): ResultTint {
    if (playerKey === VIEWER_KEY || holeN > thru) return null;
    const result = pairwiseResult(VIEWER_KEY, playerKey, holeIndex, gross, frontNineDeals);
    if (result > 0) return 'win';
    if (result < 0) return 'lose';
    return 'halve';
  }

  const outScores = useMemo(() => sumRange(gross, 0, 9, thru), [gross, thru]);
  const inScores = useMemo(() => sumRange(gross, 9, 18, thru), [gross, thru]);
  const totalScores = useMemo(() => {
    const totals: Record<PlayerKey, number> = { A: 0, B: 0, C: 0 };
    PLAYERS.forEach((p) => {
      totals[p.key] = outScores[p.key] + inScores[p.key];
    });
    return totals;
  }, [outScores, inScores]);

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
            <View style={styles.headerTitleGroup}>
              <Text style={styles.headerTitle}>{matchName}</Text>
              <Text style={styles.headerSubtitle}>
                {courseName} · {gameModeName}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveLabel}>LIVE</Text>
              </View>
              <Pressable style={styles.refreshButton} onPress={refresh}>
                <Animated.View style={{ transform: [{ rotate: spinRotate }] }}>
                  <RefreshCw size={16} color={refreshing ? colors.accent : 'rgba(255,255,255,0.85)'} />
                </Animated.View>
              </Pressable>
            </View>
          </View>

          <View style={styles.entryCard}>
            <View>
              <Text style={styles.entryHole}>Hole {activeHole}</Text>
              <Text style={styles.entryMeta}>
                Par {activeHoleData.par} · SI {activeHoleData.si} · {editingOwnCard ? 'your card' : `${activePlayerName}'s card`}
              </Text>
            </View>
            <View style={styles.entryStepper}>
              <Pressable style={styles.entryButton} onPress={() => adjustActiveScore(-1)}>
                <Minus size={20} color={palette.white} />
              </Pressable>
              <Text style={styles.entryValue}>{activeScore}</Text>
              <Pressable style={[styles.entryButton, styles.entryButtonAccent]} onPress={() => adjustActiveScore(1)}>
                <Plus size={20} color={palette.white} />
              </Pressable>
            </View>
          </View>

          <Pressable style={[styles.saveButton, justSaved && styles.saveButtonSaved]} onPress={saveActiveScore}>
            {justSaved ? (
              <CircleCheckBig size={17} color={palette.green[300]} />
            ) : onLiveHole && roundComplete ? (
              <Flag size={17} color={palette.white} />
            ) : (
              <Save size={17} color={palette.white} />
            )}
            <Text style={[styles.saveButtonLabel, justSaved && styles.saveButtonLabelSaved]}>
              {justSaved ? 'Saved' : onLiveHole ? (roundComplete ? 'Finish round' : 'Save & next hole') : 'Update score'}
            </Text>
          </Pressable>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.gridHeaderRow}>
            <Text style={styles.gridHeaderH}>H</Text>
            <Text style={styles.gridHeaderMeta}>Par</Text>
            <Text style={styles.gridHeaderMeta}>SI</Text>
            {PLAYERS.map((p) => (
              <Text key={p.key} style={[styles.gridHeaderPlayer, p.key === VIEWER_KEY && styles.gridHeaderPlayerYou]}>
                {p.key === VIEWER_KEY ? 'You' : firstName(p.name)}
              </Text>
            ))}
          </View>

          {displayHoles.map((hole) => {
            const isActiveRow = hole.n === activeHole;
            const played = hole.n <= thru;
            const i = hole.n - 1;

            return (
              <View key={hole.n} style={[styles.gridRow, isActiveRow && styles.gridRowCurrent]}>
                <Text style={[styles.gridCellNum, isActiveRow && styles.gridCellNumCurrent]}>{hole.n}</Text>
                <Text style={styles.gridCellMeta}>{hole.par}</Text>
                <Text style={styles.gridCellMeta}>{hole.si}</Text>
                {PLAYERS.map((p) => {
                  const isYou = p.key === VIEWER_KEY;
                  const { give, recv } = getFlags(p.key, hole.n, gross, frontNineDeals);
                  const resultTint = getResultTint(p.key, i, hole.n);
                  const tintStyle =
                    resultTint === 'win'
                      ? styles.cellTintWin
                      : resultTint === 'lose'
                        ? styles.cellTintLose
                        : resultTint === 'halve'
                          ? styles.cellTintHalve
                          : isYou
                            ? styles.cellTintYou
                            : null;
                  const isSelected = isActiveRow && p.key === activePlayerKey;

                  return (
                    <Pressable
                      key={p.key}
                      style={[styles.gridCell, tintStyle, isSelected && styles.gridCellSelected]}
                      disabled={!played || !canEdit(p.key)}
                      onPress={() => selectCell(p.key, hole.n)}
                    >
                      {played ? (
                        <ScoreBadge value={gross[p.key][i]} par={hole.par} size={isActiveRow ? 28 : 22} />
                      ) : (
                        <Text style={styles.gridCellDash}>–</Text>
                      )}
                      {give ? <Flag size={9} color={colors.scoreBirdie} style={styles.cellFlag} /> : null}
                      {recv ? <Flag size={9} color={colors.statusSuccess} style={styles.cellFlag} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            );
          })}

          <SummaryRow label={nine === 'back' ? 'In' : 'Out'} scores={nine === 'back' ? inScores : outScores} />
          <SummaryRow label="Total" scores={totalScores} strong />

          <View style={styles.nineToggle}>
            <Pressable
              style={[styles.nineToggleOption, nine === 'front' && styles.nineToggleOptionActive]}
              onPress={() => setNineOverride('front')}
            >
              <Text style={[styles.nineToggleLabel, nine === 'front' && styles.nineToggleLabelActive]}>Front 9</Text>
            </Pressable>
            <Pressable
              style={[styles.nineToggleOption, nine === 'back' && styles.nineToggleOptionActive]}
              onPress={() => setNineOverride('back')}
            >
              <Text style={[styles.nineToggleLabel, nine === 'back' && styles.nineToggleLabelActive]}>Back 9</Text>
            </Pressable>
          </View>

          <View style={styles.legend}>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <Flag size={11} color={colors.scoreBirdie} />
                <Text style={styles.legendText}>stroke given</Text>
              </View>
              <View style={styles.legendItem}>
                <Flag size={11} color={colors.statusSuccess} />
                <Text style={styles.legendText}>stroke received</Text>
              </View>
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, styles.cellTintWin]} />
                <Text style={styles.legendText}>you win</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, styles.cellTintLose]} />
                <Text style={styles.legendText}>you lose</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, styles.cellTintHalve]} />
                <Text style={styles.legendText}>halved</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.inRoundNav}>
          <View style={styles.inRoundTab}>
            <List size={21} color={colors.primary} />
            <Text style={[styles.inRoundTabLabel, styles.inRoundTabLabelActive]}>Scorecard</Text>
          </View>
          <Pressable
            style={styles.inRoundTab}
            onPress={() => navigation.navigate('Leaderboard', { matchName, courseName, gameModeName })}
          >
            <Trophy size={21} color={palette.sand[400]} />
            <Text style={styles.inRoundTabLabel}>Leaderboard</Text>
          </Pressable>
          <Pressable
            style={styles.inRoundTab}
            onPress={() => navigation.navigate('InGameLobby', { matchName, courseName, gameModeName })}
          >
            <Users size={21} color={palette.sand[400]} />
            <Text style={styles.inRoundTabLabel}>Lobby</Text>
          </Pressable>
          <Pressable
            style={styles.inRoundTab}
            onPress={() => navigation.navigate('Finish', { matchName, courseName, gameModeName })}
          >
            <CircleCheckBig size={21} color={palette.sand[400]} />
            <Text style={styles.inRoundTabLabel}>Finish</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function sumRange(gross: Record<PlayerKey, number[]>, start: number, end: number, thru: number) {
  const sums: Record<PlayerKey, number> = { A: 0, B: 0, C: 0 };
  PLAYERS.forEach((p) => {
    let total = 0;
    for (let i = start; i < end; i++) {
      if (i + 1 <= thru) total += gross[p.key][i];
    }
    sums[p.key] = total;
  });
  return sums;
}

function SummaryRow({ label, scores, strong = false }: { label: string; scores: Record<PlayerKey, number>; strong?: boolean }) {
  return (
    <View style={[styles.summaryRow, strong && styles.summaryRowStrong]}>
      <Text style={[styles.summaryLabel, strong && styles.summaryLabelStrong]}>{label}</Text>
      {PLAYERS.map((p) => (
        <Text key={p.key} style={[styles.summaryValue, strong && styles.summaryValueStrong]}>
          {scores[p.key]}
        </Text>
      ))}
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
    gap: spacing[2] + 1,
  },
  backButton: {
    width: 28,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 17,
    color: palette.white,
  },
  headerSubtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexShrink: 0,
  },
  liveBadge: {
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
  liveLabel: {
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
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3] + 2,
    marginTop: spacing[3] + 2,
  },
  entryHole: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 22,
    lineHeight: 22,
    color: palette.white,
  },
  entryMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 3,
  },
  entryStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3] + 2,
  },
  entryButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryButtonAccent: {
    backgroundColor: colors.accent,
    ...shadows.accent,
  },
  entryValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 34,
    minWidth: 34,
    textAlign: 'center',
    color: palette.white,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing[2] + 3,
    marginTop: spacing[3],
    ...shadows.accent,
  },
  saveButtonSaved: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: palette.white,
  },
  saveButtonLabelSaved: {
    color: palette.green[300],
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[3] + 2,
    paddingTop: spacing[3] + 2,
    paddingBottom: spacing[5],
  },
  gridHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: spacing[2],
    borderBottomWidth: 1.5,
    borderBottomColor: colors.borderDefault,
  },
  gridHeaderH: {
    width: 28,
    textAlign: 'center',
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 10,
    color: colors.textDisabled,
  },
  gridHeaderMeta: {
    width: 26,
    textAlign: 'center',
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 10,
    color: colors.textDisabled,
  },
  gridHeaderPlayer: {
    flex: 1,
    textAlign: 'center',
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 11,
    color: colors.textDisabled,
  },
  gridHeaderPlayerYou: {
    color: colors.primary,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 32,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSunken,
  },
  gridRowCurrent: {
    minHeight: 44,
    backgroundColor: '#FFF4EC',
    borderRadius: radius.sm + 2,
    borderBottomWidth: 0,
    marginVertical: 3,
  },
  gridCellNum: {
    width: 28,
    textAlign: 'center',
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 13,
    color: colors.textPrimary,
  },
  gridCellNumCurrent: {
    fontSize: 16,
    color: palette.orange[700],
  },
  gridCellMeta: {
    width: 26,
    textAlign: 'center',
    fontFamily: getFontFamily('numeric', '400'),
    fontSize: 12,
    color: colors.textDisabled,
  },
  gridCell: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[1],
  },
  gridCellSelected: {
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  gridCellDash: {
    fontFamily: getFontFamily('numeric', '500'),
    fontWeight: '500',
    fontSize: 14,
    color: palette.sand[400],
  },
  cellFlag: {
    position: 'absolute',
    top: 3,
    right: 6,
  },
  cellTintYou: {
    backgroundColor: colors.surfaceBrandSoft,
  },
  cellTintWin: {
    backgroundColor: 'rgba(46,138,76,0.18)',
  },
  cellTintLose: {
    backgroundColor: 'rgba(224,116,46,0.18)',
  },
  cellTintHalve: {
    backgroundColor: 'rgba(120,130,124,0.16)',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 30,
    backgroundColor: colors.surfaceSunken,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  summaryRowStrong: {
    borderBottomWidth: 0,
    borderRadius: radius.sm + 2,
  },
  summaryLabel: {
    width: 80,
    paddingLeft: spacing[2],
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  summaryLabelStrong: {
    color: colors.primary,
  },
  summaryValue: {
    flex: 1,
    textAlign: 'center',
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 13,
    color: colors.textPrimary,
  },
  summaryValueStrong: {
    fontSize: 15,
    color: colors.primary,
  },
  nineToggle: {
    flexDirection: 'row',
    gap: 3,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.pill,
    padding: 3,
    marginTop: spacing[3] + 2,
  },
  nineToggleOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2] - 1,
    borderRadius: radius.pill,
  },
  nineToggleOptionActive: {
    backgroundColor: colors.surfaceCard,
    ...shadows.xs,
  },
  nineToggleLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.textDisabled,
  },
  nineToggleLabelActive: {
    color: colors.primary,
  },
  legend: {
    gap: spacing[2] - 1,
    marginTop: spacing[3] + 2,
    paddingHorizontal: spacing[1],
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
  },
  legendSwatch: {
    width: 11,
    height: 11,
    borderRadius: radius.xs - 1,
  },
  legendText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
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
