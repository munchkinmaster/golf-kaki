import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowRight, Calculator, Check, ChevronLeft, ChevronRight, Coins, Lock, Minus, Plus, Repeat, Table2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { InRoundTabBar } from '../components/InRoundTabBar';
import type { InRoundTab } from '../components/InRoundTabBar';
import { ScoreCell } from '../components/ScoreCell';
import { strokesReceivedOnHole } from '../data/handicap';
import { computeThru } from '../data/round';
import { openHoleSkinsStake, resolveSkinsHoles } from '../data/skins';
import { stablefordPointsForHole } from '../data/stableford';
import { SCORE_CLASS_LABEL, classifyDiff, quickPickOptions } from '../data/strokePlay';
import type { ScoreClass } from '../data/strokePlay';
import { SYSTEM36_TOTAL_HOLES, s36Handicap, s36PointsForHole, stablefordTotal } from '../data/system36';
import { confirmTournamentCard } from '../data/tournaments';
import { useFinishRedirect } from '../hooks/useFinishRedirect';
import { useTournamentRound } from '../hooks/useTournamentRound';
import type { TournamentRoundPlayer } from '../hooks/useTournamentRound';
import type { RootStackParamList } from '../navigation/types';
import { colors, getFontFamily, getSolidAvatarColor, palette, radius, screenGutter, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'TournamentScorecard'>;

const CLASS_COLOR: Record<ScoreClass, string> = {
  eagle: colors.scoreEagle,
  birdie: colors.scoreBirdie,
  par: colors.scorePar,
  bogey: colors.scoreBogey,
  double: colors.scoreDouble,
};

// System 36 per-hole points → the reference-chip color tier (2pt green /
// 1pt blue / 0pt red), shared by the derived-points callout, the quick-pick
// chips, and the hole rail on SY7.
const S36_POINT_CHIP: Record<0 | 1 | 2, (typeof palette.scoreChip)[keyof typeof palette.scoreChip]> = {
  2: palette.scoreChip.par,
  1: palette.scoreChip.bogey,
  0: palette.scoreChip.double,
};

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function TournamentScorecardScreen({ navigation, route }: Props) {
  const { tournamentId, matchId } = route.params;
  const round = useTournamentRound(tournamentId, matchId);
  const { loading, error, viewerId, roster, holes, playOrder, scores, gross, sideGames, canEditPlayer, adjustScore, setScore, matchStatus } = round;

  useFinishRedirect(
    matchStatus,
    loading,
    useCallback(() => navigation.navigate('TournamentFinish', { tournamentId, matchId }), [navigation, tournamentId, matchId]),
  );

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [activeHoleN, setActiveHoleN] = useState<number | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  // Seed the selected player (viewer) and the active hole (viewer's own next
  // unscored hole in tee-off order) exactly once, the first time the round's
  // data is actually available — afterward both are free to move via the
  // roster row taps / hole arrows without snapping back on every refetch.
  useEffect(() => {
    if (!viewerId || playOrder.length === 0) return;
    if (selectedPlayerId === null) setSelectedPlayerId(viewerId);
    if (activeHoleN === null) {
      const ownThru = computeThru([viewerId], scores, playOrder);
      setActiveHoleN(playOrder[Math.min(playOrder.length - 1, ownThru)] ?? playOrder[0]!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init-once; scores/playOrder are read, not re-triggers
  }, [viewerId, playOrder.length]);

  function flashSaved() {
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  }

  const holePos = activeHoleN !== null ? playOrder.indexOf(activeHoleN) : -1;
  const activeHole = holes.find((h) => h.n === activeHoleN);
  const selectedPlayer = roster.find((p) => p.id === selectedPlayerId);
  const selectedIndex = roster.findIndex((p) => p.id === selectedPlayerId);

  // The running-total tiles must count EVERY hole this player has actually
  // entered — not computeThru's consecutive-from-start prefix. A player can
  // fill holes out of order (the back nine first, or any hole via the grid),
  // and the prefix stalls at the first gap: entering holes 10–18 while 1–9 are
  // still blank would otherwise show only the first committed hole's totals.
  const holeByN = useMemo(() => new Map(holes.map((h) => [h.n, h])), [holes]);
  const enteredHoleNs = useMemo(
    () => (selectedPlayerId ? playOrder.filter((n) => scores[selectedPlayerId]?.[n] !== undefined) : []),
    [selectedPlayerId, scores, playOrder],
  );
  const enteredCountForPlayer = enteredHoleNs.length;
  const grossVal = selectedPlayerId ? enteredHoleNs.reduce((sum, n) => sum + (scores[selectedPlayerId]![n] ?? 0), 0) : 0;
  const nettVal =
    selectedPlayerId && selectedPlayer
      ? enteredHoleNs.reduce(
          (sum, n) => sum + ((scores[selectedPlayerId]![n] ?? 0) - strokesReceivedOnHole(selectedPlayer.playingHandicap, holeByN.get(n)?.si ?? n)),
          0,
        )
      : 0;
  const parVal = enteredHoleNs.reduce((sum, n) => sum + (holeByN.get(n)?.par ?? 0), 0);
  const toPar = nettVal - parVal;

  // Round-progress pill: how many holes the VIEWER has actually played
  // (entered), gap-tolerant — not the field's consecutive-from-start prefix.
  const viewerHolesPlayed = viewerId ? playOrder.filter((n) => scores[viewerId]?.[n] !== undefined).length : 0;

  const selectedReceived = activeHole && selectedPlayer ? strokesReceivedOnHole(selectedPlayer.playingHandicap, activeHole.si) : 0;
  const currentValue = activeHole && selectedPlayerId ? (scores[selectedPlayerId]?.[activeHole.n] ?? activeHole.par) : 0;
  const chips = activeHole && selectedPlayer ? quickPickOptions(activeHole.par, activeHole.si, selectedPlayer.playingHandicap) : [];

  const enteredCount = activeHole ? roster.filter((p) => scores[p.id]?.[activeHole.n] !== undefined).length : 0;
  // Keeps the round linear — your own card for the hole you're on has to be
  // submitted before you can move to the next one (doesn't wait on anyone
  // else's card; each player still enters their own independently).
  const viewerScoredActiveHole = viewerId !== null && activeHole ? scores[viewerId]?.[activeHole.n] !== undefined : false;
  const nextDisabled = holePos >= playOrder.length - 1 || !viewerScoredActiveHole;

  const skinsConfig = sideGames.find((g) => g.type === 'skins');
  const playingHandicaps = useMemo(() => Object.fromEntries(roster.map((p) => [p.id, p.playingHandicap])), [roster]);
  const skinsResults = useMemo(
    () => (skinsConfig ? resolveSkinsHoles(skinsConfig, scores, holes, playingHandicaps, playOrder) : []),
    [skinsConfig, scores, holes, playingHandicaps, playOrder],
  );
  const openStake = skinsConfig ? openHoleSkinsStake(skinsResults, holes.length) : { stake: 0, carriedFromHoles: [] };
  const skinsParticipantCount = skinsConfig?.participantIds.length ?? 0;
  // "On the line" is this hole's own ante-pot (everyone's stake, win or lose).
  // "To bank" is what the eventual winner actually NETS if they take it —
  // stake × (participants − 1) per skin, same real-money ante math
  // computeSkinsStandings settles with (you get paid by each OTHER
  // participant, not by yourself). For 2 players with no carry these are
  // meant to differ ($10 on the line, $5 to bank) — they'd previously both
  // shown the same figure since this used participantCount instead of
  // participantCount − 1.
  const onLineThisHole = (skinsConfig?.stakePerHole ?? 0) * skinsParticipantCount;
  const bankThisHole = openStake.stake * (skinsConfig?.stakePerHole ?? 0) * Math.max(0, skinsParticipantCount - 1);

  // ---- System 36 live figures (for the selected player) ----
  const isSystem36 = round.scoringFormat === 'system_36';
  const isStableford = round.scoringFormat === 'stableford';
  // Gap-tolerant, same as the gross/nett tiles above: sum S36 points over
  // every entered hole, not just the consecutive prefix.
  const s36Pts = selectedPlayerId
    ? enteredHoleNs.reduce((sum, n) => sum + s36PointsForHole(scores[selectedPlayerId]![n] ?? 0, holeByN.get(n)?.par ?? 0), 0)
    : 0;
  // Proj HCP is always on and starts at 36, dropping as points come in
  // (36 − points so far) — a true current value, not a pace projection.
  const projHcp = s36Handicap(s36Pts);
  // Proj Stbf stays dashed until the selected player's card is fully in (all 18
  // holes entered), matching SY8's "nett/Stableford not shown until 18" rule.
  const s36Settled = enteredCountForPlayer === SYSTEM36_TOTAL_HOLES;
  const projStbf =
    s36Settled && selectedPlayerId ? stablefordTotal(selectedPlayerId, SYSTEM36_TOTAL_HOLES, gross, holes, projHcp, playOrder) : null;
  // The gross currently in the stepper → its S36 points + score class, for the
  // "Bogey on par 4 = 1 pt" callout and the highlighted quick-pick chip.
  const currentS36Pts = activeHole ? s36PointsForHole(currentValue, activeHole.par) : 0;
  const currentClass: ScoreClass = activeHole ? classifyDiff(currentValue - activeHole.par) : 'par';
  const s36Chips = activeHole
    ? [activeHole.par - 1, activeHole.par, activeHole.par + 1, activeHole.par + 2].map((g) => {
        const grossValue = Math.max(1, g);
        return { grossValue, pts: s36PointsForHole(grossValue, activeHole.par) };
      })
    : [];

  // ---- Stableford live figures (for the selected player) ----
  // Unlike System 36, Stableford uses the player's ordinary (already-set)
  // Playing Handicap, so points are derived from NETT the same hole they're
  // played on — no "settled at 18" gate. Gap-tolerant, same convention as
  // s36Pts/nettVal above: sums every entered hole, not just the prefix.
  const stablefordPts =
    selectedPlayerId && selectedPlayer
      ? enteredHoleNs.reduce((sum, n) => {
          const hole = holeByN.get(n);
          if (!hole) return sum;
          const nett = (scores[selectedPlayerId]![n] ?? 0) - strokesReceivedOnHole(selectedPlayer.playingHandicap, hole.si);
          return sum + stablefordPointsForHole(nett, hole.par);
        }, 0)
      : 0;
  // "Pace" — points banked so far vs. the 2-pts/hole pace that plays exactly
  // to handicap (36 over 18, per SB3's target callout): positive means
  // ahead of that pace, negative means behind.
  const stablefordPace = stablefordPts - 2 * enteredCountForPlayer;
  // The gross currently in the stepper → its NETT score class and Stableford
  // points, for the derived-points banner and the highlighted quick-pick chip.
  const currentNett = currentValue - selectedReceived;
  const currentNettClass: ScoreClass = activeHole ? classifyDiff(currentNett - activeHole.par) : 'par';
  const currentStablefordPts = activeHole ? stablefordPointsForHole(currentNett, activeHole.par) : 0;

  function goHole(delta: number) {
    if (holePos < 0) return;
    const next = playOrder[Math.min(playOrder.length - 1, Math.max(0, holePos + delta))];
    if (next !== undefined) setActiveHoleN(next);
  }

  // The primary "Next hole" CTA commits the score shown in the stepper before
  // moving on — on a par hole you never need to touch the stepper (it already
  // shows par), so advancing must still SAVE that par rather than leave the
  // hole blank. Only writes when the hole isn't already entered for this player
  // (an untouched par default would otherwise be silently skipped).
  function handleNextHole() {
    if (activeHole && selectedPlayerId && canEditPlayer(selectedPlayerId) && scores[selectedPlayerId]?.[activeHole.n] === undefined) {
      setScore(selectedPlayerId, activeHole.n - 1, currentValue);
      flashSaved();
    }
    // On the final hole there's no "next" — commit the score (above) and hand
    // off to the Finish/review step so an untouched par on 18 still saves.
    // This tap IS "Save & review" (see the label below) — the one deliberate
    // "I'm done" signal the Finish screen's Confirm scores list looks for,
    // so it's recorded here rather than inferred from hole-completeness.
    if (holePos >= playOrder.length - 1) {
      if (selectedPlayerId && canEditPlayer(selectedPlayerId)) confirmTournamentCard(matchId, selectedPlayerId).catch(() => {});
      navigation.navigate('TournamentFinish', { tournamentId, matchId });
    } else {
      goHole(1);
    }
  }

  function handleStep(delta: number) {
    if (!activeHole || !selectedPlayerId) return;
    adjustScore(selectedPlayerId, activeHole.n - 1, delta);
    flashSaved();
  }

  function handlePickChip(value: number) {
    if (!activeHole || !selectedPlayerId) return;
    setScore(selectedPlayerId, activeHole.n - 1, value);
    flashSaved();
  }

  function handleTabNavigate(tab: InRoundTab) {
    if (tab === 'scorecard') return;
    if (tab === 'lobby') navigation.navigate('TournamentLobby', { tournamentId, matchId });
    else if (tab === 'leaderboard') navigation.navigate('TournamentLeaderboard', { tournamentId, matchId });
    else if (tab === 'finish') navigation.navigate('TournamentFinish', { tournamentId, matchId });
  }

  if (loading) {
    return (
      <View style={styles.page}>
        <SafeAreaView style={styles.centerFill}>
          <Text style={styles.loadingText}>Loading round…</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (error || !activeHole || !selectedPlayer) {
    return (
      <View style={styles.page}>
        <SafeAreaView style={styles.centerFill}>
          <Text style={styles.loadingText}>{error ?? "Couldn't load this round."}</Text>
        </SafeAreaView>
      </View>
    );
  }

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
              <Text style={styles.headerTitle}>{round.matchName}</Text>
              <Text style={styles.headerSubtitle}>
                {isSystem36 ? 'System 36 · no HCP entered' : `${isStableford ? 'Stableford' : 'Stroke play'} · Nett ${round.handicapAllowancePct}%`}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable style={styles.cardButton} onPress={() => navigation.navigate('TournamentScorecardGrid', { tournamentId, matchId })}>
                <Table2 size={15} color={colors.primary} />
                <Text style={styles.cardButtonLabel}>Card</Text>
              </Pressable>
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusPillLabel}>THRU {viewerHolesPlayed}</Text>
              </View>
            </View>
          </View>
          <View style={styles.headerDivider} />
          <View style={styles.holeNavRow}>
            <Pressable onPress={() => goHole(-1)} disabled={holePos <= 0} hitSlop={8}>
              <ChevronLeft size={22} color={holePos <= 0 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.55)'} />
            </Pressable>
            <View style={styles.holeNavCenterGroup}>
              <Text style={styles.holeNavHoleNumber} numberOfLines={1}>
                Hole {activeHole.n}
              </Text>
              <View style={styles.holeNavDivider} />
              <View>
                <View style={styles.holeNavSpecRow}>
                  <Text style={styles.holeNavSpecPar}>Par {activeHole.par}</Text>
                  <Text style={styles.holeNavSpecSi}>SI {activeHole.si}</Text>
                </View>
                <Text style={styles.holeNavSub} numberOfLines={1}>
                  {activeHole.yardageM[selectedPlayer.teeColor]}m
                  {isSystem36 ? ' · No strokes yet' : selectedReceived > 0 ? ` · you get ${selectedReceived} stroke${selectedReceived > 1 ? 's' : ''}` : ''}
                </Text>
              </View>
            </View>
            <Pressable onPress={() => goHole(1)} disabled={nextDisabled} hitSlop={8}>
              <ChevronRight size={22} color={nextDisabled ? 'rgba(255,255,255,0.3)' : palette.white} />
            </Pressable>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* BIG STROKE ENTRY */}
          <View style={styles.entryCard}>
            <View style={styles.entryHeaderRow}>
              <View style={styles.entryHeaderLeft}>
                <View style={[styles.avatar, { backgroundColor: getSolidAvatarColor(Math.max(0, selectedIndex)) }]}>
                  <Text style={styles.avatarLabel}>{initials(selectedPlayer.name)}</Text>
                </View>
                <View>
                  <Text style={styles.entryHeaderTitle}>{selectedPlayerId === viewerId ? 'Your score' : `${selectedPlayer.name}'s score`}</Text>
                  <Text style={styles.entryHeaderMeta}>
                    {selectedPlayer.name} · {isSystem36 ? 'handicap TBD' : `Playing HCP ${selectedPlayer.playingHandicap}`}
                  </Text>
                </View>
              </View>
              {justSaved ? (
                <View style={styles.savedPill}>
                  <Check size={13} color={colors.statusSuccess} />
                  <Text style={styles.savedPillLabel}>Saved</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.stepperRow}>
              <Pressable style={styles.stepperButton} onPress={() => handleStep(-1)} disabled={!canEditPlayer(selectedPlayer.id)}>
                <Minus size={22} color={colors.textDisabled} />
              </Pressable>
              <View style={styles.stepperCenter}>
                <Text style={styles.stepperValue}>{currentValue}</Text>
                <Text style={styles.stepperCaption}>strokes</Text>
              </View>
              <Pressable
                style={[styles.stepperButtonAccent, !canEditPlayer(selectedPlayer.id) && styles.stepperButtonDisabled]}
                onPress={() => handleStep(1)}
                disabled={!canEditPlayer(selectedPlayer.id)}
              >
                <Plus size={24} color={palette.white} />
              </Pressable>
            </View>

            {isSystem36 ? (
              <>
                <View style={[styles.s36DerivedCallout, { backgroundColor: S36_POINT_CHIP[currentS36Pts].fill, borderColor: S36_POINT_CHIP[currentS36Pts].border }]}>
                  <Calculator size={15} color={S36_POINT_CHIP[currentS36Pts].text} />
                  <Text style={styles.s36DerivedText}>
                    {SCORE_CLASS_LABEL[currentClass]} on par {activeHole.par} =
                  </Text>
                  <Text style={[styles.s36DerivedPoints, { color: S36_POINT_CHIP[currentS36Pts].text }]}>
                    {currentS36Pts} pt
                  </Text>
                </View>
                <View style={styles.chipRow}>
                  {s36Chips.map((chip) => {
                    const selected = chip.grossValue === currentValue;
                    const tier = S36_POINT_CHIP[chip.pts];
                    return (
                      <Pressable
                        key={chip.grossValue}
                        style={[styles.chip, { backgroundColor: tier.fill, borderColor: tier.border }, selected && styles.s36ChipSelected]}
                        onPress={() => handlePickChip(chip.grossValue)}
                        disabled={!canEditPlayer(selectedPlayer.id)}
                      >
                        <Text style={[styles.s36ChipLabel, { color: tier.text }, selected && styles.s36ChipLabelSelected]}>
                          {chip.grossValue} · {chip.pts}pt
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : isStableford ? (
              <>
                <View style={[styles.s36DerivedCallout, { backgroundColor: palette.scoreChip[currentNettClass].fill, borderColor: palette.scoreChip[currentNettClass].border }]}>
                  <Calculator size={15} color={palette.scoreChip[currentNettClass].text} />
                  <Text style={styles.s36DerivedText}>
                    Nett {SCORE_CLASS_LABEL[currentNettClass].toLowerCase()}
                    {selectedReceived > 0 ? ` (${selectedReceived} stroke${selectedReceived > 1 ? 's' : ''} here)` : ''} =
                  </Text>
                  <Text style={[styles.s36DerivedPoints, { color: palette.scoreChip[currentNettClass].text }]}>
                    {currentStablefordPts} pt{currentStablefordPts === 1 ? '' : 's'}
                  </Text>
                </View>
                <View style={styles.chipRow}>
                  {chips.map((chip) => {
                    const selected = chip.grossValue === currentValue;
                    const tier = palette.scoreChip[chip.scoreClass];
                    const chipReceived = selectedReceived;
                    const chipPts = stablefordPointsForHole(chip.grossValue - chipReceived, activeHole.par);
                    return (
                      <Pressable
                        key={chip.scoreClass}
                        style={[styles.chip, { backgroundColor: tier.fill, borderColor: tier.border }, selected && styles.s36ChipSelected]}
                        onPress={() => handlePickChip(chip.grossValue)}
                        disabled={!canEditPlayer(selectedPlayer.id)}
                      >
                        <Text style={[styles.s36ChipLabel, { color: tier.text }, selected && styles.s36ChipLabelSelected]}>
                          {chip.grossValue} · {chipPts}pt
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : (
              <View style={styles.chipRow}>
                {chips.map((chip) => {
                  const selected = chip.grossValue === currentValue;
                  const color = CLASS_COLOR[chip.scoreClass];
                  return (
                    <Pressable
                      key={chip.scoreClass}
                      style={[styles.chip, selected && { borderColor: color, borderWidth: 1.5 }, selected && chip.scoreClass === 'par' && styles.chipParSelected]}
                      onPress={() => handlePickChip(chip.grossValue)}
                      disabled={!canEditPlayer(selectedPlayer.id)}
                    >
                      <Text style={[styles.chipLabel, selected && { color, fontWeight: '700' }]}>
                        {chip.grossValue} {SCORE_CLASS_LABEL[chip.scoreClass]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* RUNNING TOTALS */}
          {isSystem36 ? (
            <View>
              <View style={styles.totalsRow}>
                <View style={[styles.totalTile, styles.totalTileS36Pts]}>
                  <Text style={styles.totalTileLabelInverse}>S36 pts</Text>
                  <Text style={styles.totalTileValueInverse}>{s36Pts}</Text>
                </View>
                <View style={styles.totalTile}>
                  <Text style={styles.totalTileLabel}>Gross</Text>
                  <Text style={styles.totalTileValue}>{grossVal}</Text>
                </View>
                <View style={styles.totalTile}>
                  <Text style={styles.totalTileLabel}>Proj HCP</Text>
                  <Text style={styles.totalTileValue}>{projHcp}</Text>
                </View>
                <View style={[styles.totalTile, !s36Settled && styles.totalTileDashed]}>
                  <Text style={styles.totalTileLabel}>Proj Stbf</Text>
                  <Text style={[styles.totalTileValue, !s36Settled && styles.totalTileValueMuted]}>{projStbf ?? '—'}</Text>
                </View>
              </View>
              <View style={styles.s36ProjCaptionRow}>
                <Lock size={12} color={colors.textMuted} />
                <Text style={styles.s36ProjCaption}>
                  Your handicap updates live — 36 minus your points so far. Stableford opens once all {SYSTEM36_TOTAL_HOLES} holes are in.
                </Text>
              </View>
            </View>
          ) : isStableford ? (
            <View style={styles.totalsRow}>
              <View style={[styles.totalTile, styles.totalTileNett]}>
                <Text style={styles.totalTileLabelInverse}>Points</Text>
                <Text style={styles.totalTileValueInverse}>{stablefordPts}</Text>
              </View>
              <View style={styles.totalTile}>
                <Text style={styles.totalTileLabel}>Gross</Text>
                <Text style={styles.totalTileValue}>{grossVal}</Text>
              </View>
              <View style={styles.totalTile}>
                <Text style={styles.totalTileLabel}>Pace</Text>
                <Text style={[styles.totalTileValue, stablefordPace > 0 && styles.totalTileValueAhead, stablefordPace < 0 && styles.totalTileValueOver]}>
                  {stablefordPace > 0 ? `+${stablefordPace}` : stablefordPace}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.totalsRow}>
              <View style={styles.totalTile}>
                <Text style={styles.totalTileLabel}>Gross</Text>
                <Text style={styles.totalTileValue}>{grossVal}</Text>
              </View>
              <View style={[styles.totalTile, styles.totalTileNett]}>
                <Text style={styles.totalTileLabelInverse}>Nett</Text>
                <Text style={styles.totalTileValueInverse}>{nettVal}</Text>
              </View>
              <View style={styles.totalTile}>
                <Text style={styles.totalTileLabel}>To par</Text>
                <Text style={[styles.totalTileValue, toPar > 0 && styles.totalTileValueOver]}>
                  {toPar > 0 ? `+${toPar}` : toPar}
                </Text>
              </View>
            </View>
          )}

          {/* THIS HOLE */}
          <View>
            <View style={styles.thisHoleHeaderRow}>
              <Text style={styles.thisHoleLabel}>This hole · par {activeHole.par}</Text>
              <Text style={styles.thisHoleCount}>
                {enteredCount} of {roster.length} entered
              </Text>
            </View>
            <View style={styles.rosterList}>
              {roster.map((player, index) => (
                <HoleRow
                  key={player.id}
                  player={player}
                  colorIndex={index}
                  isYou={player.id === viewerId}
                  hole={activeHole}
                  grossValue={scores[player.id]?.[activeHole.n]}
                  editable={canEditPlayer(player.id)}
                  isSystem36={isSystem36}
                  isStableford={isStableford}
                  onPress={() => setSelectedPlayerId(player.id)}
                />
              ))}
            </View>
          </View>

          {/* LIVE SKINS · SIDE GAME */}
          {skinsConfig && openStake.stake > 0 ? (
            <View style={styles.skinsCard}>
              <View style={styles.skinsCardHeader}>
                <View style={styles.skinsIconTile}>
                  <Coins size={17} color={colors.accent} />
                </View>
                <View style={styles.skinsCardBody}>
                  <Text style={styles.skinsOverline}>Skins · side game</Text>
                  <Text style={styles.skinsBankLine}>${bankThisHole} to bank this hole</Text>
                  <Text style={styles.skinsOnLineLine}>${onLineThisHole} on the line for this hole</Text>
                </View>
                <View style={styles.skinsStakeCol}>
                  <Text style={styles.skinsStakeValue}>${skinsConfig.stakePerHole}</Text>
                  <Text style={styles.skinsStakeCaption}>per skin</Text>
                </View>
              </View>
              {openStake.carriedFromHoles.length > 0 ? (
                <View style={styles.skinsCarryRow}>
                  <Repeat size={15} color={colors.primary} />
                  <Text style={styles.skinsCarryText}>
                    {openStake.stake} skins on this hole ({openStake.carriedFromHoles.length} carried from {openStake.carriedFromHoles.join(' · ')})
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {/* Not gated on viewerScoredActiveHole like the header chevron — the
              stepper shows par by default the moment you land on a hole, so
              this CTA COMMITS that shown value (see handleNextHole) rather than
              demanding an explicit tap first. That keeps a par hole you never
              touched from being silently skipped. */}
          <Pressable style={styles.nextButton} onPress={handleNextHole}>
            <Text style={styles.nextButtonLabel}>{holePos >= playOrder.length - 1 ? 'Save & review' : 'Next hole'}</Text>
            <ArrowRight size={18} color={palette.white} />
          </Pressable>
        </View>

        <InRoundTabBar active="scorecard" onNavigate={handleTabNavigate} leaderboardLocked={isSystem36 && round.thru < 18} />
      </SafeAreaView>
    </View>
  );
}

function HoleRow({
  player,
  colorIndex,
  isYou,
  hole,
  grossValue,
  editable,
  isSystem36,
  isStableford,
  onPress,
}: {
  player: TournamentRoundPlayer;
  colorIndex: number;
  isYou: boolean;
  hole: { n: number; par: number; si: number };
  grossValue: number | undefined;
  editable: boolean;
  isSystem36: boolean;
  isStableford: boolean;
  onPress: () => void;
}) {
  const entered = grossValue !== undefined;
  const received = strokesReceivedOnHole(player.playingHandicap, hole.si);
  const grossClass = entered ? classifyDiff(grossValue - hole.par) : null;
  const nettClass = entered ? classifyDiff(grossValue - received - hole.par) : null;

  // System 36 applies no strokes during play, so the rail is purely gross →
  // this hole's S36 points; Stableford shows the nett score-term first (it's
  // what the points chip is actually derived from), then gross for context;
  // plain stroke play shows the gross-term-led notation.
  const s36Pts = entered && isSystem36 ? s36PointsForHole(grossValue, hole.par) : 0;
  const stablefordPts = entered && isStableford ? stablefordPointsForHole(grossValue - received, hole.par) : 0;
  const subtitle = !entered
    ? 'Waiting for score'
    : isSystem36
      ? `${SCORE_CLASS_LABEL[grossClass!]} · gross ${grossValue}`
      : isStableford
        ? `${SCORE_CLASS_LABEL[nettClass!]} · gross ${grossValue}${isYou && received > 0 ? ` · ${received} stroke${received > 1 ? 's' : ''} here` : ''}`
        : `${SCORE_CLASS_LABEL[grossClass!]} · nett ${SCORE_CLASS_LABEL[nettClass!].toLowerCase()}${isYou && received > 0 ? ` · ${received} stroke${received > 1 ? 's' : ''} here` : ''}`;

  return (
    <Pressable style={[styles.holeRow, !entered && styles.holeRowPending]} onPress={onPress} disabled={!editable}>
      <View style={[styles.holeRowAvatar, { backgroundColor: getSolidAvatarColor(colorIndex) }]}>
        <Text style={styles.avatarLabel}>{initials(player.name)}</Text>
      </View>
      <View style={styles.holeRowBody}>
        <Text style={styles.holeRowName}>
          {player.name}
          {isYou ? ' (you)' : ''}
        </Text>
        <Text
          style={[
            styles.holeRowSubtitle,
            !entered && styles.holeRowSubtitlePending,
            entered && isSystem36 ? { color: CLASS_COLOR[grossClass!] } : null,
            entered && isStableford ? { color: CLASS_COLOR[nettClass!] } : null,
          ]}
        >
          {subtitle}
        </Text>
      </View>
      {entered ? (
        isSystem36 ? (
          <View style={[styles.s36PointPill, { backgroundColor: S36_POINT_CHIP[s36Pts].fill, borderColor: S36_POINT_CHIP[s36Pts].border }]}>
            <Text style={[styles.s36PointPillLabel, { color: S36_POINT_CHIP[s36Pts].text }]}>{s36Pts} pt</Text>
          </View>
        ) : isStableford ? (
          <View style={[styles.s36PointPill, { backgroundColor: palette.scoreChip[nettClass!].fill, borderColor: palette.scoreChip[nettClass!].border }]}>
            <Text style={[styles.s36PointPillLabel, { color: palette.scoreChip[nettClass!].text }]}>{stablefordPts} pt</Text>
          </View>
        ) : (
          <ScoreCell value={grossValue!} par={hole.par} strokesReceived={received} size={38} />
        )
      ) : (
        <View style={styles.enterPill}>
          <Text style={styles.enterPillLabel}>Enter</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surfacePage },
  safeArea: { flex: 1 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: colors.textDisabled,
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
  headerTitleGroup: { flex: 1, minWidth: 0 },
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
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexShrink: 0,
  },
  cardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
    height: 32,
    paddingHorizontal: spacing[3],
    borderRadius: radius.pill,
    backgroundColor: palette.white,
  },
  cardButtonLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 12,
    color: colors.primary,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.pill,
    paddingVertical: spacing[1] + 2,
    paddingHorizontal: spacing[2] + 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  statusPillLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    color: palette.orange[300],
  },
  headerDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginTop: spacing[3] + 2,
  },
  holeNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[3] + 2,
  },
  holeNavCenterGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3] + 2,
    paddingHorizontal: spacing[2],
  },
  holeNavHoleNumber: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 28,
    lineHeight: 28,
    color: palette.white,
  },
  holeNavDivider: {
    width: 1,
    height: 34,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  holeNavSpecRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[2] + 1,
  },
  holeNavSpecPar: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 18,
    color: palette.white,
  },
  holeNavSpecSi: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.82)',
  },
  holeNavSub: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: 'rgba(255,255,255,0.62)',
    marginTop: 5,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: screenGutter, paddingTop: spacing[4], paddingBottom: spacing[4], gap: spacing[3] + 2 },
  entryCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.lg,
    padding: spacing[4],
    paddingBottom: spacing[4] + 2,
  },
  entryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  entryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
    flexShrink: 1,
    minWidth: 0,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 13,
    color: palette.white,
  },
  entryHeaderTitle: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: colors.textPrimary,
  },
  entryHeaderMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: 1,
  },
  savedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1,
    borderColor: palette.green[200],
    borderRadius: radius.pill,
    paddingHorizontal: spacing[2] + 2,
    paddingVertical: spacing[1] + 1,
    flexShrink: 0,
  },
  savedPillLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    color: colors.statusSuccess,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[5],
  },
  stepperButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepperButtonAccent: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepperButtonDisabled: {
    opacity: 0.5,
  },
  stepperCenter: { alignItems: 'center' },
  stepperValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 64,
    lineHeight: 64,
    color: colors.primary,
  },
  stepperCaption: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing[1] + 2,
    marginTop: spacing[4],
  },
  chip: {
    flex: 1,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipParSelected: {
    backgroundColor: colors.surfaceBrandSoft,
  },
  chipLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    color: colors.textDisabled,
  },
  totalsRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  totalTile: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2] + 2,
    alignItems: 'center',
  },
  totalTileNett: {
    backgroundColor: colors.primary,
    borderWidth: 0,
  },
  totalTileLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.textDisabled,
    textTransform: 'uppercase',
  },
  totalTileLabelInverse: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    letterSpacing: 0.6,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
  },
  totalTileValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 24,
    color: colors.textPrimary,
    marginTop: 3,
  },
  totalTileValueOver: {
    color: colors.scoreDouble,
  },
  totalTileValueAhead: {
    color: colors.statusSuccess,
  },
  totalTileValueInverse: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 24,
    color: palette.white,
    marginTop: 3,
  },
  // ---- System 36 (SY7) ----
  s36DerivedCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    marginTop: spacing[3],
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingVertical: spacing[2] + 1,
    paddingHorizontal: spacing[3],
  },
  s36DerivedText: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: colors.textMuted,
  },
  s36DerivedPoints: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 16,
  },
  s36ChipSelected: {
    borderWidth: 2,
  },
  s36ChipLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
  },
  s36ChipLabelSelected: {
    fontWeight: '700',
  },
  totalTileS36Pts: {
    backgroundColor: colors.primary,
    borderWidth: 0,
  },
  totalTileDashed: {
    backgroundColor: colors.surfaceMutedTile,
    borderStyle: 'dashed',
  },
  totalTileValueMuted: {
    color: colors.textMuted,
  },
  s36ProjCaptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[1] + 2,
    marginTop: spacing[2],
    paddingHorizontal: 2,
  },
  s36ProjCaption: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    color: colors.textMuted,
    lineHeight: 14,
  },
  s36PointPill: {
    minWidth: 48,
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.sm + 1,
    paddingVertical: spacing[1] + 1,
    paddingHorizontal: spacing[2],
  },
  s36PointPillLabel: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 14,
  },
  thisHoleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  thisHoleLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  thisHoleCount: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
  },
  rosterList: {
    gap: spacing[1] + 3,
  },
  holeRow: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: palette.green[200],
    borderRadius: radius.md,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 2,
  },
  holeRowPending: {
    borderStyle: 'dashed',
    borderColor: colors.borderDefault,
  },
  holeRowAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  holeRowBody: { flex: 1, minWidth: 0 },
  holeRowName: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.textPrimary,
  },
  holeRowSubtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.statusSuccess,
    marginTop: 1,
  },
  holeRowSubtitlePending: {
    color: colors.scoreEagle,
  },
  enterPill: {
    borderRadius: radius.sm + 1,
    backgroundColor: '#FBEFD0',
    borderWidth: 1.5,
    borderColor: '#E5CE8E',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
    flexShrink: 0,
  },
  enterPillLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: '#9A6B12',
  },
  skinsCard: {
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.lg - 2,
    overflow: 'hidden',
  },
  skinsCardHeader: {
    backgroundColor: colors.primary,
    padding: spacing[3] + 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
  },
  skinsIconTile: {
    width: 32,
    height: 32,
    borderRadius: radius.sm + 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  skinsCardBody: { flex: 1, minWidth: 0 },
  skinsOverline: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.72)',
    textTransform: 'uppercase',
  },
  skinsBankLine: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: palette.white,
    marginTop: 1,
  },
  skinsOnLineLine: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: palette.orange[300],
    marginTop: 1,
  },
  skinsStakeCol: { alignItems: 'flex-end', flexShrink: 0 },
  skinsStakeValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 18,
    color: palette.white,
  },
  skinsStakeCaption: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
  },
  skinsCarryRow: {
    backgroundColor: colors.surfacePage,
    padding: spacing[2] + 2,
    paddingHorizontal: spacing[3] + 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
  },
  skinsCarryText: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[2] + 2,
    paddingBottom: spacing[2] + 2,
  },
  nextButton: {
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2] + 1,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 16,
    color: palette.white,
  },
});
