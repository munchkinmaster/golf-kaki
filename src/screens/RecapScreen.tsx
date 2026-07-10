import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronLeft, Crown, MapPin, Share2, Trophy } from 'lucide-react-native';
import { useEffect, useMemo, useRef } from 'react';
import { Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { ScoreBadge } from '../components/ScoreBadge';
import { getNextRoundDeals, grossTotal, money, moneyLabel, pairwiseTotal, record, runningUp, scoreClassCounts, sumRange, upLabel } from '../data/round';
import type { StrokeMode } from '../data/round';
import { recalculateAndSaveHandicap } from '../data/handicap';
import { recalculateAndSaveStreaks } from '../data/streaks';
import { useLiveRound } from '../hooks/useLiveRound';
import type { RootStackParamList } from '../navigation/types';
import { colors, getFontFamily, getPlayerColors, palette, radius, screenGutter, shadows, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Recap'>;

const WATERMARK_SOURCE = require('../assets/golf-kaki-mark-white.png');
const WATERMARK_SIZE = 230;

function firstName(name: string) {
  return name.split(' ')[0];
}

function formatRecapDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function RecapScreen({ navigation, route }: Props) {
  const { matchId, matchName, courseName, gameModeName } = route.params;
  const { loading, viewerId, matchStatus, finishedAt, roster, holes, schedule, gross, thru, frontNineDeals, backNineDeals, stakePerHole, syncLedger } =
    useLiveRound(matchId);
  const ledgerSynced = useRef(false);

  useEffect(() => {
    if (matchStatus !== 'finished' || ledgerSynced.current) return;
    ledgerSynced.current = true;
    Promise.all([
      syncLedger(),
      viewerId ? recalculateAndSaveHandicap(viewerId, matchId) : Promise.resolve(),
      viewerId ? recalculateAndSaveStreaks(viewerId) : Promise.resolve(),
    ]).catch(() => {
      ledgerSynced.current = false;
    });
  }, [matchStatus, syncLedger, viewerId, matchId]);

  const rosterIds = useMemo(() => roster.map((p) => p.playerId), [roster]);

  const standings = roster
    .map((p) => ({
      player: p,
      net: runningUp(rosterIds, p.playerId, thru, gross, holes, frontNineDeals, schedule, backNineDeals),
      money: money(rosterIds, p.playerId, thru, gross, holes, frontNineDeals, schedule, backNineDeals, stakePerHole),
      record: record(rosterIds, p.playerId, thru, gross, holes, frontNineDeals, schedule, backNineDeals),
    }))
    .sort((a, b) => b.money - a.money || (a.player.handicap ?? 0) - (b.player.handicap ?? 0));

  const viewerNet = viewerId ? runningUp(rosterIds, viewerId, thru, gross, holes, frontNineDeals, schedule, backNineDeals) : 0;
  const viewerMoney = viewerId ? money(rosterIds, viewerId, thru, gross, holes, frontNineDeals, schedule, backNineDeals, stakePerHole) : 0;
  const minMoney = standings.length > 0 ? Math.min(...standings.map((s) => s.money)) : 0;
  const buyers = standings.filter((s) => s.money === minMoney && minMoney < 0).map((s) => s.player.name);

  const resultHeadline = viewerNet > 0 ? 'You won the match' : viewerNet < 0 ? 'You lost the match' : 'Match all square';
  const resultDetail =
    buyers.length > 0
      ? `${moneyLabel(viewerMoney)} for you — ${buyers.join(' & ')} ${buyers.length > 1 ? 'split' : 'buys'} the teh tarik.`
      : `${moneyLabel(viewerMoney)} for you — everyone's square on stakes.`;

  const coursePar = holes.reduce((sum, h) => sum + h.par, 0);
  const viewerGross = viewerId ? grossTotal(viewerId, thru, gross) : 0;
  const viewerToPar = viewerGross - coursePar;
  const viewerToParLabel = viewerToPar === 0 ? 'E' : viewerToPar > 0 ? `+${viewerToPar}` : `${viewerToPar}`;

  const outScores = sumRange(rosterIds, thru, 0, 9, gross);
  const inScores = sumRange(rosterIds, thru, 9, 18, gross);
  const totalScores: Record<string, number> = {};
  rosterIds.forEach((id) => {
    totalScores[id] = (outScores[id] ?? 0) + (inScores[id] ?? 0);
  });

  const viewerClassCounts = viewerId ? scoreClassCounts(viewerId, thru, gross, holes) : { eagle: 0, birdie: 0, par: 0, bogey: 0, doublePlus: 0 };
  const nextRoundDeals = getNextRoundDeals(rosterIds, gross, frontNineDeals, holes, schedule, backNineDeals);

  // Scoped to the viewer's own pairs — the full pairwise table (every other
  // player's deal with every other player) isn't the viewer's business here.
  const carryForwardRows = useMemo(() => {
    if (!viewerId) return [];
    return nextRoundDeals
      .filter((deal) => deal.giver === viewerId || deal.receiver === viewerId)
      .map((deal) => {
        const opponentId = deal.giver === viewerId ? deal.receiver : deal.giver;
        const opponent = roster.find((p) => p.playerId === opponentId);
        if (!opponent) return null;
        return {
          opponent,
          mode: (deal.giver === viewerId ? 'give' : 'get') as StrokeMode,
          strokes: deal.amount,
          h2h: pairwiseTotal(viewerId, opponentId, thru, gross, holes, frontNineDeals, schedule, backNineDeals),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }, [nextRoundDeals, viewerId, roster, thru, gross, holes, frontNineDeals, schedule, backNineDeals]);

  const onShare = () => {
    Share.share({
      message: `${matchName} at ${courseName} — ${resultHeadline}. ${viewerGross} gross, ${viewerToParLabel} to par.`,
    }).catch(() => {});
  };

  const summaryRows = useMemo(
    () => [
      { label: 'Out', scores: outScores },
      { label: 'In', scores: inScores },
      { label: 'Total', scores: totalScores, strong: true },
    ],
    [outScores, inScores, totalScores],
  );

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Image source={WATERMARK_SOURCE} style={styles.headerWatermark} />

          <View style={styles.headerTopRow}>
            <Pressable style={styles.headerIconButton} onPress={() => navigation.navigate('Home')}>
              <ChevronLeft size={20} color={palette.white} />
            </Pressable>
            <Text style={styles.headerTitle}>Past game</Text>
            <Pressable style={styles.headerIconButton} onPress={onShare}>
              <Share2 size={16} color={palette.white} />
            </Pressable>
          </View>

          <View style={styles.heroBody}>
            <Text style={styles.heroOverline}>
              {gameModeName} · {holes.length} holes
            </Text>
            <Text style={styles.heroTitle}>{matchName}</Text>
            <View style={styles.heroMetaRow}>
              <MapPin size={14} color="rgba(255,255,255,0.72)" />
              <Text style={styles.heroMetaText}>
                {courseName}
                {finishedAt ? ` · ${formatRecapDate(finishedAt)}` : ''}
              </Text>
            </View>
          </View>

          <View style={styles.statTrio}>
            <View style={styles.statTrioItem}>
              <Text style={styles.statTrioValue}>{viewerGross}</Text>
              <Text style={styles.statTrioLabel}>Gross</Text>
            </View>
            <View style={[styles.statTrioItem, styles.statTrioItemDivided]}>
              <Text style={styles.statTrioValue}>{upLabel(viewerNet)}</Text>
              <Text style={styles.statTrioLabel}>Match</Text>
            </View>
            <View style={styles.statTrioItem}>
              <Text style={[styles.statTrioValue, styles.statTrioValueAccent]}>{viewerToParLabel}</Text>
              <Text style={styles.statTrioLabel}>To par</Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.resultCard}>
            <View style={styles.resultIcon}>
              <Trophy size={21} color={palette.white} />
            </View>
            <View style={styles.resultBody}>
              <Text style={styles.resultHeadline}>{resultHeadline}</Text>
              <Text style={styles.resultDetail}>{resultDetail}</Text>
            </View>
          </View>

          {loading ? <Text style={styles.loadingText}>Loading recap…</Text> : null}

          <Text style={styles.sectionLabel}>Final standings</Text>
          <View style={styles.standingsList}>
            {standings.map(({ player, net, money: m, record: rec }, i) => {
              const leader = i === 0;
              const isViewer = player.playerId === viewerId;
              const moneyColor = m > 0 ? colors.statusSuccess : m < 0 ? colors.statusDanger : colors.textMuted;
              const playerColor = getPlayerColors(rosterIds.indexOf(player.playerId));

              return (
                <View
                  key={player.playerId}
                  style={[styles.standingRow, leader ? styles.standingRowLeader : isViewer ? styles.standingRowViewer : styles.standingRowDefault]}
                >
                  <View style={styles.standingRank}>
                    {leader ? <Crown size={17} color={colors.scoreEagle} /> : <Text style={styles.standingRankNumber}>{i + 1}</Text>}
                  </View>
                  <View style={[styles.standingAvatar, { backgroundColor: playerColor.background }]}>
                    <Text style={[styles.standingAvatarLabel, { color: playerColor.color }]}>{player.name.charAt(0)}</Text>
                  </View>
                  <View style={styles.standingBody}>
                    <Text style={styles.standingName}>
                      {player.name}
                      {isViewer ? <Text style={styles.standingYou}> (You)</Text> : null}
                    </Text>
                    <Text style={styles.standingSub}>
                      {upLabel(net)} · {grossTotal(player.playerId, thru, gross)} gross · {rec.w}W {rec.l}L {rec.h}H
                    </Text>
                  </View>
                  <Text style={[styles.standingMoney, { color: moneyColor }]}>{moneyLabel(m)}</Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Your round</Text>
          <View style={styles.roundCard}>
            <View style={styles.roundTotalsRow}>
              <View style={styles.roundTotalsItem}>
                <Text style={styles.roundTotalsValue}>{viewerId ? outScores[viewerId] ?? 0 : 0}</Text>
                <Text style={styles.roundTotalsLabel}>Out</Text>
              </View>
              <View style={[styles.roundTotalsItem, styles.roundTotalsItemDivided]}>
                <Text style={styles.roundTotalsValue}>{viewerId ? inScores[viewerId] ?? 0 : 0}</Text>
                <Text style={styles.roundTotalsLabel}>In</Text>
              </View>
              <View style={styles.roundTotalsItem}>
                <Text style={[styles.roundTotalsValue, styles.roundTotalsValueAccent]}>{viewerId ? totalScores[viewerId] ?? 0 : 0}</Text>
                <Text style={styles.roundTotalsLabel}>Total</Text>
              </View>
            </View>
            <View style={styles.roundStatsRow}>
              <View style={styles.roundStatsItem}>
                <Text style={[styles.roundStatsValue, { color: colors.scoreEagle }]}>{viewerClassCounts.eagle}</Text>
                <Text style={styles.roundStatsLabel}>Eagle+</Text>
              </View>
              <View style={styles.roundStatsItem}>
                <Text style={[styles.roundStatsValue, { color: colors.scoreBirdie }]}>{viewerClassCounts.birdie}</Text>
                <Text style={styles.roundStatsLabel}>Birdies</Text>
              </View>
              <View style={styles.roundStatsItem}>
                <Text style={[styles.roundStatsValue, { color: colors.scorePar }]}>{viewerClassCounts.par}</Text>
                <Text style={styles.roundStatsLabel}>Pars</Text>
              </View>
              <View style={styles.roundStatsItem}>
                <Text style={[styles.roundStatsValue, { color: colors.scoreBogey }]}>{viewerClassCounts.bogey}</Text>
                <Text style={styles.roundStatsLabel}>Bogeys</Text>
              </View>
              <View style={styles.roundStatsItem}>
                <Text style={[styles.roundStatsValue, { color: colors.scoreDouble }]}>{viewerClassCounts.doublePlus}</Text>
                <Text style={styles.roundStatsLabel}>Double+</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Scorecard</Text>
          <View style={styles.gridCard}>
            <View style={styles.gridHeaderRow}>
              <Text style={styles.gridHeaderH}>H</Text>
              <Text style={styles.gridHeaderMeta}>Par</Text>
              {roster.map((p) => (
                <Text key={p.playerId} style={[styles.gridHeaderPlayer, p.playerId === viewerId && styles.gridHeaderPlayerYou]}>
                  {p.playerId === viewerId ? 'You' : firstName(p.name)}
                </Text>
              ))}
            </View>
            <View style={styles.gridBody}>
              {holes.map((hole, i) => (
                <View key={hole.n} style={styles.gridRow}>
                  <Text style={styles.gridCellNum}>{hole.n}</Text>
                  <Text style={styles.gridCellMeta}>{hole.par}</Text>
                  {roster.map((p) => (
                    <View key={p.playerId} style={styles.gridCell}>
                      <ScoreBadge value={gross[p.playerId]?.[i] ?? hole.par} par={hole.par} size={24} />
                    </View>
                  ))}
                </View>
              ))}
            </View>
            {summaryRows.map((row) => (
              <View key={row.label} style={[styles.summaryRow, row.strong && styles.summaryRowStrong]}>
                <Text style={[styles.summaryLabel, row.strong && styles.summaryLabelStrong]}>{row.label}</Text>
                {rosterIds.map((id) => (
                  <Text key={id} style={[styles.summaryValue, row.strong && styles.summaryValueStrong]}>
                    {row.scores[id] ?? 0}
                  </Text>
                ))}
              </View>
            ))}
          </View>

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendRing, { borderColor: colors.scoreBirdie }]} />
              <Text style={styles.legendText}>birdie</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.legendDoubleRingWrap}>
                <View style={[styles.legendRingOuter, { borderColor: colors.scoreEagle }]} />
                <View style={[styles.legendRingInner, { borderColor: colors.scoreEagle }]} />
              </View>
              <Text style={styles.legendText}>eagle or better</Text>
            </View>
          </View>

          {carryForwardRows.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>Carry-forward strokes</Text>
              <Text style={styles.carrySubtitle}>Strokes agreed in the lobby — applied head-to-head</Text>
              <View style={styles.carryList}>
                {carryForwardRows.map(({ opponent, mode, strokes, h2h }) => {
                  const playerColor = getPlayerColors(rosterIds.indexOf(opponent.playerId));
                  const h2hColor = h2h > 0 ? colors.statusSuccess : h2h < 0 ? colors.statusDanger : colors.textMuted;
                  const h2hLabel = h2h > 0 ? `${h2h} up head-to-head` : h2h < 0 ? `${-h2h} down head-to-head` : 'Square head-to-head';
                  const isGet = mode === 'get';

                  return (
                    <View key={opponent.playerId} style={styles.carryRow}>
                      <View style={[styles.carryAvatar, { backgroundColor: playerColor.background }]}>
                        <Text style={[styles.carryAvatarLabel, { color: playerColor.color }]}>{opponent.name.charAt(0)}</Text>
                      </View>
                      <View style={styles.carryBody}>
                        <Text style={styles.carryName}>{opponent.name}</Text>
                        <Text style={[styles.carryH2h, { color: h2hColor }]}>{h2hLabel}</Text>
                      </View>
                      <View style={[styles.pill, isGet ? styles.pillGet : styles.pillGive]}>
                        <Text style={[styles.pillLabel, { color: isGet ? colors.statusSuccess : palette.orange[700] }]}>
                          {isGet ? 'Get' : 'Give'}
                        </Text>
                        <Text style={[styles.pillNumber, { color: isGet ? palette.green[600] : palette.orange[700] }]}>{strokes}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}

          <Text style={styles.stakesNote}>${stakePerHole} / hole stakes · settled at finish.</Text>
        </ScrollView>
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
    paddingBottom: spacing[4] + 2,
    overflow: 'hidden',
  },
  headerWatermark: {
    position: 'absolute',
    top: 34,
    left: '50%',
    width: WATERMARK_SIZE,
    height: WATERMARK_SIZE,
    marginLeft: -WATERMARK_SIZE / 2,
    opacity: 0.06,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  heroBody: {
    marginTop: spacing[4],
  },
  heroOverline: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: palette.orange[300],
  },
  heroTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 25,
    color: palette.white,
    marginTop: spacing[1] + 1,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
    marginTop: spacing[1] + 2,
  },
  heroMetaText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
  },
  statTrio: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md + 2,
    paddingVertical: spacing[3],
    marginTop: spacing[4],
  },
  statTrioItem: {
    flex: 1,
    alignItems: 'center',
  },
  statTrioItemDivided: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  statTrioValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 24,
    color: palette.white,
  },
  statTrioValueAccent: {
    color: palette.orange[300],
  },
  statTrioLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 3,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[3] + 2,
    paddingBottom: spacing[6],
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: palette.orange[100],
    borderWidth: 1,
    borderColor: palette.orange[200],
    borderRadius: radius.lg,
    padding: spacing[3] + 1,
    ...shadows.xs,
  },
  resultIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    ...shadows.accent,
  },
  resultBody: {
    flex: 1,
    minWidth: 0,
  },
  resultHeadline: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 16,
    color: colors.textPrimary,
  },
  resultDetail: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: '#9A6B3E',
    marginTop: 1,
  },
  loadingText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    marginTop: spacing[3],
  },
  sectionLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: spacing[5],
    marginBottom: spacing[2] + 2,
  },
  standingsList: {
    gap: spacing[2],
  },
  standingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
    borderRadius: radius.lg,
    paddingVertical: spacing[2] + 3,
    paddingHorizontal: spacing[3] + 1,
    ...shadows.xs,
  },
  standingRowDefault: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  standingRowViewer: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: palette.green[200],
  },
  standingRowLeader: {
    backgroundColor: 'rgba(201,138,35,0.16)',
    borderWidth: 1.5,
    borderColor: colors.scoreEagle,
  },
  standingRank: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  standingRankNumber: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: palette.sand[400],
  },
  standingAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  standingAvatarLabel: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 14,
  },
  standingBody: {
    flex: 1,
    minWidth: 0,
  },
  standingName: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: colors.textPrimary,
  },
  standingYou: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: colors.statusSuccess,
  },
  standingSub: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: 1,
  },
  standingMoney: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 16,
  },
  roundCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    padding: spacing[3] + 2,
    ...shadows.xs,
  },
  roundTotalsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  roundTotalsItem: {
    flex: 1,
    alignItems: 'center',
  },
  roundTotalsItemDivided: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.borderSubtle,
  },
  roundTotalsValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 21,
    color: colors.textPrimary,
  },
  roundTotalsValueAccent: {
    color: colors.primary,
  },
  roundTotalsLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    color: colors.textDisabled,
    marginTop: 2,
  },
  roundStatsRow: {
    flexDirection: 'row',
    gap: spacing[2] - 1,
    marginTop: spacing[3] + 2,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing[3] + 1,
  },
  roundStatsItem: {
    flex: 1,
    alignItems: 'center',
  },
  roundStatsValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 15,
  },
  roundStatsLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    color: colors.textDisabled,
    marginTop: 1,
  },
  gridCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.xs,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSunken,
    paddingVertical: spacing[2] + 1,
    paddingHorizontal: spacing[2] + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  gridHeaderH: {
    width: 26,
    textAlign: 'center',
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 10,
    color: colors.textDisabled,
  },
  gridHeaderMeta: {
    width: 30,
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
  gridBody: {
    paddingHorizontal: spacing[2] + 2,
    paddingTop: 2,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 32,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSunken,
  },
  gridCellNum: {
    width: 26,
    textAlign: 'center',
    fontFamily: getFontFamily('numeric', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: colors.textPrimary,
  },
  gridCellMeta: {
    width: 30,
    textAlign: 'center',
    fontFamily: getFontFamily('numeric', '400'),
    fontSize: 12,
    color: colors.textDisabled,
  },
  gridCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 30,
    backgroundColor: colors.surfaceSunken,
    paddingHorizontal: spacing[2] + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  summaryRowStrong: {
    borderBottomWidth: 0,
  },
  summaryLabel: {
    width: 56,
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
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    marginTop: spacing[3],
    paddingHorizontal: spacing[1],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
  },
  legendRing: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  legendDoubleRingWrap: {
    width: 19,
    height: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendRingOuter: {
    position: 'absolute',
    width: 19,
    height: 19,
    borderRadius: 9.5,
    borderWidth: 1.5,
  },
  legendRingInner: {
    position: 'absolute',
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 1.5,
  },
  legendText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
  },
  carrySubtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textMuted,
    marginTop: -spacing[1] - 1,
    marginBottom: spacing[2] + 2,
  },
  carryList: {
    gap: spacing[2],
  },
  carryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    paddingVertical: spacing[2] + 3,
    paddingHorizontal: spacing[3] + 1,
    ...shadows.xs,
  },
  carryAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  carryAvatarLabel: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 14,
  },
  carryBody: {
    flex: 1,
    minWidth: 0,
  },
  carryName: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: colors.textPrimary,
  },
  carryH2h: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    marginTop: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 3,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: spacing[1] + 1,
    paddingLeft: spacing[2] + 3,
    paddingRight: spacing[1] + 1,
    flexShrink: 0,
  },
  pillGet: {
    backgroundColor: palette.green[100],
    borderColor: palette.green[200],
  },
  pillGive: {
    backgroundColor: palette.orange[100],
    borderColor: palette.orange[200],
  },
  pillLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 10,
  },
  pillNumber: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 15,
    backgroundColor: palette.white,
    borderRadius: radius.pill,
    minWidth: 24,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  stakesNote: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    textAlign: 'center',
    marginTop: spacing[4],
  },
});
