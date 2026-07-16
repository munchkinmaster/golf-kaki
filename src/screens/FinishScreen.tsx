import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronLeft, CircleCheckBig, Clock, Coffee, Flag, List, Lock, PartyPopper, Trophy, Users } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { money, moneyLabel, pairwiseTotal, playerName, runningUp } from '../data/round';
import { useLiveRound } from '../hooks/useLiveRound';
import type { RootStackParamList } from '../navigation/types';
import { colors, getFontFamily, getPlayerColors, palette, radius, screenGutter, shadows, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Finish'>;

export function FinishScreen({ navigation, route }: Props) {
  const { matchId, matchName, courseName, gameModeName } = route.params;
  const { loading, viewerId, isHostViewer, matchStatus, roster, holes, schedule, gross, thru, frontNineDeals, backNineDeals, stakePerHole, finishRound } =
    useLiveRound(matchId);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const rosterIds = useMemo(() => roster.map((p) => p.playerId), [roster]);
  const opponents = rosterIds.filter((id) => id !== viewerId);
  const roundComplete = holes.length > 0 && thru === holes.length;

  const matchTotal = viewerId ? runningUp(rosterIds, viewerId, thru, gross, holes, frontNineDeals, schedule, backNineDeals) : 0;

  const dominantOpponentId =
    viewerId && opponents.length > 0
      ? opponents.reduce((worst, opp) =>
          pairwiseTotal(viewerId, opp, thru, gross, holes, frontNineDeals, schedule, backNineDeals) <
          pairwiseTotal(viewerId, worst, thru, gross, holes, frontNineDeals, schedule, backNineDeals)
            ? opp
            : worst,
        opponents[0]!)
      : null;

  const settlement = useMemo(
    () =>
      roster.map((p) => ({
        player: p,
        money: money(rosterIds, p.playerId, thru, gross, holes, frontNineDeals, schedule, backNineDeals, stakePerHole),
      })),
    [roster, rosterIds, thru, gross, holes, frontNineDeals, schedule, backNineDeals, stakePerHole],
  );
  const minMoney = settlement.length > 0 ? Math.min(...settlement.map((s) => s.money)) : 0;
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
        ? `Finished ${Math.abs(matchTotal)} down overall — ${dominantOpponentId ? playerName(dominantOpponentId, roster.map((p) => ({ id: p.playerId, name: p.name }))) : 'your opponent'} had the edge.`
        : `Tied it up after ${holes.length} — no clear winner today.`;

  async function handleFinish() {
    if (!isHostViewer || finishing || !roundComplete) return;
    setFinishing(true);
    setFinishError(null);
    try {
      await finishRound();
      navigation.navigate('Recap', { matchId, matchName, courseName, gameModeName });
    } catch (err) {
      setFinishError(err instanceof Error ? err.message : 'Could not finish the round — try again.');
    } finally {
      setFinishing(false);
    }
  }

  function viewRecap() {
    navigation.navigate('Recap', { matchId, matchName, courseName, gameModeName });
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
              <Text style={styles.headerTitle}>Finish round</Text>
              <Text style={styles.headerSubtitle}>
                {matchName} · {courseName}
              </Text>
            </View>
            <View style={styles.holesInBadge}>
              <Flag size={12} color={palette.green[300]} />
              <Text style={styles.holesInLabel}>{thru} of {holes.length} holes in</Text>
            </View>
          </View>

          {roundComplete ? (
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
          ) : (
            <View style={styles.resultCard}>
              <View style={[styles.resultIcon, styles.resultIconWaiting]}>
                <Clock size={22} color={palette.white} />
              </View>
              <View style={styles.resultBody}>
                <Text style={styles.resultOverline}>Match play result</Text>
                <Text style={styles.resultHeadline}>Waiting on everyone's card</Text>
                <Text style={styles.resultDetail}>
                  {thru} of {holes.length} holes locked in — the result and settlement show up here once every card is complete.
                </Text>
              </View>
            </View>
          )}
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {loading ? <Text style={styles.loadingText}>Loading round…</Text> : null}
          {finishError ? <Text style={styles.loadErrorText}>{finishError}</Text> : null}

          {roundComplete ? (
            <>
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
                  {settlement.map(({ player, money: m }, index) => {
                    const playerColor = getPlayerColors(index);
                    return (
                      <View key={player.playerId} style={styles.settlementRow}>
                        <View style={styles.settlementNameRow}>
                          <View style={[styles.settlementAvatar, { backgroundColor: playerColor.background }]}>
                            <Text style={[styles.settlementAvatarLabel, { color: playerColor.color }]}>{player.name.charAt(0)}</Text>
                          </View>
                          <Text style={styles.settlementName}>
                            {player.name}
                            {player.playerId === viewerId ? <Text style={styles.settlementYou}> (You)</Text> : null}
                          </Text>
                        </View>
                        <Text style={[styles.settlementAmount, { color: m > 0 ? colors.statusSuccess : m < 0 ? colors.statusDanger : colors.textMuted }]}>
                          {moneyLabel(m)}
                        </Text>
                      </View>
                    );
                  })}
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
            </>
          ) : null}

          <View style={styles.lockNote}>
            <Lock size={13} color={colors.textDisabled} />
            <Text style={styles.lockNoteText}>
              {!roundComplete
                ? 'Everyone needs to finish entering their scores before the round can be finished.'
                : isHostViewer
                  ? 'Once finished, scores lock and the round moves to everyone’s history.'
                  : 'Only the host can finish the round — you’ll see the recap once they do.'}
            </Text>
          </View>
        </ScrollView>

        <View style={styles.ctaWrap}>
          {isHostViewer && roundComplete ? (
            <Pressable style={styles.ctaButton} onPress={handleFinish} disabled={finishing || loading}>
              <Flag size={18} color={palette.white} />
              <Text style={styles.ctaLabel}>{finishing ? 'Finishing…' : 'Finish & save round'}</Text>
            </Pressable>
          ) : !isHostViewer && matchStatus === 'finished' ? (
            <Pressable style={styles.ctaButton} onPress={viewRecap}>
              <Flag size={18} color={palette.white} />
              <Text style={styles.ctaLabel}>View recap</Text>
            </Pressable>
          ) : (
            <View style={[styles.ctaButton, styles.ctaButtonDisabled]}>
              <Text style={styles.ctaLabel}>
                {!roundComplete ? 'Waiting for everyone’s scores' : 'Waiting for host to finish'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.inRoundNav}>
          <Pressable
            style={styles.inRoundTab}
            onPress={() => navigation.navigate('Scorecard', { matchId, matchName, courseName, gameModeName, isHost: isHostViewer })}
          >
            <List size={21} color={palette.sand[400]} />
            <Text style={styles.inRoundTabLabel}>Scorecard</Text>
          </Pressable>
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
  resultIconWaiting: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    shadowOpacity: 0,
    elevation: 0,
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
  sectionLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: spacing[2] + 2,
  },
  loadingText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    marginBottom: spacing[2],
  },
  loadErrorText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.statusDanger,
    marginBottom: spacing[2],
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
  settlementNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  settlementAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  settlementAvatarLabel: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 11,
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
  ctaButtonDisabled: {
    backgroundColor: palette.sand[300],
    shadowOpacity: 0,
    elevation: 0,
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
