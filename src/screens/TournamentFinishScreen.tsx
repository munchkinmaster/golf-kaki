import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Award, ChevronRight, Coins, Crown, Flag, List, Medal, Trophy, Wallet, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Card } from '../components/Card';
import { InRoundTabBar } from '../components/InRoundTabBar';
import type { InRoundTab } from '../components/InRoundTabBar';
import { SkinsHoleCell } from '../components/SkinsHoleCell';
import { computeThru } from '../data/round';
import { computeSkinsStandings, resolveSkinsHoles } from '../data/skins';
import { computeTournamentStandings, parTotal } from '../data/strokePlay';
import { computeSystem36Standings } from '../data/system36';
import { finishTournamentRound } from '../data/tournaments';
import { useTournamentRound } from '../hooks/useTournamentRound';
import type { RootStackParamList } from '../navigation/types';
import { colors, getFontFamily, getSolidAvatarColor, palette, radius, screenGutter, shadows, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'TournamentFinish'>;

const POS_COL_WIDTH = 30;
const STAT_COL_WIDTH = 44;
const TOTAL_COL_WIDTH = 52;
const LEADER_GOLD = '#C8971C';
const LEADER_GOLD_BG = '#FBF6E9';

function toParLabel(value: number): string {
  return value === 0 ? 'E' : value > 0 ? `+${value}` : String(value);
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function TournamentFinishScreen({ navigation, route }: Props) {
  const { tournamentId, matchId } = route.params;
  const round = useTournamentRound(tournamentId, matchId);
  const { loading, error, viewerId, isHostViewer, roster, holes, playOrder, scores, gross, thru, matchStatus, sideGames } = round;

  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [expandedSkinsPlayerId, setExpandedSkinsPlayerId] = useState<string | null>(null);

  if (loading) {
    return (
      <View style={styles.page}>
        <SafeAreaView style={styles.centerFill}>
          <Text style={styles.loadingText}>Loading…</Text>
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

  const rosterIds = roster.map((p) => p.id);
  const playingHandicaps = Object.fromEntries(roster.map((p) => [p.id, p.playingHandicap]));
  const perPlayerThru = Object.fromEntries(rosterIds.map((id) => [id, computeThru([id], scores, playOrder)]));
  const standings = computeTournamentStandings(rosterIds, perPlayerThru, gross, holes, playingHandicaps, playOrder, round.tieBreakRule);
  const viewerRow = standings.find((r) => r.playerId === viewerId);
  const viewerPlayer = roster.find((p) => p.id === viewerId);

  const isSystem36 = round.scoringFormat === 'system_36';
  // System 36 settles on Stableford off the derived (36 − points) handicap;
  // the hero and standings key off this instead of the nett standings above.
  const s36Standings = isSystem36 ? computeSystem36Standings(rosterIds, perPlayerThru, gross, holes, playOrder) : [];
  const viewerS36 = s36Standings.find((r) => r.playerId === viewerId);
  const s36Winner = s36Standings.find((r) => r.rank === 1);

  const roundComplete = holes.length > 0 && thru === holes.length;
  const isFinished = matchStatus === 'finished';

  const bestGrossRow = standings.filter((r) => r.thru > 0).reduce<(typeof standings)[number] | null>((best, r) => (!best || r.gross < best.gross ? r : best), null);

  const skinsConfig = sideGames.find((g) => g.type === 'skins');
  const skinsResults = skinsConfig ? resolveSkinsHoles(skinsConfig, scores, holes, playingHandicaps, playOrder) : [];
  const skinsStandings = skinsConfig ? computeSkinsStandings(skinsConfig, skinsResults) : {};
  const skinsRows = skinsConfig
    ? [...skinsConfig.participantIds].sort((a, b) => (skinsStandings[b]?.netDollars ?? 0) - (skinsStandings[a]?.netDollars ?? 0))
    : [];
  const viewerSkins = viewerId ? skinsStandings[viewerId] : undefined;

  async function handleFinish() {
    if (!isHostViewer || finishing || !roundComplete) return;
    setFinishing(true);
    setFinishError(null);
    try {
      await finishTournamentRound(matchId);
      round.refresh();
    } catch {
      setFinishError("Couldn't finish the round — please try again.");
    } finally {
      setFinishing(false);
    }
  }

  function handleTabNavigate(tab: InRoundTab) {
    if (tab === 'finish') return;
    if (tab === 'scorecard') navigation.navigate('TournamentScorecard', { tournamentId, matchId });
    else if (tab === 'leaderboard') navigation.navigate('TournamentLeaderboard', { tournamentId, matchId });
    else if (tab === 'lobby') navigation.navigate('TournamentLobby', { tournamentId, matchId });
  }

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <Text style={styles.heroOverline}>{isFinished ? 'Round complete' : 'In progress'}</Text>
            <Pressable onPress={() => navigation.navigate('Home')} hitSlop={8}>
              <X size={20} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>
          <Text style={styles.heroTitle}>{round.matchName}</Text>
          <Text style={styles.heroSubtitle}>
            {isSystem36 ? `System 36 · ${holes.length} holes` : `Stroke play · Nett ${round.handicapAllowancePct}% · ${holes.length} holes`}
          </Text>
          {isSystem36 ? (
            <View style={styles.heroStatsRow}>
              <View style={styles.heroTile}>
                <Text style={styles.heroTileLabel}>Gross</Text>
                <Text style={styles.heroTileValue}>{viewerS36?.gross ?? 0}</Text>
              </View>
              <View style={styles.heroTile}>
                <Text style={styles.heroTileLabel}>HCP</Text>
                <Text style={styles.heroTileValue}>{viewerS36?.s36Handicap ?? 36}</Text>
              </View>
              <View style={styles.heroTile}>
                <Text style={styles.heroTileLabel}>Nett</Text>
                <Text style={styles.heroTileValue}>{viewerS36 ? viewerS36.gross - viewerS36.s36Handicap : 0}</Text>
              </View>
              <View style={[styles.heroTile, styles.heroTileStbf]}>
                <Text style={styles.heroTileLabelStbf}>Stbf</Text>
                <Text style={styles.heroTileValue}>{viewerS36?.stableford ?? 0}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.heroStatsRow}>
              <View style={styles.heroTile}>
                <Text style={styles.heroTileLabel}>Gross</Text>
                <Text style={styles.heroTileValue}>{viewerRow?.gross ?? 0}</Text>
              </View>
              <View style={[styles.heroTile, styles.heroTileNett]}>
                <Text style={styles.heroTileLabelNett}>Nett</Text>
                <Text style={styles.heroTileValue}>{viewerRow?.nett ?? 0}</Text>
              </View>
              <View style={styles.heroTile}>
                <Text style={styles.heroTileLabel}>To par</Text>
                <Text style={[styles.heroTileValue, styles.heroTileValueToPar]}>{viewerRow && viewerRow.thru > 0 ? toParLabel(viewerRow.toPar) : '–'}</Text>
              </View>
            </View>
          )}
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {!roundComplete ? (
            <View style={styles.gateCard}>
              <View style={styles.gateIconTile}>
                <Flag size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.gateTitle}>
                  {thru} of {holes.length} holes in
                </Text>
                <Text style={styles.gateSubtitle}>
                  Final standings and the Skins settlement show up here once every card is complete.
                </Text>
              </View>
            </View>
          ) : (
            <>
              {isSystem36 ? (
                viewerS36 ? (
                  <>
                    <View style={styles.finishedCard}>
                      <View style={styles.finishedIconTile}>
                        <Medal size={20} color={colors.accent} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.finishedTitle}>
                          {ordinal(viewerS36.rank)} · {viewerS36.stableford} Stableford pts
                        </Text>
                        <Text style={styles.finishedSubtitle}>
                          {viewerS36.rank === 1
                            ? 'Top of the board — nicely played.'
                            : s36Winner
                              ? `${roster.find((p) => p.id === s36Winner.playerId)?.name.split(' ')[0]} took it with ${s36Winner.stableford}.`
                              : 'Nice round out there.'}
                        </Text>
                      </View>
                    </View>
                    <Card variant="inverse" watermark watermarkSize={92} padding={spacing[3] + 1} style={styles.s36HcpCard}>
                      <Text style={styles.s36HcpOverline}>Your handicap today</Text>
                      <View style={styles.s36HcpRow}>
                        <Text style={styles.s36HcpValue}>{viewerS36.s36Handicap}</Text>
                        <Text style={styles.s36HcpFormula}>= 36 − {viewerS36.s36Points} points</Text>
                      </View>
                    </Card>
                  </>
                ) : null
              ) : viewerRow ? (
                <View style={styles.finishedCard}>
                  <View style={styles.finishedIconTile}>
                    <Trophy size={20} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.finishedTitle}>You finished {ordinal(viewerRow.rank)} nett</Text>
                    <Text style={styles.finishedSubtitle}>Nice round out there.</Text>
                  </View>
                </View>
              ) : null}

              <View>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabel}>Final standings · {isSystem36 ? 'Stableford' : 'nett'}</Text>
                  <Text style={styles.sectionCaption}>{roster.length} players</Text>
                </View>
                {isSystem36 ? (
                  <View style={styles.tableCard}>
                    <View style={styles.tableHeaderRow}>
                      <View style={styles.tableHeaderPosCell}>
                        <Text style={[styles.tableHeaderLabel, { width: POS_COL_WIDTH }]}>Pos</Text>
                        <Text style={styles.tableHeaderLabel}>Player</Text>
                      </View>
                      <Text style={[styles.tableHeaderLabel, styles.tableStatHeaderCell]}>Gross</Text>
                      <Text style={[styles.tableHeaderLabel, styles.tableStatHeaderCell]}>HCP</Text>
                      <Text style={[styles.tableHeaderLabel, styles.tableStatHeaderCell]}>Nett</Text>
                      <Text style={[styles.tableHeaderLabel, styles.tableStatHeaderCell, styles.tableTotalHeaderCell]}>Stbf</Text>
                    </View>
                    {s36Standings.map((row) => {
                      const player = roster.find((p) => p.id === row.playerId);
                      if (!player) return null;
                      const isYou = row.playerId === viewerId;
                      const isLeader = row.rank === 1;
                      const rowBg = isLeader ? LEADER_GOLD_BG : isYou ? '#F7FBF5' : colors.surfaceCard;
                      return (
                        <View key={row.playerId} style={[styles.tableRow, { backgroundColor: rowBg }]}>
                          <View style={styles.tablePosCell}>
                            <View style={styles.tableRankCol}>
                              <Text style={[styles.tableRankText, isLeader && { color: LEADER_GOLD }]}>{row.rank}</Text>
                              {isLeader ? <Crown size={12} color={LEADER_GOLD} /> : null}
                            </View>
                            <View style={[styles.tableAvatar, { backgroundColor: getSolidAvatarColor(roster.indexOf(player)) }]}>
                              <Text style={styles.tableAvatarLabel}>{player.name[0]?.toUpperCase()}</Text>
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={[styles.tableName, (isLeader || isYou) && { color: colors.primary }]} numberOfLines={1}>
                                {player.name}
                                {isYou ? ' (you)' : ''}
                              </Text>
                              <Text style={styles.tableHcp}>{row.s36Points} S36 pts</Text>
                            </View>
                          </View>
                          <Text style={styles.tableStatCell}>{row.gross}</Text>
                          <Text style={styles.tableStatCell}>{row.s36Handicap}</Text>
                          <Text style={styles.tableStatCell}>{row.gross - row.s36Handicap}</Text>
                          <Text style={[styles.tableTotalCell, { color: colors.primary }]}>{row.stableford}</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                <View style={styles.tableCard}>
                  <View style={styles.tableHeaderRow}>
                    <View style={styles.tableHeaderPosCell}>
                      <Text style={[styles.tableHeaderLabel, { width: POS_COL_WIDTH }]}>Pos</Text>
                      <Text style={styles.tableHeaderLabel}>Player</Text>
                    </View>
                    <Text style={[styles.tableHeaderLabel, styles.tableStatHeaderCell]}>Gross</Text>
                    <Text style={[styles.tableHeaderLabel, styles.tableStatHeaderCell]}>Nett</Text>
                    <Text style={[styles.tableHeaderLabel, styles.tableStatHeaderCell, styles.tableTotalHeaderCell]}>Total</Text>
                  </View>
                  {standings.map((row) => {
                    const player = roster.find((p) => p.id === row.playerId);
                    if (!player) return null;
                    const isYou = row.playerId === viewerId;
                    const isLeader = row.rank === 1;
                    const rowBg = isLeader ? LEADER_GOLD_BG : isYou ? colors.surfaceBrandSoft : colors.surfaceCard;
                    return (
                      <View key={row.playerId} style={[styles.tableRow, { backgroundColor: rowBg }]}>
                        <View style={styles.tablePosCell}>
                          <View style={styles.tableRankCol}>
                            <Text style={[styles.tableRankText, isLeader && { color: LEADER_GOLD }, isYou && !isLeader && { color: colors.primary }]}>
                              {row.rank}
                            </Text>
                            {isLeader ? <Crown size={12} color={LEADER_GOLD} /> : null}
                          </View>
                          <View style={[styles.tableAvatar, { backgroundColor: getSolidAvatarColor(roster.indexOf(player)) }]}>
                            <Text style={styles.tableAvatarLabel}>{player.name[0]?.toUpperCase()}</Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text
                              style={[styles.tableName, isLeader && { color: LEADER_GOLD }, isYou && !isLeader && { color: colors.primary }]}
                              numberOfLines={1}
                            >
                              {player.name}
                              {isYou ? ' (you)' : ''}
                            </Text>
                            <Text style={styles.tableHcp}>HCP {player.playingHandicap}</Text>
                          </View>
                        </View>
                        <Text style={styles.tableStatCell}>{row.gross}</Text>
                        <Text style={styles.tableStatCell}>{row.nett}</Text>
                        <Text style={[styles.tableTotalCell, { color: row.toPar < 0 ? colors.statusSuccess : colors.textSecondary }]}>
                          {toParLabel(row.toPar)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                )}
              </View>

              {!isSystem36 && bestGrossRow ? (
                <Card variant="inverse" watermark watermarkSize={110} padding={spacing[3] + 1} style={styles.grossStrip}>
                  <View style={styles.grossIconTile}>
                    <Award size={19} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.grossLabel}>Best gross</Text>
                    <Text style={styles.grossValue}>
                      {roster.find((p) => p.id === bestGrossRow.playerId)?.name.split(' ')[0]} · {bestGrossRow.gross} (
                      {toParLabel(bestGrossRow.gross - parTotal(bestGrossRow.thru, holes, playOrder))})
                    </Text>
                  </View>
                </Card>
              ) : null}

              {skinsConfig && skinsRows.length > 0 ? (
                <View>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.skinsHeaderLeft}>
                      <Coins size={14} color={colors.scoreBirdie} />
                      <Text style={styles.sectionLabel}>Side game · Skins</Text>
                    </View>
                    <Text style={styles.sectionCaption}>
                      ${skinsConfig.stakePerHole}/skin · {holes.length} holes
                    </Text>
                  </View>
                  <View style={styles.skinsCard}>
                    <View style={styles.skinsHeroRow}>
                      <View style={styles.skinsWalletTile}>
                        <Wallet size={17} color={palette.white} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.skinsHeroTitle}>
                          {!viewerSkins || viewerSkins.netDollars === 0
                            ? 'Skins all square'
                            : viewerSkins.netDollars > 0
                              ? `You win $${viewerSkins.netDollars}`
                              : `You lose $${Math.abs(viewerSkins.netDollars)}`}
                        </Text>
                        <Text style={styles.skinsHeroSubtitle}>
                          You banked {viewerSkins ? (Number.isInteger(viewerSkins.skinsWon) ? viewerSkins.skinsWon : viewerSkins.skinsWon.toFixed(1)) : 0} skins this round
                        </Text>
                      </View>
                    </View>
                    {skinsRows.map((playerId, index) => {
                      const player = roster.find((p) => p.id === playerId);
                      const result = skinsStandings[playerId];
                      if (!player || !result) return null;
                      const won = result.netDollars >= 0;
                      const skinsWonLabel = Number.isInteger(result.skinsWon) ? result.skinsWon : result.skinsWon.toFixed(1);
                      const expanded = expandedSkinsPlayerId === playerId;
                      return (
                        <View key={playerId} style={styles.skinsRowWrap}>
                          <Pressable style={styles.skinsRow} onPress={() => setExpandedSkinsPlayerId(expanded ? null : playerId)}>
                            <Text style={styles.skinsRank}>{index + 1}</Text>
                            <View style={[styles.skinsAvatar, { backgroundColor: getSolidAvatarColor(roster.indexOf(player)) }]}>
                              <Text style={styles.tableAvatarLabel}>{player.name[0]?.toUpperCase()}</Text>
                            </View>
                            <Text style={styles.skinsName} numberOfLines={1}>
                              {player.name}
                            </Text>
                            <Text style={styles.skinsCount}>{skinsWonLabel} skins</Text>
                            <Text style={[styles.skinsNet, { color: won ? colors.skinsWonText : colors.skinsLostText }]}>
                              {won ? '+$' : '-$'}
                              {Math.abs(result.netDollars)}
                            </Text>
                            <ChevronRight size={14} color={palette.sand[400]} style={expanded && styles.chevronExpanded} />
                          </Pressable>
                          {expanded ? (
                            <View style={styles.skinsDetail}>
                              <View style={styles.skinsDetailHeaderRow}>
                                <Text style={styles.skinsDetailLabel}>Hole by hole</Text>
                                <Text style={styles.skinsDetailHint}>skins won/lost · 0 = no change</Text>
                              </View>
                              <View style={styles.skinsDetailRow}>
                                {holes.slice(0, 9).map((h) => (
                                  <SkinsHoleCell key={h.n} holeN={h.n} delta={result.holeDeltas[h.n]} />
                                ))}
                              </View>
                              <View style={styles.skinsDetailRow}>
                                {holes.slice(9, 18).map((h) => (
                                  <SkinsHoleCell key={h.n} holeN={h.n} delta={result.holeDeltas[h.n]} />
                                ))}
                              </View>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>

        <View style={styles.actions}>
          {finishError ? <Text style={styles.errorText}>{finishError}</Text> : null}
          <View style={styles.actionsRow}>
            <Pressable style={styles.scorecardButton} onPress={() => navigation.navigate('TournamentScorecardGrid', { tournamentId, matchId })}>
              <List size={16} color={colors.primary} />
              <Text style={styles.scorecardButtonLabel}>Scorecard</Text>
            </Pressable>
            {isFinished ? (
              <Pressable style={styles.doneButton} onPress={() => navigation.navigate('Home')}>
                <Text style={styles.doneButtonLabel}>Done</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.doneButton, (!isHostViewer || !roundComplete || finishing) && styles.doneButtonDisabled]}
                onPress={handleFinish}
                disabled={!isHostViewer || !roundComplete || finishing}
              >
                <Text style={styles.doneButtonLabel}>{finishing ? 'Finishing…' : isHostViewer ? 'Finish round' : 'Waiting for cards'}</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Once the round is finished this screen becomes the permanent past-round
            recap (reachable later from Home/Rounds/Notifications) — no tab bar, so
            there's no route back into the live Scorecard entry screen where someone
            could accidentally edit a settled score. The footer's own "Scorecard"
            button above stays available for review — it opens the read-only grid,
            not the editable entry screen. */}
        {!isFinished ? <InRoundTabBar active="finish" onNavigate={handleTabNavigate} /> : null}
      </SafeAreaView>
    </View>
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
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: screenGutter,
    paddingTop: spacing[2],
    paddingBottom: spacing[5] + 2,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroOverline: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 2,
    color: palette.orange[300],
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 23,
    color: palette.white,
    marginTop: spacing[2] + 2,
  },
  heroSubtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: 'rgba(255,255,255,0.66)',
    marginTop: 3,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[4],
  },
  heroTile: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: radius.md + 1,
    paddingVertical: spacing[2] + 3,
    paddingHorizontal: spacing[2],
    alignItems: 'center',
  },
  heroTileNett: {
    backgroundColor: colors.accent,
  },
  heroTileLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    letterSpacing: 0.6,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
  },
  heroTileLabelNett: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    letterSpacing: 0.6,
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
  },
  heroTileValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 26,
    color: palette.white,
    marginTop: 2,
  },
  heroTileValueToPar: {
    color: '#8FE3A8',
  },
  heroTileStbf: {
    backgroundColor: colors.accent,
    ...shadows.accent,
  },
  heroTileLabelStbf: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    letterSpacing: 0.6,
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
  },
  s36HcpCard: {
    overflow: 'hidden',
  },
  s36HcpOverline: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.orange[300],
  },
  s36HcpRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[2] + 1,
    marginTop: spacing[1] + 1,
  },
  s36HcpValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 34,
    lineHeight: 36,
    color: palette.white,
  },
  s36HcpFormula: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: screenGutter, paddingTop: spacing[4], paddingBottom: spacing[4], gap: spacing[4] },
  gateCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.lg - 2,
    padding: spacing[3] + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  gateIconTile: {
    width: 40,
    height: 40,
    borderRadius: radius.md - 1,
    backgroundColor: colors.surfaceBrandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  gateTitle: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: colors.textPrimary,
  },
  gateSubtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    marginTop: 2,
    lineHeight: 17,
  },
  finishedCard: {
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1.5,
    borderColor: palette.green[200],
    borderRadius: radius.lg - 2,
    padding: spacing[3] + 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  finishedIconTile: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  finishedTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 16,
    color: colors.primary,
  },
  finishedSubtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  sectionLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  sectionCaption: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
  },
  tableCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing[2] + 1,
  },
  tableHeaderPosCell: {
    flex: 1,
    minWidth: POS_COL_WIDTH + 90,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing[3],
  },
  tableHeaderLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 9,
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.72)',
    textTransform: 'uppercase',
  },
  tableStatHeaderCell: {
    width: STAT_COL_WIDTH,
    textAlign: 'center',
  },
  tableTotalHeaderCell: {
    width: TOTAL_COL_WIDTH,
    color: palette.orange[300],
    paddingRight: spacing[2] + 2,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EFE8D5',
  },
  tablePosCell: {
    flex: 1,
    minWidth: POS_COL_WIDTH + 90,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2] + 1,
    paddingLeft: spacing[3],
  },
  tableRankCol: {
    width: POS_COL_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  tableRankText: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: colors.textSecondary,
  },
  tableAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tableAvatarLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 12,
    color: palette.white,
  },
  tableName: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 13,
    color: colors.textPrimary,
  },
  tableHcp: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    color: colors.textDisabled,
  },
  tableStatCell: {
    width: STAT_COL_WIDTH,
    textAlign: 'center',
    fontFamily: getFontFamily('numeric', '400'),
    fontSize: 12,
    color: colors.textPrimary,
  },
  tableTotalCell: {
    width: TOTAL_COL_WIDTH,
    textAlign: 'center',
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 15,
    paddingRight: spacing[2] + 2,
  },
  grossStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
  },
  grossIconTile: {
    width: 38,
    height: 38,
    borderRadius: radius.md - 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  grossLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
  },
  grossValue: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: palette.white,
    marginTop: 1,
  },
  skinsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
  },
  skinsCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: '#F4C79B',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  skinsHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
    backgroundColor: '#FFF3E9',
    padding: spacing[3] + 1,
    borderBottomWidth: 1,
    borderBottomColor: '#F7DBBF',
  },
  skinsWalletTile: {
    width: 34,
    height: 34,
    borderRadius: radius.md - 1,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  skinsHeroTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 16,
    color: '#9A4A12',
  },
  skinsHeroSubtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: '#9A5A1E',
    marginTop: 1,
  },
  skinsRowWrap: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3EEE3',
  },
  skinsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
    paddingVertical: spacing[2] - 1,
    paddingHorizontal: spacing[3] + 1,
  },
  chevronExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  skinsDetail: {
    backgroundColor: '#FCF8EF',
    padding: spacing[2] + 3,
  },
  skinsDetailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  skinsDetailLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  skinsDetailHint: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    color: colors.textDisabled,
  },
  skinsDetailRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  skinsRank: {
    width: 14,
    textAlign: 'center',
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 12,
    color: colors.textSecondary,
  },
  skinsAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  skinsName: {
    flex: 1,
    minWidth: 0,
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.textPrimary,
  },
  skinsCount: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    flexShrink: 0,
  },
  skinsNet: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 14,
    minWidth: 44,
    textAlign: 'right',
    flexShrink: 0,
  },
  actions: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[2] + 2,
    paddingBottom: spacing[2],
    gap: spacing[2] + 1,
  },
  errorText: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: colors.statusDanger,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing[2] + 1,
  },
  scorecardButton: {
    flex: 1,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: palette.green[200],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1] + 3,
  },
  scorecardButtonLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: colors.primary,
  },
  doneButton: {
    flex: 1,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonDisabled: {
    opacity: 0.5,
  },
  doneButtonLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: palette.white,
  },
});
