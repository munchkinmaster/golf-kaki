import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Activity, ArrowRight, Check, CircleCheckBig, Eye, Info, ListOrdered, Lock, Table2, Trophy } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { InRoundTabBar } from '../components/InRoundTabBar';
import type { InRoundTab } from '../components/InRoundTabBar';
import { ScoreCell } from '../components/ScoreCell';
import { strokesReceivedOnHole } from '../data/handicap';
import { SYSTEM36_TOTAL_HOLES, s36Handicap, s36PointsForHole, stablefordPointsForHole } from '../data/system36';
import { useFinishRedirect } from '../hooks/useFinishRedirect';
import { useTournamentOverview } from '../hooks/useTournamentOverview';
import { formatToPar } from '../components/MultiRoundLobby';
import { fetchCourseCatalog } from '../data/courses';
import { computeAggregateStandings, ordinal, pickCurrentRound, roundsThrough } from '../data/multiRound';
import { formatRoundDate } from '../data/roundDates';
import { useTournamentRound } from '../hooks/useTournamentRound';
import type { RootStackParamList } from '../navigation/types';
import { colors, getFontFamily, getSolidAvatarColor, palette, radius, screenGutter, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'TournamentScorecardGrid'>;

type NineSide = 'front' | 'back';

// Low-opacity brand emblem in the header's top-right corner — same asset/
// convention as Card.tsx's watermark, applied here directly since this
// header isn't a Card (it's a full-bleed green band, not a rounded card).
const WATERMARK_SOURCE = require('../assets/golf-kaki-mark-white.png');

function firstName(name: string): string {
  return name.split(' ')[0] ?? name;
}

/** The four things the finished System 36 card can show per hole. gross/nett
 * render strokes (ScoreCell); s36pts/stbf render the point earned that hole. */
type GridView = 'gross' | 'nett' | 's36pts' | 'stbf';

type PointChip = { fill: string; border: string; text: string };
// Per-hole point → colour tier, reusing the same chips as the "how scoring
// works" reference cards so a 2 here reads the same green as a 2 there.
const S36_POINT_CHIP: Record<number, PointChip> = {
  2: palette.scoreChip.par,
  1: palette.scoreChip.bogey,
  0: palette.scoreChip.double,
};
const STBF_POINT_CHIP: Record<number, PointChip> = {
  5: palette.scoreChip.albatross,
  4: palette.scoreChip.eagle,
  3: palette.scoreChip.birdie,
  2: palette.scoreChip.par,
  1: palette.scoreChip.bogey,
  0: palette.scoreChip.double,
};

/** A grid cell that shows a points value (S36 or Stableford) tinted by tier —
 * the points-view counterpart to ScoreCell's stroke notation. */
function PointCell({ points, chip, size = 28 }: { points: number | undefined; chip: PointChip | undefined; size?: number }) {
  const badge = size - 6;
  const fontSize = Math.round(badge * 0.5);
  if (points === undefined || !chip) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textDisabled, fontFamily: getFontFamily('numeric', '600'), fontSize }}>–</Text>
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: badge,
          height: badge,
          borderRadius: radius.xs + 2,
          backgroundColor: chip.fill,
          borderWidth: 1,
          borderColor: chip.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: chip.text, fontFamily: getFontFamily('numeric', '700'), fontWeight: '700', fontSize, fontVariant: ['tabular-nums'] }}>
          {points}
        </Text>
      </View>
    </View>
  );
}

export function TournamentScorecardGridScreen({ navigation, route }: Props) {
  const { tournamentId, matchId } = route.params;
  const round = useTournamentRound(tournamentId, matchId);
  const { loading, error, viewerId, roster, holes, playOrder, scores, thru, standingsBasis, matchStatus } = round;

  useFinishRedirect(
    matchStatus,
    loading,
    useCallback(() => navigation.navigate('TournamentFinish', { tournamentId, matchId }), [navigation, tournamentId, matchId]),
  );

  // MR8 — a multi-round tournament's card gets round tabs; done rounds are view-only.
  const overview = useTournamentOverview(tournamentId, round);
  const [courseName, setCourseName] = useState<string | null>(null);
  useEffect(() => {
    if (!round.courseId || round.roundsCount < 2) return;
    let cancelled = false;
    fetchCourseCatalog()
      .then((catalog) => !cancelled && setCourseName(catalog.find((c) => c.id === round.courseId)?.name ?? null))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [round.courseId, round.roundsCount]);

  const [nineOverride, setNineOverride] = useState<NineSide | null>(null);
  const [statMode, setStatMode] = useState<GridView>('nett');

  // Defaults to whichever basis the tournament actually ranks by (nett for
  // both 'nett' and 'both' — S9/S10 only ever render nett standings, see
  // tournaments.ts's standings_basis comment), applied once the round's data
  // is in. A ref, not a dependency-gated effect, so it only ever sets the
  // *initial* value — it must never stomp a manual tap on the Gross/Nett tile.
  const statModeInitialized = useRef(false);
  useEffect(() => {
    if (statModeInitialized.current || loading) return;
    statModeInitialized.current = true;
    setStatMode(standingsBasis === 'gross' ? 'gross' : 'nett');
  }, [loading, standingsBasis]);

  if (loading) {
    return (
      <View style={styles.page}>
        <SafeAreaView style={styles.centerFill}>
          <Text style={styles.loadingText}>Loading scorecard…</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (error || holes.length === 0) {
    return (
      <View style={styles.page}>
        <SafeAreaView style={styles.centerFill}>
          <Text style={styles.loadingText}>{error ?? "Couldn't load this round."}</Text>
        </SafeAreaView>
      </View>
    );
  }

  // Front/back are literal scorecard halves (hole numbers 1-9 / 10-18), not
  // play-order-relative — same convention as round.ts's sumRange, and the
  // same auto-follow-then-manual-override pattern the old ScorecardScreen
  // used for its nine toggle.
  const defaultNine: NineSide = thru >= 9 ? 'back' : 'front';
  const nine = nineOverride ?? defaultNine;
  const [rangeStart, rangeEnd] = nine === 'front' ? [0, 9] : [9, 18];
  const displayHoles = holes.slice(rangeStart, rangeEnd);

  const isSystem36 = round.scoringFormat === 'system_36';
  const isStableford = round.scoringFormat === 'stableford';

  // Gap-tolerant totals: sum over the holes a player has ACTUALLY entered, not
  // computeThru's consecutive-from-start prefix. A player can leave a hole
  // blank and fill a later one (back nine first, a skipped hole, an out-of-
  // order entry), and the prefix stalls at the first gap — which collapsed the
  // grid's IN/OUT summary and the total tiles to just the first committed hole.
  const parByN = new Map(holes.map((h) => [h.n, h.par]));
  const siByN = new Map(holes.map((h) => [h.n, h.si]));
  // Hole numbers this player has entered, optionally bounded to a scorecard
  // half (loEx/hiIncl are hole-number bounds: front = 0..9, back = 9..18).
  const enteredNs = (playerId: string, loEx = 0, hiIncl = 18): number[] =>
    holes.map((h) => h.n).filter((n) => n > loEx && n <= hiIncl && scores[playerId]?.[n] !== undefined);
  const sumGross = (playerId: string, loEx = 0, hiIncl = 18): number =>
    enteredNs(playerId, loEx, hiIncl).reduce((sum, n) => sum + (scores[playerId]![n] ?? 0), 0);
  const sumPar = (playerId: string, loEx = 0, hiIncl = 18): number =>
    enteredNs(playerId, loEx, hiIncl).reduce((sum, n) => sum + (parByN.get(n) ?? 0), 0);
  const sumS36 = (playerId: string, loEx = 0, hiIncl = 18): number =>
    enteredNs(playerId, loEx, hiIncl).reduce((sum, n) => sum + s36PointsForHole(scores[playerId]![n]!, parByN.get(n) ?? 0), 0);
  const sumNett = (playerId: string, hcp: number, loEx = 0, hiIncl = 18): number =>
    enteredNs(playerId, loEx, hiIncl).reduce((sum, n) => sum + (scores[playerId]![n]! - strokesReceivedOnHole(hcp, siByN.get(n) ?? n)), 0);
  const sumStbf = (playerId: string, hcp: number, loEx = 0, hiIncl = 18): number =>
    enteredNs(playerId, loEx, hiIncl).reduce(
      (sum, n) => sum + stablefordPointsForHole(scores[playerId]![n]! - strokesReceivedOnHole(hcp, siByN.get(n) ?? n), parByN.get(n) ?? 0),
      0,
    );
  const enteredCountFor = (playerId: string): number => enteredNs(playerId).length;

  const viewer = roster.find((p) => p.id === viewerId);
  const viewerEntered = viewerId ? enteredCountFor(viewerId) : 0;
  const viewerGross = viewerId ? sumGross(viewerId) : 0;
  const viewerNett = viewerId && viewer ? sumNett(viewerId, viewer.playingHandicap) : 0;
  const viewerToPar = viewerId ? viewerNett - sumPar(viewerId) : 0;
  // Stableford points off the viewer's own (ordinary, upfront) Playing
  // Handicap — reuses sumStbf exactly as-is (it already takes an arbitrary
  // handicap; System 36 just happens to pass its derived one instead).
  const viewerStablefordPts = viewerId && viewer ? sumStbf(viewerId, viewer.playingHandicap) : 0;
  // Clamps statMode (shared with the other two branches) to the 3 views
  // Stableford's tiles actually offer — 's36pts' can never be reached here
  // since only System 36's tiles ever set it.
  const sbView: 'gross' | 'nett' | 'stbf' = statMode === 's36pts' ? 'gross' : statMode;

  // System 36 mid-round figures for the viewer (SY8): S36 points and the live
  // 36 − points handicap are true as of holes played; nett/Stableford stay
  // suppressed until all 18 are in (see the footnote + muted tiles).
  const viewerS36Pts = viewerId ? sumS36(viewerId) : 0;
  const viewerS36Hcp = s36Handicap(viewerS36Pts);
  const s36Settled = viewerEntered >= SYSTEM36_TOTAL_HOLES;
  // The whole field is in → this is the settled final card (SY8b/SY8c): the
  // Gross/Nett tiles become a live view toggle, S36 hcp/Stbf settle orange,
  // and the nett view spends the derived handicap as stroke-receive pips.
  const s36Finished = isSystem36 && thru >= SYSTEM36_TOTAL_HOLES;
  const s36View: GridView = s36Finished ? statMode : 'gross';
  // Which derivation family the current view belongs to — gross/s36pts both
  // come off gross; nett/stbf both come off the derived-handicap nett. Drives
  // the summary rows, legend and footnote (which are per-family, not per-view;
  // only the hole cells differ between a family's stroke and points views).
  const s36Family: 'gross' | 'nett' = s36View === 'nett' || s36View === 'stbf' ? 'nett' : 'gross';
  const s36ViewLabel = s36View === 'gross' ? 'gross' : s36View === 'nett' ? 'nett' : s36View === 's36pts' ? 'S36 pts' : 'Stableford';
  // Each player's DERIVED handicap (36 − their own points) — System 36 never
  // uses match_players.playing_handicap, so nett/pips/Stableford all key off
  // this instead. Only meaningful once a card is complete.
  const s36HcpByPlayer: Record<string, number> = {};
  roster.forEach((p) => {
    s36HcpByPlayer[p.id] = s36Handicap(sumS36(p.id));
  });
  const viewerStbf = viewerId ? sumStbf(viewerId, viewerS36Hcp) : 0;
  const viewerNettS36 = viewerId ? sumNett(viewerId, viewerS36Hcp) : 0;

  const thisRound = overview?.rounds.find((r) => r.matchId === matchId) ?? null;
  const currentRound = overview ? (pickCurrentRound(overview.rounds)?.current ?? null) : null;
  // Looking back at a finished round while a later one is the tournament's current round.
  const viewingPast = thisRound?.status === 'done' && currentRound !== null && currentRound.index !== thisRound.index && currentRound.matchId !== null;
  const roundPrefix = overview ? `R${round.roundIndex} ` : '';
  const tournamentAfter = (() => {
    if (!overview || !viewerId) return null;
    const rows = computeAggregateStandings(overview.rosterIds, roundsThrough(overview.rounds, round.roundIndex), overview.entries, overview.tieBreakRule);
    const me = rows.find((r) => r.playerId === viewerId);
    return me && me.rank !== null ? { toPar: me.totalToPar, place: ordinal(me.rank) } : null;
  })();
  const switchRound = (targetMatchId: string) => {
    if (targetMatchId !== matchId) navigation.replace('TournamentScorecardGrid', { tournamentId, matchId: targetMatchId });
  };

  function handleTabNavigate(tab: InRoundTab) {
    if (tab === 'scorecard') navigation.goBack();
    else if (tab === 'lobby') navigation.navigate('TournamentLobby', { tournamentId, matchId });
    else if (tab === 'leaderboard') navigation.navigate('TournamentLeaderboard', { tournamentId, matchId });
    else if (tab === 'finish') navigation.navigate('TournamentFinish', { tournamentId, matchId });
  }

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerWatermarkLayer} pointerEvents="none">
            <Image source={WATERMARK_SOURCE} style={styles.headerWatermark} />
          </View>
          <View style={styles.headerTopRow}>
            <View style={styles.headerTitleGroup}>
              <Text style={styles.headerTitle}>Scorecard</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {overview
                  ? `${round.matchName}${courseName ? ` · ${courseName}` : ''}`
                  : isSystem36
                  ? s36Finished
                    ? 'System 36 · final card'
                    : 'System 36 · in progress'
                  : `${isStableford ? 'Stableford' : 'Stroke play'} · Nett ${round.handicapAllowancePct}%`}
              </Text>
            </View>
            <View style={styles.headerActions}>
              {/* During play this flips back to the per-hole entry screen ("Score").
                  Once finished, goBack lands on the Finish screen's final standings,
                  so the entry-screen wording would be wrong — relabel to "Standings". */}
              <Pressable style={styles.scoreButton} onPress={() => navigation.goBack()}>
                {matchStatus === 'finished' ? <ListOrdered size={15} color={colors.primary} /> : <Table2 size={15} color={colors.primary} />}
                <Text style={styles.scoreButtonLabel}>{matchStatus === 'finished' ? 'Standings' : 'Score'}</Text>
              </Pressable>
              {overview && matchStatus === 'finished' ? (
                <View style={styles.statusPill}>
                  <Lock size={12} color={palette.white} />
                  <Text style={[styles.statusPillLabel, styles.statusPillLabelFinal]}>R{round.roundIndex} FINAL</Text>
                </View>
              ) : s36Finished ? (
                <View style={styles.finalPill}>
                  <CircleCheckBig size={15} color={colors.primary} />
                  <Text style={styles.finalPillLabel}>FINAL</Text>
                </View>
              ) : (
                <View style={styles.statusPill}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusPillLabel}>THRU {viewerEntered}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.headerDivider} />
          {overview ? (
            <View style={styles.roundTabs}>
              {overview.rounds.map((r) => {
                const active = r.matchId === matchId;
                const disabled = r.matchId === null || r.status === 'planned';
                return (
                  <Pressable
                    key={r.index}
                    style={[styles.roundTab, active && styles.nineToggleOptionActive]}
                    disabled={disabled}
                    onPress={() => r.matchId && switchRound(r.matchId)}
                    accessibilityLabel={`Round ${r.index}`}
                  >
                    {r.status === 'done' ? (
                      <Check size={13} color={active ? colors.primary : palette.white} />
                    ) : r.status === 'live' ? (
                      <View style={styles.liveDot} />
                    ) : disabled ? (
                      <Lock size={12} color={palette.multiRound.timeline.labelUpcoming} />
                    ) : null}
                    <Text
                      numberOfLines={1}
                      style={[styles.nineToggleLabel, active && styles.nineToggleLabelActive, disabled && styles.roundTabLabelDisabled]}
                    >
                      Round {r.index}
                      {r.status === 'live' ? ' · live' : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <View style={[styles.nineToggle, overview && styles.nineToggleAfterTabs]}>
            <Pressable style={[styles.nineToggleOption, nine === 'front' && styles.nineToggleOptionActive]} onPress={() => setNineOverride('front')}>
              <Text style={[styles.nineToggleLabel, nine === 'front' && styles.nineToggleLabelActive]}>Front 9</Text>
            </Pressable>
            <Pressable style={[styles.nineToggleOption, nine === 'back' && styles.nineToggleOptionActive]} onPress={() => setNineOverride('back')}>
              <Text style={[styles.nineToggleLabel, nine === 'back' && styles.nineToggleLabelActive]}>Back 9</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {viewingPast && thisRound && currentRound?.matchId ? (
            <View style={styles.pastBanner}>
              <Eye size={15} color={colors.textMuted} />
              <Text style={styles.pastBannerText} numberOfLines={1}>
                Round {thisRound.index} · {formatRoundDate(thisRound.date)} · view only
              </Text>
              <Pressable style={styles.pastBannerLink} onPress={() => switchRound(currentRound.matchId!)} hitSlop={8}>
                <Text style={styles.pastBannerLinkLabel}>Back to R{currentRound.index}</Text>
                <ArrowRight size={14} color={palette.multiRound.required.text} />
              </Pressable>
            </View>
          ) : null}
          {isSystem36 ? (
            <>
              {/* TRANSPOSED GRID — holes as rows, players as columns (SY8).
                  minWidth:'100%' + flexGrow lets the player columns stretch to
                  fill the card full-width on a normal phone, while still falling
                  back to horizontal scroll when the field is too wide to fit. */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tGridScrollContent}>
                <View style={styles.tGridContent}>
                  {/* HEADER */}
                  <View style={[styles.tRow, styles.tHeaderRow]}>
                    <Text style={[styles.tHeadCell, styles.tHCol]}>H</Text>
                    <Text style={[styles.tHeadCell, styles.tParCol]}>Par</Text>
                    <Text style={[styles.tHeadCell, styles.tSiCol]}>SI</Text>
                    {roster.map((player, index) => {
                      const isYou = player.id === viewerId;
                      return (
                        <View key={player.id} style={[styles.tPlayerHead, isYou && styles.tColYou, isYou && styles.tColYouTop]}>
                          <View style={[styles.tPlayerAvatar, { backgroundColor: getSolidAvatarColor(index) }]}>
                            <Text style={styles.tPlayerAvatarLabel}>{player.name[0]?.toUpperCase()}</Text>
                          </View>
                          <Text style={[styles.tPlayerName, isYou && styles.tPlayerNameYou]} numberOfLines={1}>
                            {isYou ? 'You' : firstName(player.name)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  {/* HOLE ROWS */}
                  {displayHoles.map((h, rowIdx) => (
                    <View key={h.n} style={[styles.tRow, styles.tHoleRow, rowIdx === displayHoles.length - 1 && styles.tHoleRowLast]}>
                      <Text style={[styles.tNumCell, styles.tHCol]}>{h.n}</Text>
                      <Text style={[styles.tMetaCell, styles.tParCol]}>{h.par}</Text>
                      <Text style={[styles.tMetaCell, styles.tSiCol]}>{h.si}</Text>
                      {roster.map((player) => {
                        const isYou = player.id === viewerId;
                        const raw = scores[player.id]?.[h.n];
                        const hcp = s36HcpByPlayer[player.id] ?? 0;
                        // Points views (s36pts/stbf) show the point earned that
                        // hole, tinted by tier — S36 off raw gross, Stableford
                        // off the derived-handicap nett.
                        if (s36View === 's36pts' || s36View === 'stbf') {
                          const pts =
                            raw === undefined
                              ? undefined
                              : s36View === 's36pts'
                                ? s36PointsForHole(raw, h.par)
                                : stablefordPointsForHole(raw - strokesReceivedOnHole(hcp, h.si), h.par);
                          const chip = pts === undefined ? undefined : s36View === 's36pts' ? S36_POINT_CHIP[pts] : STBF_POINT_CHIP[pts];
                          return (
                            <View key={player.id} style={[styles.tCellWrap, isYou && styles.tColYou]}>
                              <PointCell points={pts} chip={chip} size={28} />
                            </View>
                          );
                        }
                        // Stroke views: nett spends the derived handicap (green
                        // pip per stroke received); gross shows raw gross, no pips.
                        const received = s36View === 'nett' ? strokesReceivedOnHole(hcp, h.si) : 0;
                        const value = raw === undefined ? undefined : s36View === 'nett' ? raw - received : raw;
                        return (
                          <View key={player.id} style={[styles.tCellWrap, isYou && styles.tColYou]}>
                            <ScoreCell value={value} par={h.par} strokesReceived={received} size={28} />
                          </View>
                        );
                      })}
                    </View>
                  ))}
                  {/* SUMMARY A — the family's stroke total (gross out/in, or nett out/in) */}
                  <View style={[styles.tRow, styles.tSummaryRow]}>
                    <Text style={styles.tSummaryLabel}>
                      {s36Family === 'nett' ? (nine === 'front' ? 'Nett out' : 'Nett in') : nine === 'front' ? 'Out' : 'In'}
                    </Text>
                    {roster.map((player) => {
                      const val =
                        s36Family === 'nett'
                          ? sumNett(player.id, s36HcpByPlayer[player.id] ?? 0, rangeStart, rangeEnd)
                          : sumGross(player.id, rangeStart, rangeEnd);
                      return (
                        <Text key={player.id} style={styles.tSummaryCell}>
                          {val}
                        </Text>
                      );
                    })}
                  </View>
                  {/* SUMMARY B — the family's points total (S36 pts, or Stableford pts) */}
                  <View style={[styles.tRow, styles.tSummaryRow, styles.tSummaryRowLast]}>
                    <Text style={styles.tSummaryLabel}>{s36Family === 'nett' ? 'Stbf pts' : 'S36 pts'}</Text>
                    {roster.map((player) => {
                      const val =
                        s36Family === 'nett'
                          ? sumStbf(player.id, s36HcpByPlayer[player.id] ?? 0, rangeStart, rangeEnd)
                          : sumS36(player.id, rangeStart, rangeEnd);
                      return (
                        <Text key={player.id} style={[styles.tSummaryCell, styles.tSummaryCellAccent]}>
                          {val}
                        </Text>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>

              {/* CAPTION */}
              <View style={styles.s36CaptionRow}>
                {s36Finished ? <Lock size={11} color={colors.textMuted} /> : <Activity size={11} color={colors.textMuted} />}
                <Text style={styles.s36CaptionText}>
                  {s36Finished ? `Final · 18 holes · ${s36ViewLabel}` : `As it stands · ${viewerEntered} in`}
                </Text>
              </View>

              {/* TOTALS TILES — Gross/Nett double as the view switch once final */}
              <View style={styles.s36TilesRow}>
                <Pressable
                  style={[styles.s36Tile, s36View === 'gross' && styles.s36TileActive]}
                  onPress={() => s36Finished && setStatMode('gross')}
                  disabled={!s36Finished}
                >
                  <Text style={[styles.s36TileLabel, s36View === 'gross' && styles.s36TileLabelInverse]}>Gross</Text>
                  <Text style={[styles.s36TileValue, s36View === 'gross' && styles.s36TileValueInverse]}>{viewerGross}</Text>
                </Pressable>
                <Pressable
                  style={[styles.s36Tile, s36Finished && s36View === 'nett' && styles.s36TileActive, !s36Finished && styles.s36TileMuted]}
                  onPress={() => s36Finished && setStatMode('nett')}
                  disabled={!s36Finished}
                >
                  <Text
                    style={[
                      styles.s36TileLabel,
                      !s36Finished && styles.s36TileLabelMuted,
                      s36Finished && s36View === 'nett' && styles.s36TileLabelInverse,
                    ]}
                  >
                    Nett
                  </Text>
                  <Text
                    style={[
                      styles.s36TileValue,
                      !s36Finished && styles.s36TileValueMuted,
                      s36Finished && s36View === 'nett' && styles.s36TileValueInverse,
                    ]}
                  >
                    {s36Finished ? viewerNettS36 : '—'}
                  </Text>
                </Pressable>
                {/* S36 pts view — cells show the S36 point earned per hole. */}
                <Pressable
                  style={[styles.s36Tile, s36Finished && s36View === 's36pts' && styles.s36TileActive]}
                  onPress={() => s36Finished && setStatMode('s36pts')}
                  disabled={!s36Finished}
                >
                  <Text style={[styles.s36TileLabel, s36Finished && s36View === 's36pts' && styles.s36TileLabelInverse]}>S36 pts</Text>
                  <Text style={[styles.s36TileValue, s36Finished && s36View === 's36pts' && styles.s36TileValueInverse]}>{viewerS36Pts}</Text>
                </Pressable>
              </View>
              <View style={styles.s36TilesRow}>
                <View style={[styles.s36Tile, s36Finished && styles.s36TileSettled]}>
                  <Text style={[styles.s36TileLabel, s36Finished && styles.s36TileLabelSettled]}>S36 hcp</Text>
                  <Text style={[styles.s36TileValue, s36Finished && styles.s36TileValueSettled]}>{viewerS36Hcp}</Text>
                </View>
                {/* Stbf pts view — cells show the Stableford point earned per
                    hole. Green while active; otherwise keeps its settled-orange
                    result styling. */}
                <Pressable
                  style={[
                    styles.s36Tile,
                    s36Finished && s36View === 'stbf' ? styles.s36TileActive : s36Finished ? styles.s36TileSettled : styles.s36TileMuted,
                  ]}
                  onPress={() => s36Finished && setStatMode('stbf')}
                  disabled={!s36Finished}
                >
                  <Text
                    style={[
                      styles.s36TileLabel,
                      s36Finished && s36View === 'stbf' ? styles.s36TileLabelInverse : s36Finished ? styles.s36TileLabelSettled : styles.s36TileLabelMuted,
                    ]}
                  >
                    Stbf pts
                  </Text>
                  <Text
                    style={[
                      styles.s36TileValue,
                      s36Finished && s36View === 'stbf' ? styles.s36TileValueInverse : s36Finished ? styles.s36TileValueSettled : styles.s36TileValueMuted,
                    ]}
                  >
                    {s36Finished ? viewerStbf : '—'}
                  </Text>
                </Pressable>
              </View>

              {/* LEGEND */}
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={styles.legendCircle} />
                  <Text style={styles.legendText}>{s36Family === 'nett' ? 'Nett birdie+' : 'Birdie+ (2 pt)'}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={styles.legendParDot} />
                  <Text style={styles.legendText}>{s36Family === 'nett' ? 'Nett par' : 'Par (2 pt)'}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={styles.legendSquareBogey} />
                  <Text style={styles.legendText}>{s36Family === 'nett' ? 'Nett bogey' : 'Bogey (1 pt)'}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={styles.legendSquareDouble} />
                  <Text style={styles.legendText}>{s36Family === 'nett' ? 'Nett double+' : 'Double+ (0 pt)'}</Text>
                </View>
              </View>
              {s36View === 'nett' ? (
                <View style={styles.s36PipNoteRow}>
                  <View style={styles.legendDot} />
                  <Text style={styles.s36PipNoteText}>Stroke received — dots show strokes given on that hole</Text>
                </View>
              ) : null}

              {/* FOOTNOTE */}
              <View style={styles.s36Footnote}>
                <Info size={15} color={colors.primary} style={styles.s36FootnoteIcon} />
                <Text style={styles.s36FootnoteText}>
                  {!s36Finished
                    ? `${viewerS36Pts} pts from ${viewerEntered} hole${viewerEntered === 1 ? '' : 's'} → handicap ${viewerS36Hcp} (36 − ${viewerS36Pts}). Nett and Stableford open once all ${SYSTEM36_TOTAL_HOLES} holes are in.`
                    : s36Family === 'nett'
                      ? `Handicap ${viewerS36Hcp} spends by stroke index across the round. Nett ${viewerNettS36} → ${viewerStbf} Stableford pts, and those pts decide the win.`
                      : `${viewerS36Pts} S36 pts → handicap ${viewerS36Hcp} (36 − ${viewerS36Pts}). Stableford points off that handicap decide the win.`}
                </Text>
              </View>
            </>
          ) : isStableford ? (
            <>
              {/* TRANSPOSED GRID — holes as rows, players as columns (SB8),
                  same layout System 36's SY8 uses. The Gross/Nett/Points
                  tiles below double as a view switch for these cells, same
                  interaction as Stroke Play's Gross/Nett toggle and System
                  36's 4-way one — just three views here since there's no
                  settled/mid-round split to gate. */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tGridScrollContent}>
                <View style={styles.tGridContent}>
                  {/* HEADER */}
                  <View style={[styles.tRow, styles.tHeaderRow]}>
                    <Text style={[styles.tHeadCell, styles.tHCol]}>H</Text>
                    <Text style={[styles.tHeadCell, styles.tParCol]}>Par</Text>
                    <Text style={[styles.tHeadCell, styles.tSiCol]}>SI</Text>
                    {roster.map((player, index) => {
                      const isYou = player.id === viewerId;
                      return (
                        <View key={player.id} style={[styles.tPlayerHead, isYou && styles.tColYou, isYou && styles.tColYouTop]}>
                          <View style={[styles.tPlayerAvatar, { backgroundColor: getSolidAvatarColor(index) }]}>
                            <Text style={styles.tPlayerAvatarLabel}>{player.name[0]?.toUpperCase()}</Text>
                          </View>
                          <Text style={[styles.tPlayerName, isYou && styles.tPlayerNameYou]} numberOfLines={1}>
                            {isYou ? 'You' : firstName(player.name)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  {/* HOLE ROWS */}
                  {displayHoles.map((h, rowIdx) => (
                    <View key={h.n} style={[styles.tRow, styles.tHoleRow, rowIdx === displayHoles.length - 1 && styles.tHoleRowLast]}>
                      <Text style={[styles.tNumCell, styles.tHCol]}>{h.n}</Text>
                      <Text style={[styles.tMetaCell, styles.tParCol]}>{h.par}</Text>
                      <Text style={[styles.tMetaCell, styles.tSiCol]}>{h.si}</Text>
                      {roster.map((player) => {
                        const isYou = player.id === viewerId;
                        const raw = scores[player.id]?.[h.n];
                        const received = strokesReceivedOnHole(player.playingHandicap, h.si);
                        if (sbView === 'stbf') {
                          const pts = raw === undefined ? undefined : stablefordPointsForHole(raw - received, h.par);
                          const chip = pts === undefined ? undefined : STBF_POINT_CHIP[pts];
                          return (
                            <View key={player.id} style={[styles.tCellWrap, isYou && styles.tColYou]}>
                              <PointCell points={pts} chip={chip} size={28} />
                            </View>
                          );
                        }
                        const value = raw === undefined ? undefined : sbView === 'nett' ? raw - received : raw;
                        return (
                          <View key={player.id} style={[styles.tCellWrap, isYou && styles.tColYou]}>
                            <ScoreCell value={value} par={h.par} strokesReceived={received} size={28} />
                          </View>
                        );
                      })}
                    </View>
                  ))}
                  {/* SUMMARY A — this nine's stroke total, following the same view family as the cells above (Nett once Points is active too, since points are nett-derived — same grouping System 36's own dual summary uses). */}
                  <View style={[styles.tRow, styles.tSummaryRow]}>
                    <Text style={styles.tSummaryLabel}>
                      {sbView === 'gross' ? (nine === 'front' ? 'Out' : 'In') : nine === 'front' ? 'Nett out' : 'Nett in'}
                    </Text>
                    {roster.map((player) => {
                      const val =
                        sbView === 'gross'
                          ? sumGross(player.id, rangeStart, rangeEnd)
                          : sumNett(player.id, player.playingHandicap, rangeStart, rangeEnd);
                      return (
                        <Text key={player.id} style={styles.tSummaryCell}>
                          {val}
                        </Text>
                      );
                    })}
                  </View>
                  {/* SUMMARY B — Stableford points for this nine. */}
                  <View style={[styles.tRow, styles.tSummaryRow, styles.tSummaryRowLast]}>
                    <Text style={styles.tSummaryLabel}>PTS</Text>
                    {roster.map((player) => (
                      <Text key={player.id} style={[styles.tSummaryCell, styles.tSummaryCellAccent]}>
                        {sumStbf(player.id, player.playingHandicap, rangeStart, rangeEnd)}
                      </Text>
                    ))}
                  </View>
                </View>
              </ScrollView>

              {/* YOUR TOTALS — tap any tile to switch what the grid above shows */}
              <View style={styles.totalsRow}>
                <Pressable style={[styles.totalTile, sbView === 'gross' && styles.totalTileActive]} onPress={() => setStatMode('gross')}>
                  <Text style={[styles.totalTileLabel, sbView === 'gross' && styles.totalTileLabelInverse]}>Gross</Text>
                  <Text style={[styles.totalTileValue, sbView === 'gross' && styles.totalTileValueInverse]}>{viewerGross}</Text>
                </Pressable>
                <Pressable style={[styles.totalTile, sbView === 'nett' && styles.totalTileActive]} onPress={() => setStatMode('nett')}>
                  <Text style={[styles.totalTileLabel, sbView === 'nett' && styles.totalTileLabelInverse]}>Nett</Text>
                  <Text style={[styles.totalTileValue, sbView === 'nett' && styles.totalTileValueInverse]}>{viewerNett}</Text>
                </Pressable>
                <Pressable style={[styles.totalTile, sbView === 'stbf' && styles.totalTileActive]} onPress={() => setStatMode('stbf')}>
                  <Text style={[styles.totalTileLabel, sbView === 'stbf' && styles.totalTileLabelInverse]}>Points</Text>
                  <Text style={[styles.totalTileValue, sbView === 'stbf' && styles.totalTileValueInverse]}>{viewerStablefordPts}</Text>
                </Pressable>
              </View>

              {/* LEGEND — same 4-shape vocabulary ScoreCell uses everywhere else in the app (it doesn't distinguish eagle from birdie, same simplification as System 36's own SY8 legend). */}
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={styles.legendCircle} />
                  <Text style={styles.legendText}>Birdie+</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={styles.legendParDot} />
                  <Text style={styles.legendText}>Par</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={styles.legendSquareBogey} />
                  <Text style={styles.legendText}>Bogey</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={styles.legendSquareDouble} />
                  <Text style={styles.legendText}>Double+</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={styles.legendDot} />
                  <Text style={styles.legendText}>Handicap stroke</Text>
                </View>
              </View>
            </>
          ) : (
            <>
          {/* TRANSPOSED GRID — holes as rows, players as columns (MR8), the
              same layout Stableford's SB8 and System 36's SY8 use above. Single-
              round tournaments render through here too. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tGridScrollContent}>
            <View style={styles.tGridContent}>
              {/* HEADER */}
              <View style={[styles.tRow, styles.tHeaderRow]}>
                <Text style={[styles.tHeadCell, styles.tHCol]}>H</Text>
                <Text style={[styles.tHeadCell, styles.tParCol]}>Par</Text>
                <Text style={[styles.tHeadCell, styles.tSiCol]}>SI</Text>
                {roster.map((player, index) => {
                  const isYou = player.id === viewerId;
                  return (
                    <View key={player.id} style={[styles.tPlayerHead, isYou && styles.tColYou, isYou && styles.tColYouTop]}>
                      <View style={[styles.tPlayerAvatar, { backgroundColor: getSolidAvatarColor(index) }]}>
                        <Text style={styles.tPlayerAvatarLabel}>{player.name[0]?.toUpperCase()}</Text>
                      </View>
                      <Text style={[styles.tPlayerName, isYou && styles.tPlayerNameYou]} numberOfLines={1}>
                        {isYou ? 'You' : firstName(player.name)}
                      </Text>
                    </View>
                  );
                })}
              </View>
              {/* HOLE ROWS */}
              {displayHoles.map((h, rowIdx) => (
                <View key={h.n} style={[styles.tRow, styles.tHoleRow, rowIdx === displayHoles.length - 1 && styles.tHoleRowLast]}>
                  <Text style={[styles.tNumCell, styles.tHCol]}>{h.n}</Text>
                  <Text style={[styles.tMetaCell, styles.tParCol]}>{h.par}</Text>
                  <Text style={[styles.tMetaCell, styles.tSiCol]}>{h.si}</Text>
                  {roster.map((player) => {
                    const isYou = player.id === viewerId;
                    const raw = scores[player.id]?.[h.n];
                    const received = strokesReceivedOnHole(player.playingHandicap, h.si);
                    const value = raw === undefined ? undefined : statMode === 'nett' ? raw - received : raw;
                    return (
                      <View key={player.id} style={[styles.tCellWrap, isYou && styles.tColYou]}>
                        {/* Rendered even before a score is in, so the handicap-stroke
                            dot shows up front — lets a player see ahead of time which
                            holes they'll get a stroke on for the round. */}
                        <ScoreCell value={value} par={h.par} strokesReceived={received} size={28} />
                      </View>
                    );
                  })}
                </View>
              ))}
              {/* SUMMARY — this nine's total in whichever view the tiles below select */}
              <View style={[styles.tRow, styles.tSummaryRow, styles.tSummaryRowSingle]}>
                <Text style={styles.tSummaryLabel}>
                  {statMode === 'nett' ? (nine === 'front' ? 'Nett out' : 'Nett in') : nine === 'front' ? 'Out' : 'In'}
                </Text>
                {roster.map((player) => (
                  <Text key={player.id} style={styles.tSummaryCell}>
                    {statMode === 'nett'
                      ? sumNett(player.id, player.playingHandicap, rangeStart, rangeEnd)
                      : sumGross(player.id, rangeStart, rangeEnd)}
                  </Text>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* YOUR TOTALS — Gross/Nett double as a toggle for what the grid above displays */}
          <View style={styles.totalsRow}>
            <Pressable
              style={[styles.totalTile, statMode === 'gross' && styles.totalTileActive]}
              onPress={() => setStatMode('gross')}
            >
              <Text style={[styles.totalTileLabel, statMode === 'gross' && styles.totalTileLabelInverse]}>{roundPrefix}Gross</Text>
              <Text style={[styles.totalTileValue, statMode === 'gross' && styles.totalTileValueInverse]}>{viewerGross}</Text>
            </Pressable>
            <Pressable
              style={[styles.totalTile, statMode === 'nett' && styles.totalTileActive]}
              onPress={() => setStatMode('nett')}
            >
              <Text style={[styles.totalTileLabel, statMode === 'nett' && styles.totalTileLabelInverse]}>{roundPrefix}Nett</Text>
              <Text style={[styles.totalTileValue, statMode === 'nett' && styles.totalTileValueInverse]}>{viewerNett}</Text>
            </Pressable>
            <View style={styles.totalTile}>
              <Text style={styles.totalTileLabel}>{roundPrefix}To par</Text>
              <Text style={[styles.totalTileValue, viewerToPar < 0 && styles.totalTileValueUnder, viewerToPar > 0 && styles.totalTileValueOver]}>
                {viewerToPar === 0 ? 'E' : viewerToPar > 0 ? `+${viewerToPar}` : viewerToPar}
              </Text>
            </View>
          </View>
          {tournamentAfter ? (
            <View style={styles.tournamentLine}>
              <Trophy size={15} color={colors.accent} />
              <Text style={styles.tournamentLineLabel}>
                Tournament · {thisRound?.status === 'done' ? `after R${round.roundIndex}` : 'so far'}
              </Text>
              <Text style={[styles.tournamentLineValue, tournamentAfter.toPar < 0 && styles.tournamentLineValueUnder, tournamentAfter.toPar > 0 && styles.tournamentLineValueOver]}>{formatToPar(tournamentAfter.toPar)}</Text>
              <View style={styles.tournamentLineSeparator} />
              <Text style={styles.tournamentLinePlace}>{tournamentAfter.place}</Text>
            </View>
          ) : null}

          {/* LEGEND */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={styles.legendCircle} />
              <Text style={styles.legendText}>Under par</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.legendSquareBogey} />
              <Text style={styles.legendText}>Bogey</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.legendSquareDouble} />
              <Text style={styles.legendText}>Double+</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.legendDot} />
              <Text style={styles.legendText}>Handicap stroke</Text>
            </View>
          </View>
            </>
          )}
        </ScrollView>

        {/* Once the round is officially finished this grid is the permanent
            read-only recap (reached from the Finish screen's Scorecard button).
            Drop the tab bar then — same as TournamentFinishScreen — so there's
            no route back into the editable entry scorecard. The header's own
            "Score" button (goBack) still returns to wherever they came from. */}
        {matchStatus !== 'finished' ? (
          <InRoundTabBar active="scorecard" onNavigate={handleTabNavigate} leaderboardLocked={isSystem36 && thru < SYSTEM36_TOTAL_HOLES} />
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  // MR8 — a squarer, darker track than the Front/Back pill below, with a gap
  // between tabs so the active one doesn't butt against its neighbours.
  roundTabs: {
    flexDirection: 'row',
    gap: spacing[1],
    padding: 3,
    marginTop: spacing[3] + 2,
    backgroundColor: palette.multiRound.timeline.roundTabsTrack,
    borderRadius: radius.md,
  },
  roundTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1] + 1,
    minHeight: 38,
    paddingHorizontal: spacing[2],
    borderRadius: radius.md - 2,
  },
  roundTabLabelDisabled: {
    color: palette.multiRound.timeline.labelUpcoming,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  statusPillLabelFinal: {
    color: palette.white,
  },
  pastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 44,
    paddingHorizontal: spacing[3],
    backgroundColor: colors.surfaceMutedTile,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.md,
  },
  pastBannerText: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textMuted,
  },
  pastBannerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  pastBannerLinkLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 12,
    color: palette.multiRound.required.text,
  },
  tournamentLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2] + 2,
    paddingHorizontal: spacing[3] + 1,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.md,
  },
  tournamentLineLabel: {
    flex: 1,
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: colors.textSecondary,
  },
  tournamentLineValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.textPrimary,
  },
  tournamentLineValueUnder: {
    color: palette.green[600],
  },
  tournamentLineValueOver: {
    color: colors.statusDanger,
  },
  tournamentLineSeparator: {
    width: 1,
    height: 14,
    backgroundColor: colors.borderDefault,
  },
  tournamentLinePlace: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 12,
    color: colors.textPrimary,
  },
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
    paddingBottom: spacing[6],
    position: 'relative',
    overflow: 'hidden',
  },
  headerWatermarkLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  headerWatermark: {
    position: 'absolute',
    right: -30,
    top: -24,
    width: 120,
    height: 120,
    opacity: 0.09,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
  },
  // Left offset compensates for the back chevron this header no longer has,
  // keeping the title at the same visual indent as S7/S9's chevron+title headers.
  headerTitleGroup: { flex: 1, minWidth: 0, marginLeft: spacing[2] + 2 },
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
  scoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
    height: 32,
    paddingHorizontal: spacing[3],
    borderRadius: radius.pill,
    backgroundColor: palette.white,
  },
  scoreButtonLabel: {
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
    paddingVertical: spacing[1] + 1,
    paddingHorizontal: spacing[2] + 2,
    flexShrink: 0,
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
  finalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
    height: 32,
    paddingHorizontal: spacing[3],
    backgroundColor: palette.white,
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  finalPillLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.3,
    color: colors.primary,
  },
  headerDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginTop: spacing[3] + 2,
  },
  nineToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.pill,
    padding: 3,
    marginTop: spacing[3] + 2,
    marginBottom: spacing[1] + 1,
  },
  nineToggleAfterTabs: {
    marginTop: spacing[2] + 2,
  },
  nineToggleOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    borderRadius: radius.pill,
  },
  nineToggleOptionActive: {
    backgroundColor: palette.white,
  },
  nineToggleLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
  nineToggleLabelActive: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    color: colors.primary,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: screenGutter, paddingTop: spacing[4], paddingBottom: spacing[5], gap: spacing[4] },
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
    paddingVertical: spacing[2] + 2,
    alignItems: 'center',
  },
  totalTileActive: {
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
    fontSize: 20,
    color: colors.textPrimary,
    marginTop: 2,
  },
  totalTileValueUnder: {
    color: palette.green[600],
  },
  totalTileValueOver: {
    color: colors.statusDanger,
  },
  totalTileValueInverse: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 20,
    color: palette.white,
    marginTop: 2,
  },
  // ---- System 36 transposed grid (SY8) ----
  tGridScrollContent: { minWidth: '100%' },
  tGridContent: { flexGrow: 1 },
  tRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Header row (H/Par/SI + avatars) sits above the hole rows, separated by a
  // hairline — matches the divider under the column heads in SY8c.
  tHeaderRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
    paddingBottom: 2,
  },
  // Thin separators between hole rows so the full-width grid reads as ruled
  // rows rather than a floating cluster of numbers.
  tHoleRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  tHoleRowLast: {
    borderBottomWidth: 0,
  },
  // Vertical tint band down the viewer's own column (SY8c), applied per-cell
  // with alignSelf:'stretch' on the wraps so the segments join into one band.
  tColYou: {
    backgroundColor: palette.sand[200],
  },
  tColYouTop: {
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
  },
  tHeadCell: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.textDisabled,
    textTransform: 'uppercase',
    textAlign: 'center',
    paddingVertical: spacing[2],
  },
  tHCol: { width: 26 },
  tParCol: { width: 30 },
  tSiCol: { width: 26 },
  tPlayerHead: {
    flex: 1,
    minWidth: 54,
    alignItems: 'center',
    gap: 3,
    paddingVertical: spacing[1] + 1,
  },
  tPlayerAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tPlayerAvatarLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 10,
    color: palette.white,
  },
  tPlayerName: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 10,
    color: colors.textSecondary,
    maxWidth: 72,
  },
  tPlayerNameYou: {
    color: colors.primary,
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
  },
  tNumCell: {
    textAlign: 'center',
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 12,
    color: colors.textSecondary,
    paddingVertical: spacing[1] + 3,
  },
  tMetaCell: {
    textAlign: 'center',
    fontFamily: getFontFamily('numeric', '400'),
    fontSize: 11,
    color: colors.textDisabled,
  },
  tCellWrap: {
    flex: 1,
    minWidth: 54,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[1] + 1,
  },
  tSummaryRow: {
    backgroundColor: colors.surfaceBrandSoft,
    marginTop: spacing[1],
  },
  // Stroke play has just the one summary row, so it rounds on all corners (MR8's OUT bar).
  tSummaryRowSingle: {
    borderRadius: radius.sm,
  },
  tSummaryRowLast: {
    marginTop: 2,
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
  },
  tSummaryLabel: {
    width: 82,
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.primary,
    textTransform: 'uppercase',
    paddingLeft: spacing[1] + 2,
    paddingVertical: spacing[2] + 2,
  },
  tSummaryCell: {
    flex: 1,
    minWidth: 54,
    textAlign: 'center',
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: colors.primary,
  },
  tSummaryCellAccent: {
    color: colors.primary,
  },
  s36CaptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
    paddingHorizontal: 3,
  },
  s36CaptionText: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 10,
    letterSpacing: 0.3,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  s36TilesRow: {
    flexDirection: 'row',
    gap: spacing[2] - 1,
  },
  s36Tile: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.md,
    paddingVertical: spacing[2] + 2,
    paddingHorizontal: spacing[1],
    alignItems: 'center',
  },
  s36TileActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  s36TileMuted: {
    backgroundColor: colors.surfaceMutedTile,
    borderStyle: 'dashed',
  },
  s36TileSettled: {
    backgroundColor: palette.settledTile.fill,
    borderColor: palette.settledTile.border,
  },
  s36TileLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 9.5,
    letterSpacing: 0.5,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  s36TileLabelInverse: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 9.5,
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
  },
  s36TileLabelMuted: {
    color: colors.textMuted,
  },
  s36TileLabelSettled: {
    color: palette.settledTile.label,
  },
  s36TileValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 20,
    color: colors.textPrimary,
    marginTop: 2,
  },
  s36TileValueInverse: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 20,
    color: palette.white,
    marginTop: 2,
  },
  s36TileValueMuted: {
    color: colors.textMuted,
  },
  s36TileValueSettled: {
    color: palette.settledTile.value,
  },
  s36PipNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] - 1,
    paddingHorizontal: spacing[1],
  },
  s36PipNoteText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textSecondary,
  },
  s36Footnote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1.5,
    borderColor: palette.green[200],
    borderRadius: radius.md,
    paddingVertical: spacing[2] + 2,
    paddingHorizontal: spacing[3] + 1,
  },
  s36FootnoteIcon: {
    flexShrink: 0,
  },
  s36FootnoteText: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  legendParDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[3] + 2,
    paddingHorizontal: spacing[1],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
  },
  legendText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
  },
  legendCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.scoreCellUnderBorder,
  },
  legendSquareBogey: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.scoreCellBogeyBorder,
  },
  legendSquareDouble: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.scoreCellDoubleBorder,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.scoreCellStrokeDot,
  },
});
