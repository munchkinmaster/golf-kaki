import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronLeft, Crown, MapPin, Share2, Trophy } from 'lucide-react-native';
import { useMemo } from 'react';
import { Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { ScoreBadge } from '../components/ScoreBadge';
import {
  COURSE_PAR,
  HOLES,
  PLAYERS,
  VIEWER_KEY,
  formatDeal,
  getNextRoundDeals,
  grossTotal,
  money,
  moneyLabel,
  record,
  runningUp,
  scoreClassCounts,
  sumRange,
  upLabel,
} from '../data/round';
import type { PlayerKey } from '../data/round';
import type { RootStackParamList } from '../navigation/types';
import { useRound } from '../state/RoundContext';
import { colors, getFontFamily, palette, radius, screenGutter, shadows, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Recap'>;

const WATERMARK_SOURCE = require('../assets/golf-kaki-mark-white.png');
const WATERMARK_SIZE = 230;

const THRU = HOLES.length;

function firstName(name: string) {
  return name.split(' ')[0];
}

export function RecapScreen({ navigation, route }: Props) {
  const { matchName, courseName, gameModeName } = route.params;
  const { gross, frontNineDeals, stakePerHole } = useRound();

  const standings = [...PLAYERS]
    .map((p) => ({
      player: p,
      net: runningUp(p.key, THRU, gross, frontNineDeals),
      money: money(p.key, THRU, gross, frontNineDeals, stakePerHole),
      record: record(p.key, THRU, gross, frontNineDeals),
    }))
    .sort((a, b) => b.money - a.money || a.player.handicap - b.player.handicap);

  const viewerNet = runningUp(VIEWER_KEY, THRU, gross, frontNineDeals);
  const viewerMoney = money(VIEWER_KEY, THRU, gross, frontNineDeals, stakePerHole);
  const minMoney = Math.min(...standings.map((s) => s.money));
  const buyers = standings.filter((s) => s.money === minMoney && minMoney < 0).map((s) => s.player.name);

  const resultHeadline = viewerNet > 0 ? 'You won the match' : viewerNet < 0 ? 'You lost the match' : 'Match all square';
  const resultDetail =
    buyers.length > 0
      ? `${moneyLabel(viewerMoney)} for you — ${buyers.join(' & ')} ${buyers.length > 1 ? 'split' : 'buys'} the teh tarik.`
      : `${moneyLabel(viewerMoney)} for you — everyone's square on stakes.`;

  const viewerGross = grossTotal(VIEWER_KEY, THRU, gross);
  const viewerToPar = viewerGross - COURSE_PAR;
  const viewerToParLabel = viewerToPar === 0 ? 'E' : viewerToPar > 0 ? `+${viewerToPar}` : `${viewerToPar}`;

  const outScores = sumRange(THRU, 0, 9, gross);
  const inScores = sumRange(THRU, 9, 18, gross);
  const totalScores: Record<PlayerKey, number> = {
    A: outScores.A + inScores.A,
    B: outScores.B + inScores.B,
    C: outScores.C + inScores.C,
  };

  const viewerClassCounts = scoreClassCounts(VIEWER_KEY, THRU, gross);
  const nextRoundDeals = getNextRoundDeals(gross, frontNineDeals);

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
              {gameModeName} · {THRU} holes
            </Text>
            <Text style={styles.heroTitle}>{matchName}</Text>
            <View style={styles.heroMetaRow}>
              <MapPin size={14} color="rgba(255,255,255,0.72)" />
              <Text style={styles.heroMetaText}>{courseName} · 27 Jun 2026</Text>
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

          <Text style={styles.sectionLabel}>Final standings</Text>
          <View style={styles.standingsList}>
            {standings.map(({ player, net, money: m, record: rec }, i) => {
              const leader = i === 0;
              const isViewer = player.key === VIEWER_KEY;
              const moneyColor = m > 0 ? colors.statusSuccess : m < 0 ? colors.statusDanger : colors.textMuted;

              return (
                <View
                  key={player.key}
                  style={[styles.standingRow, leader ? styles.standingRowLeader : isViewer ? styles.standingRowViewer : styles.standingRowDefault]}
                >
                  <View style={styles.standingRank}>
                    {leader ? <Crown size={17} color={colors.scoreEagle} /> : <Text style={styles.standingRankNumber}>{i + 1}</Text>}
                  </View>
                  <View style={[styles.standingAvatar, { backgroundColor: player.avatarBg }]}>
                    <Text style={[styles.standingAvatarLabel, { color: player.avatarFg }]}>{player.name.charAt(0)}</Text>
                  </View>
                  <View style={styles.standingBody}>
                    <Text style={styles.standingName}>
                      {player.name}
                      {isViewer ? <Text style={styles.standingYou}> (You)</Text> : null}
                    </Text>
                    <Text style={styles.standingSub}>
                      {upLabel(net)} · {grossTotal(player.key, THRU, gross)} gross · {rec.w}W {rec.l}L {rec.h}H
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
                <Text style={styles.roundTotalsValue}>{outScores[VIEWER_KEY]}</Text>
                <Text style={styles.roundTotalsLabel}>Out</Text>
              </View>
              <View style={[styles.roundTotalsItem, styles.roundTotalsItemDivided]}>
                <Text style={styles.roundTotalsValue}>{inScores[VIEWER_KEY]}</Text>
                <Text style={styles.roundTotalsLabel}>In</Text>
              </View>
              <View style={styles.roundTotalsItem}>
                <Text style={[styles.roundTotalsValue, styles.roundTotalsValueAccent]}>{totalScores[VIEWER_KEY]}</Text>
                <Text style={styles.roundTotalsLabel}>Total</Text>
              </View>
            </View>
            <View style={styles.roundStatsRow}>
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
              {PLAYERS.map((p) => (
                <Text key={p.key} style={[styles.gridHeaderPlayer, p.key === VIEWER_KEY && styles.gridHeaderPlayerYou]}>
                  {p.key === VIEWER_KEY ? 'You' : firstName(p.name)}
                </Text>
              ))}
            </View>
            <View style={styles.gridBody}>
              {HOLES.map((hole, i) => (
                <View key={hole.n} style={styles.gridRow}>
                  <Text style={styles.gridCellNum}>{hole.n}</Text>
                  <Text style={styles.gridCellMeta}>{hole.par}</Text>
                  {PLAYERS.map((p) => (
                    <View key={p.key} style={styles.gridCell}>
                      <ScoreBadge value={gross[p.key][i]} par={hole.par} size={24} />
                    </View>
                  ))}
                </View>
              ))}
            </View>
            {summaryRows.map((row) => (
              <View key={row.label} style={[styles.summaryRow, row.strong && styles.summaryRowStrong]}>
                <Text style={[styles.summaryLabel, row.strong && styles.summaryLabelStrong]}>{row.label}</Text>
                {PLAYERS.map((p) => (
                  <Text key={p.key} style={[styles.summaryValue, row.strong && styles.summaryValueStrong]}>
                    {row.scores[p.key]}
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

          {nextRoundDeals.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>Next round</Text>
              <View style={styles.nextRoundCard}>
                {nextRoundDeals.map((deal) => (
                  <Text key={`${deal.giver}-${deal.receiver}`} style={styles.nextRoundLine}>
                    {formatDeal(deal)}
                  </Text>
                ))}
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
  nextRoundCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    padding: spacing[3] + 2,
    gap: spacing[1] + 2,
    ...shadows.xs,
  },
  nextRoundLine: {
    fontFamily: getFontFamily('body', '400'),
    fontWeight: '400',
    fontSize: 12,
    color: colors.textSecondary,
  },
  stakesNote: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    textAlign: 'center',
    marginTop: spacing[4],
  },
});
