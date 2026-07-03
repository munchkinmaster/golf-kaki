import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Check,
  ChevronLeft,
  CircleCheck,
  CircleCheckBig,
  Coffee,
  Flag,
  List,
  Lock,
  PartyPopper,
  Trophy,
  Users,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { HOLES, PLAYERS, VIEWER_KEY, grossTotal, money, moneyLabel, pairwiseTotal, playerName, runningUp } from '../data/round';
import type { PlayerKey } from '../data/round';
import type { RootStackParamList } from '../navigation/types';
import { useRound } from '../state/RoundContext';
import { colors, getFontFamily, palette, radius, screenGutter, shadows, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Finish'>;

const THRU = HOLES.length;

const OPPONENTS = PLAYERS.filter((p) => p.key !== VIEWER_KEY).map((p) => p.key);

export function FinishScreen({ navigation, route }: Props) {
  const { matchName, courseName, gameModeName } = route.params;
  const { gross, frontNineDeals, stakePerHole } = useRound();
  const [reminded, setReminded] = useState(false);

  const matchTotal = runningUp(VIEWER_KEY, THRU, gross, frontNineDeals);

  const dominantOpponentKey = OPPONENTS.reduce((worst, opp) =>
    pairwiseTotal(VIEWER_KEY, opp, THRU, gross, frontNineDeals) < pairwiseTotal(VIEWER_KEY, worst, THRU, gross, frontNineDeals) ? opp : worst,
  OPPONENTS[0]);

  const settlement = useMemo(
    () => PLAYERS.map((p) => ({ player: p, money: money(p.key, THRU, gross, frontNineDeals, stakePerHole) })),
    [gross, frontNineDeals, stakePerHole],
  );
  const minMoney = Math.min(...settlement.map((s) => s.money));
  const buyers = settlement.filter((s) => s.money === minMoney && minMoney < 0).map((s) => s.player.name);

  const resultHeadline =
    matchTotal > 0
      ? 'You won the match'
      : matchTotal < 0
        ? 'You lost the match'
        : 'Match all square';
  const resultDetail =
    matchTotal > 0
      ? `Finished ${matchTotal} up overall — nice finish.`
      : matchTotal < 0
        ? `Finished ${Math.abs(matchTotal)} down overall — ${playerName(dominantOpponentKey)} had the edge.`
        : 'Tied it up after 18 — no clear winner today.';

  const confirmedCount = PLAYERS.length - (reminded ? 0 : 1);

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
              <Text style={styles.headerTitle}>Finish round</Text>
              <Text style={styles.headerSubtitle}>
                {matchName} · {courseName}
              </Text>
            </View>
            <View style={styles.holesInBadge}>
              <Check size={12} color={palette.green[300]} />
              <Text style={styles.holesInLabel}>18 holes in</Text>
            </View>
          </View>

          <View style={styles.resultCard}>
            <View style={styles.resultIcon}>
              <Trophy size={22} color={palette.white} />
            </View>
            <View style={styles.resultBody}>
              <Text style={styles.resultOverline}>Match play result</Text>
              <Text style={styles.resultHeadline}>{resultHeadline}</Text>
              <Text style={styles.resultDetail}>{resultDetail}</Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>Confirm scores</Text>
            <View style={styles.confirmedPill}>
              <View style={styles.confirmedDot} />
              <Text style={styles.confirmedPillLabel}>
                {confirmedCount} of {PLAYERS.length} confirmed
              </Text>
            </View>
          </View>

          <View style={styles.confirmList}>
            {PLAYERS.map((p) => {
              const isViewer = p.key === VIEWER_KEY;
              const isDinesh = p.key === 'C';
              const waiting = isDinesh && !reminded;

              return (
                <View
                  key={p.key}
                  style={[
                    styles.confirmRow,
                    waiting ? styles.confirmRowWaiting : isViewer ? styles.confirmRowViewer : styles.confirmRowDefault,
                  ]}
                >
                  <View style={[styles.confirmAvatar, { backgroundColor: p.avatarBg }]}>
                    <Text style={[styles.confirmAvatarLabel, { color: p.avatarFg }]}>{p.name.charAt(0)}</Text>
                  </View>
                  <View style={styles.confirmBody}>
                    <Text style={styles.confirmName}>
                      {p.name}
                      {isViewer ? <Text style={styles.confirmYou}> (You)</Text> : null}
                    </Text>
                    <Text style={[styles.confirmMeta, waiting && styles.confirmMetaWaiting]}>
                      {waiting ? 'Waiting to confirm card' : `Card confirmed · ${grossTotal(p.key, THRU, gross)} gross`}
                    </Text>
                  </View>
                  {waiting ? (
                    <Pressable style={styles.remindButton} onPress={() => setReminded(true)}>
                      <Text style={styles.remindButtonLabel}>Remind</Text>
                    </Pressable>
                  ) : (
                    <CircleCheck size={20} color={colors.statusSuccess} />
                  )}
                </View>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Settlement</Text>
          <View style={styles.settlementCard}>
            <View style={styles.settlementHeader}>
              <View style={styles.settlementHeaderLeft}>
                <Coffee size={16} color={palette.orange[700]} />
                <Text style={styles.settlementTitle}>Teh tarik stakes</Text>
              </View>
              <Text style={styles.settlementMeta}>${stakePerHole} / hole</Text>
            </View>
            <View style={styles.settlementList}>
              {settlement.map(({ player, money: m }) => (
                <View key={player.key} style={styles.settlementRow}>
                  <Text style={styles.settlementName}>
                    {player.name}
                    {player.key === VIEWER_KEY ? <Text style={styles.settlementYou}> (You)</Text> : null}
                  </Text>
                  <Text style={[styles.settlementAmount, { color: m > 0 ? colors.statusSuccess : m < 0 ? colors.statusDanger : colors.textMuted }]}>
                    {moneyLabel(m)}
                  </Text>
                </View>
              ))}
            </View>
            {buyers.length > 0 ? (
              <View style={styles.settlementFooter}>
                <PartyPopper size={15} color={palette.orange[700]} />
                <Text style={styles.settlementFooterText}>
                  {buyers.join(' & ')} {buyers.length > 1 ? 'split' : 'buys'} the teh tarik.
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.lockNote}>
            <Lock size={13} color={colors.textDisabled} />
            <Text style={styles.lockNoteText}>Once finished, scores lock and the round moves to your history.</Text>
          </View>
        </ScrollView>

        <View style={styles.ctaWrap}>
          <Pressable
            style={styles.ctaButton}
            onPress={() => navigation.navigate('Recap', { matchName, courseName, gameModeName })}
          >
            <Flag size={18} color={palette.white} />
            <Text style={styles.ctaLabel}>Finish & save round</Text>
          </Pressable>
        </View>

        <View style={styles.inRoundNav}>
          <Pressable
            style={styles.inRoundTab}
            onPress={() => navigation.navigate('Scorecard', { matchName, courseName, gameModeName, isHost: true })}
          >
            <List size={21} color={palette.sand[400]} />
            <Text style={styles.inRoundTabLabel}>Scorecard</Text>
          </Pressable>
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
          <View style={styles.inRoundTab}>
            <CircleCheckBig size={21} color={colors.primary} />
            <Text style={[styles.inRoundTabLabel, styles.inRoundTabLabelActive]}>Finish</Text>
          </View>
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
  holesInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.pill,
    paddingVertical: spacing[1] + 1,
    paddingHorizontal: spacing[2] + 2,
    flexShrink: 0,
  },
  holesInLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    color: palette.green[300],
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.lg,
    padding: spacing[3] + 3,
    marginTop: spacing[3] + 2,
  },
  resultIcon: {
    width: 44,
    height: 44,
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
  resultOverline: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },
  resultHeadline: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 19,
    color: palette.white,
    marginTop: 2,
  },
  resultDetail: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[4],
    paddingBottom: spacing[5],
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2] + 2,
  },
  sectionLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: spacing[2] + 2,
  },
  confirmedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
  },
  confirmedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  confirmedPillLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: palette.orange[700],
  },
  confirmList: {
    gap: spacing[2],
    marginBottom: spacing[5],
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
    borderRadius: radius.lg,
    paddingVertical: spacing[2] + 2,
    paddingHorizontal: spacing[3] + 1,
    ...shadows.xs,
  },
  confirmRowDefault: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  confirmRowViewer: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: palette.green[200],
  },
  confirmRowWaiting: {
    backgroundColor: '#FFF9EC',
    borderWidth: 1.5,
    borderColor: '#F0E0B0',
  },
  confirmAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  confirmAvatarLabel: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 14,
  },
  confirmBody: {
    flex: 1,
    minWidth: 0,
  },
  confirmName: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: colors.textPrimary,
  },
  confirmYou: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: colors.statusSuccess,
  },
  confirmMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.statusSuccess,
    marginTop: 1,
  },
  confirmMetaWaiting: {
    color: colors.scoreEagle,
  },
  remindButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing[1] + 3,
    paddingHorizontal: spacing[3],
    ...shadows.accent,
  },
  remindButtonLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: palette.white,
  },
  settlementCard: {
    backgroundColor: palette.orange[100],
    borderWidth: 1,
    borderColor: palette.orange[200],
    borderRadius: radius.lg,
    padding: spacing[3] + 3,
    ...shadows.xs,
  },
  settlementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing[2] + 3,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE3CB',
  },
  settlementHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  settlementTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: palette.orange[700],
  },
  settlementMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: '#9A6B3E',
  },
  settlementList: {
    gap: spacing[2] + 1,
    paddingVertical: spacing[3],
  },
  settlementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settlementName: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: colors.textSecondary,
  },
  settlementYou: {
    color: '#9A6B3E',
  },
  settlementAmount: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 15,
  },
  settlementFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.sm + 2,
    paddingVertical: spacing[2] + 1,
    paddingHorizontal: spacing[3],
  },
  settlementFooterText: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: palette.orange[700],
  },
  lockNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[1] + 3,
    marginTop: spacing[3] + 2,
    paddingHorizontal: spacing[1],
  },
  lockNoteText: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    lineHeight: 16,
  },
  ctaWrap: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[2] + 2,
    paddingBottom: spacing[2] + 1,
    backgroundColor: colors.surfacePage,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    height: 54,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    ...shadows.accent,
  },
  ctaLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 16,
    color: palette.white,
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
