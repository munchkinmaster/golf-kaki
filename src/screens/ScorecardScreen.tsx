import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Bird,
  ChevronLeft,
  CircleCheckBig,
  Flag,
  Flame,
  List,
  Minus,
  Plus,
  RefreshCw,
  Repeat,
  Save,
  Target,
  Trophy,
  Users,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { ScoreBadge } from '../components/ScoreBadge';
import type { UnlockCelebration } from '../components/UnlockCelebrationModal';
import { UnlockCelebrationModal } from '../components/UnlockCelebrationModal';
import { computeThru, getFlags, pairwiseResult, sumRange } from '../data/round';
import {
  BIRDIE_STREAK_LEGENDARY,
  BIRDIE_STREAK_MIN,
  PAR_STREAK_EPIC,
  PAR_STREAK_LEGENDARY,
  PAR_STREAK_MIN,
  crossedNewMilestone,
  previewLiveStreaks,
} from '../data/streaks';
import { useLiveRound } from '../hooks/useLiveRound';
import type { RootStackParamList } from '../navigation/types';
import { useProfile } from '../state/ProfileContext';
import { colors, getFontFamily, palette, radius, screenGutter, shadows, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Scorecard'>;

type Nine = 'front' | 'back';

function firstName(name: string) {
  return name.split(' ')[0];
}

function birdieCelebration(best: number): UnlockCelebration {
  const legendary = best >= BIRDIE_STREAK_LEGENDARY;
  return {
    icon: Flame,
    headline: legendary ? 'Legendary streak!' : 'Birdie streak!',
    description: legendary
      ? `${best} birdies in a row. That's a clubhouse story right there, kaki.`
      : `${best} birdies in a row. Keep it going.`,
    shareMessage: `${best} birdies in a row on Golf Kaki! Track score · add fun.`,
  };
}

function parCelebration(best: number): UnlockCelebration {
  const legendary = best >= PAR_STREAK_LEGENDARY;
  const epic = best >= PAR_STREAK_EPIC;
  return {
    icon: Repeat,
    headline: legendary ? 'Legendary streak!' : epic ? 'Epic streak!' : 'Par streak!',
    description: legendary
      ? `${best} pars in a row. Ice in the veins.`
      : `${best} pars in a row. Steady as she goes.`,
    shareMessage: `${best} pars in a row on Golf Kaki! Track score · add fun.`,
  };
}

function holeInOneCelebration(): UnlockCelebration {
  return {
    icon: Target,
    headline: 'Hole in one!',
    description: 'Straight from the tee to the cup — the shot every golfer dreams about.',
    shareMessage: 'HOLE IN ONE on Golf Kaki! Track score · add fun.',
  };
}

function eagleCelebration(holeN: number): UnlockCelebration {
  return {
    icon: Bird,
    headline: 'Eagle!',
    description: `Two under (or better) on hole ${holeN}. That's a card worth keeping.`,
    shareMessage: `Eagle on hole ${holeN} on Golf Kaki! Track score · add fun.`,
  };
}

type ResultTint = 'win' | 'lose' | 'halve' | null;

export function ScorecardScreen({ navigation, route }: Props) {
  const { matchId, matchName, courseName, gameModeName, isHost } = route.params;

  const {
    loading,
    viewerId,
    roster,
    holes,
    schedule,
    playOrder,
    gross,
    scores,
    thru,
    frontNineDeals,
    backNineDeals,
    adjustScore,
    refresh: refreshRound,
  } = useLiveRound(matchId);

  // Live "just crossed a streak threshold" detection, scoped to the viewer's
  // own card only (matches the self-only RLS on profiles.birdie/par_streak_best
  // — a card entered on someone else's behalf can't recalc their stats either).
  // Baselines seed once from the profile fetched at sign-in/last recalc and
  // only ever move forward as holes are entered this session; comparing each
  // new check against them is what detects a *new* milestone rather than
  // re-celebrating a streak the player already has.
  const { profile } = useProfile();
  const birdieBaseline = useRef<number | null>(null);
  const parBaseline = useRef<number | null>(null);
  useEffect(() => {
    if (profile && birdieBaseline.current === null) {
      birdieBaseline.current = profile.birdieStreakBest ?? 0;
      parBaseline.current = profile.parStreakBest ?? 0;
    }
  }, [profile]);
  const [celebrationQueue, setCelebrationQueue] = useState<UnlockCelebration[]>([]);

  // `thru` is how many holes every roster player has fully scored — the live
  // hole still being entered is always `thru + 1`. `activeHole`/
  // `activePlayerKey` are whichever card is open for editing right now, which
  // defaults to your own live hole but can detour to any earlier hole (or,
  // for the host, any player) via a grid tap.
  const [activeHole, setActiveHole] = useState(1);
  const [activePlayerKey, setActivePlayerKey] = useState('');
  const [nineOverride, setNineOverride] = useState<Nine | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;
  const initialized = useRef(false);

  // Hole numbers in actual tee-off order (see round.ts's buildPlayOrder) —
  // identity [1, 2, ..., N] for every non-shotgun match. "Thru count N" means
  // "the next hole to play is playOrder[N]" (clamped to the last hole once
  // the round is fully done), NOT literally hole number N+1 — that's only the
  // same thing when the round starts at hole 1.
  const holeAtThru = (count: number): number => playOrder[Math.min(playOrder.length - 1, count)] ?? 1;

  useEffect(() => {
    if (loading || initialized.current || holes.length === 0 || !viewerId) return;
    initialized.current = true;
    const viewerThru = computeThru([viewerId], scores, playOrder);
    setActiveHole(holeAtThru(viewerThru));
    setActivePlayerKey(viewerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Follows whichever hole is actively being entered, not the whole group's
  // `thru` — otherwise finishing hole 9 wouldn't flip the grid to Back 9
  // until every slower playing partner also reached it.
  const nine: Nine = nineOverride ?? (activeHole > 9 ? 'back' : 'front');
  const displayHoles = nine === 'back' ? holes.slice(9, 18) : holes.slice(0, 9);
  const activeHoleData = holes[activeHole - 1];
  const activeScore = gross[activePlayerKey]?.[activeHole - 1] ?? activeHoleData?.par ?? 0;
  const activePlayerName = roster.find((p) => p.playerId === activePlayerKey)?.name;
  const editingOwnCard = activePlayerKey === viewerId;
  // Each player moves through their own card at their own pace — gating this
  // on the whole group's `thru` meant finishing a hole ahead of a slower
  // partner immediately looked "not live" and bounced the cursor backward.
  const activePlayerThru = useMemo(
    () => (activePlayerKey ? computeThru([activePlayerKey], scores, playOrder) : 0),
    [activePlayerKey, scores, playOrder],
  );
  const onLiveHole = activeHole === holeAtThru(activePlayerThru);
  // True exactly when saving the currently active hole finishes the active
  // player's own card — their next hole to play, and it's the last one in
  // play order (not necessarily hole number 18 — see holeAtThru above).
  // Deliberately not "activePlayerThru >= holes.length": that's stale by one
  // tap, since the state update from committing the last hole hasn't landed
  // yet when this same button press needs to decide whether to redirect.
  const roundComplete = onLiveHole && playOrder.length > 0 && activeHole === playOrder[playOrder.length - 1];

  function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    refreshRound();
    spin.setValue(0);
    Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }).start(() => {
      setRefreshing(false);
    });
  }

  function canEdit(playerId: string) {
    return isHost || playerId === viewerId;
  }

  function selectCell(playerId: string, holeN: number) {
    if (!canEdit(playerId)) return;
    setActivePlayerKey(playerId);
    setActiveHole(holeN);
  }

  function adjustActiveScore(delta: number) {
    if (!activePlayerKey) return;
    adjustScore(activePlayerKey, activeHole - 1, delta);
  }

  // Fire-and-forget: checks whether the hole just committed for the viewer's
  // own card (not one entered on their behalf) newly crosses a Birdie/Par
  // Streak threshold, using the same computation as the authoritative
  // post-round recalc (src/data/streaks.ts's previewLiveStreaks) plus this
  // round's holes-so-far. A failed check just means no live celebration —
  // the real value still gets recomputed and saved when the round finishes.
  async function checkForUnlock() {
    if (!viewerId || !editingOwnCard || !onLiveHole) return;
    const justSavedPar = activeHoleData?.par;
    if (justSavedPar == null) return;

    // Hole-in-One/Eagle are one-off per-hole facts (unlike the streaks below)
    // — no baseline needed, just this hole's own score vs. its par. The
    // authoritative record still gets written at round-finish via
    // recalculateAndSaveMomentBadges (src/data/badgeMoments.ts); this is
    // best-effort live flavor only.
    const holeDiff = activeScore - justSavedPar;
    const newCelebrations: UnlockCelebration[] = [];
    if (activeScore === 1) newCelebrations.push(holeInOneCelebration());
    else if (holeDiff <= -2) newCelebrations.push(eagleCelebration(activeHole));

    if (birdieBaseline.current !== null && parBaseline.current !== null) {
      // "Prior" holes means prior in actual tee-off order, not hole number
      // order — for a shotgun start those don't match (see playOrder).
      const priorDiffs: number[] = [];
      const activePos = playOrder.indexOf(activeHole);
      for (let k = 0; k < activePos; k++) {
        const holeN = playOrder[k]!;
        const g = gross[viewerId]?.[holeN - 1];
        const par = holes[holeN - 1]?.par;
        if (g != null && par != null) priorDiffs.push(g - par);
      }
      const inProgressDiffs = [...priorDiffs, holeDiff];

      try {
        const { birdieBest, parBest } = await previewLiveStreaks(viewerId, inProgressDiffs);
        if (crossedNewMilestone(birdieBaseline.current, birdieBest, [BIRDIE_STREAK_MIN, BIRDIE_STREAK_LEGENDARY])) {
          newCelebrations.push(birdieCelebration(birdieBest));
        }
        birdieBaseline.current = birdieBest;
        if (crossedNewMilestone(parBaseline.current, parBest, [PAR_STREAK_MIN, PAR_STREAK_EPIC, PAR_STREAK_LEGENDARY])) {
          newCelebrations.push(parCelebration(parBest));
        }
        parBaseline.current = parBest;
      } catch {
        // Best-effort — see comment above.
      }
    }

    if (newCelebrations.length > 0) setCelebrationQueue((queue) => [...queue, ...newCelebrations]);
  }

  function dismissCelebration() {
    setCelebrationQueue((queue) => queue.slice(1));
  }

  function saveActiveScore() {
    // A player who never touches the +/- stepper (e.g. they made the
    // displayed default score) would otherwise leave this hole completely
    // unwritten — commit whatever's currently shown so `thru` can advance
    // once everyone's card actually has a row for this hole.
    if (activePlayerKey) adjustScore(activePlayerKey, activeHole - 1, 0);
    checkForUnlock();

    if (onLiveHole && roundComplete) {
      navigation.navigate('Finish', { matchId, matchName, courseName, gameModeName });
      return;
    }
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 900);
    // Advancing the cursor should also clear any manual Front9/Back9 pick —
    // otherwise reviewing an earlier hole once leaves the grid stuck on that
    // half even as you keep entering new scores past the turn.
    setNineOverride(null);
    if (onLiveHole) {
      const pos = playOrder.indexOf(activeHole);
      setActiveHole(playOrder[Math.min(playOrder.length - 1, pos + 1)] ?? activeHole);
    } else {
      setActiveHole(holeAtThru(activePlayerThru));
    }
    if (viewerId) setActivePlayerKey(viewerId);
  }

  function getResultTint(playerId: string, holeIndex: number, holeN: number): ResultTint {
    // `thru` counts holes into the round in tee-off order, not literal hole
    // number — comparing it directly against `holeN` only worked when every
    // round started at hole 1. Use the hole's position in playOrder instead.
    const playedPosition = playOrder.indexOf(holeN);
    if (!viewerId || playerId === viewerId || playedPosition < 0 || playedPosition >= thru) return null;
    const result = pairwiseResult(viewerId, playerId, holeIndex, gross, holes, frontNineDeals, schedule, backNineDeals);
    if (result > 0) return 'win';
    if (result < 0) return 'lose';
    return 'halve';
  }

  const rosterIds = useMemo(() => roster.map((p) => p.playerId), [roster]);
  const outScores = useMemo(() => sumRange(rosterIds, thru, 0, 9, gross, playOrder), [rosterIds, thru, gross, playOrder]);
  const inScores = useMemo(() => sumRange(rosterIds, thru, 9, 18, gross, playOrder), [rosterIds, thru, gross, playOrder]);
  const totalScores = useMemo(() => {
    const totals: Record<string, number> = {};
    rosterIds.forEach((id) => {
      totals[id] = (outScores[id] ?? 0) + (inScores[id] ?? 0);
    });
    return totals;
  }, [rosterIds, outScores, inScores]);

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
                {activeHoleData ? `Par ${activeHoleData.par} · SI ${activeHoleData.si} · ` : ''}
                {editingOwnCard ? 'your card' : `${activePlayerName}'s card`}
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
            {roster.map((p) => (
              <Text key={p.playerId} style={[styles.gridHeaderPlayer, p.playerId === viewerId && styles.gridHeaderPlayerYou]}>
                {p.playerId === viewerId ? 'You' : firstName(p.name)}
              </Text>
            ))}
          </View>

          {loading ? <Text style={styles.loadingText}>Loading scorecard…</Text> : null}

          {displayHoles.map((hole) => {
            const isActiveRow = hole.n === activeHole;
            const i = hole.n - 1;

            return (
              <View key={hole.n} style={[styles.gridRow, isActiveRow && styles.gridRowCurrent]}>
                <Text style={[styles.gridCellNum, isActiveRow && styles.gridCellNumCurrent]}>{hole.n}</Text>
                <Text style={styles.gridCellMeta}>{hole.par}</Text>
                <Text style={styles.gridCellMeta}>{hole.si}</Text>
                {roster.map((p) => {
                  // Per-player, per-hole — a player's own entered score shows
                  // immediately, independent of whether the rest of the
                  // group has finished this hole yet (only the win/lose tint
                  // below needs the whole hole resolved).
                  const played = scores[p.playerId]?.[hole.n] !== undefined;
                  const isYou = p.playerId === viewerId;
                  const { give, recv } = viewerId
                    ? getFlags(p.playerId, viewerId, hole.n, holes, frontNineDeals, schedule, backNineDeals)
                    : { give: 0, recv: 0 };
                  const resultTint = getResultTint(p.playerId, i, hole.n);
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
                  const isSelected = isActiveRow && p.playerId === activePlayerKey;

                  return (
                    <Pressable
                      key={p.playerId}
                      style={[styles.gridCell, tintStyle, isSelected && styles.gridCellSelected]}
                      disabled={!played || !canEdit(p.playerId)}
                      onPress={() => selectCell(p.playerId, hole.n)}
                    >
                      {played ? (
                        <ScoreBadge value={gross[p.playerId]?.[i] ?? hole.par} par={hole.par} size={isActiveRow ? 28 : 22} />
                      ) : (
                        <Text style={styles.gridCellDash}>–</Text>
                      )}
                      {Array.from({ length: give }, (_, flagIndex) => (
                        <Flag
                          key={`give-${flagIndex}`}
                          size={9}
                          color={colors.scoreBirdie}
                          style={[styles.cellFlag, { right: 6 + flagIndex * 7 }]}
                        />
                      ))}
                      {Array.from({ length: recv }, (_, flagIndex) => (
                        <Flag
                          key={`recv-${flagIndex}`}
                          size={9}
                          color={colors.statusSuccess}
                          style={[styles.cellFlag, { right: 6 + flagIndex * 7 }]}
                        />
                      ))}
                    </Pressable>
                  );
                })}
              </View>
            );
          })}

          <SummaryRow playerIds={rosterIds} label={nine === 'back' ? 'In' : 'Out'} scores={nine === 'back' ? inScores : outScores} />
          <SummaryRow playerIds={rosterIds} label="Total" scores={totalScores} strong />

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
            onPress={() => navigation.navigate('Leaderboard', { matchId, matchName, courseName, gameModeName })}
          >
            <Trophy size={21} color={palette.sand[400]} />
            <Text style={styles.inRoundTabLabel}>Leaderboard</Text>
          </Pressable>
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

      <UnlockCelebrationModal celebration={celebrationQueue[0] ?? null} onDismiss={dismissCelebration} />
    </View>
  );
}

function SummaryRow({
  playerIds,
  label,
  scores,
  strong = false,
}: {
  playerIds: string[];
  label: string;
  scores: Record<string, number>;
  strong?: boolean;
}) {
  return (
    <View style={[styles.summaryRow, strong && styles.summaryRowStrong]}>
      <Text style={[styles.summaryLabel, strong && styles.summaryLabelStrong]}>{label}</Text>
      {playerIds.map((id) => (
        <Text key={id} style={[styles.summaryValue, strong && styles.summaryValueStrong]}>
          {scores[id] ?? 0}
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
  loadingText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    marginBottom: spacing[2],
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
