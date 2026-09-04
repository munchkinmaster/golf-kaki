import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Award, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleDot, Coins, Crown, HandCoins, List, Lock, Minus, Trophy } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Card } from '../components/Card';
import { InRoundTabBar } from '../components/InRoundTabBar';
import type { InRoundTab } from '../components/InRoundTabBar';
import { SkinsHoleCell } from '../components/SkinsHoleCell';
import type { Course as CatalogCourse } from '../data/courses';
import { fetchCourseCatalog } from '../data/courses';
import { computeThru } from '../data/round';
import { computeSkinsStandings, resolveSkinsHoles } from '../data/skins';
import { computeStablefordStandings } from '../data/stableford';
import { computeTournamentStandings, parTotal } from '../data/strokePlay';
import { SYSTEM36_TOTAL_HOLES, computeSystem36Standings, isLeaderboardUnlocked } from '../data/system36';
import { useFinishRedirect } from '../hooks/useFinishRedirect';
import { useTournamentRound } from '../hooks/useTournamentRound';
import type { RootStackParamList } from '../navigation/types';
import { colors, getFontFamily, getSolidAvatarColor, palette, radius, screenGutter, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'TournamentLeaderboard'>;

const POS_COL_WIDTH = 168;
const HOLE_COL_WIDTH = 28;
const STAT_COL_WIDTH = 42;
const LEADER_GOLD = '#C8971C';
const LEADER_GOLD_BG = '#FBF6E9';

function toParLabel(value: number): string {
  return value === 0 ? 'E' : value > 0 ? `+${value}` : String(value);
}

/** "Daniel" / "Daniel and Marcus" / "Daniel, Marcus and Aisha" — the join used by the Stableford "plays to handicap" callout's list of names. */
function joinNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function TournamentLeaderboardScreen({ navigation, route }: Props) {
  const { tournamentId, matchId } = route.params;
  const round = useTournamentRound(tournamentId, matchId);
  const { loading, error, viewerId, roster, holes, playOrder, scores, gross, thru, sideGames, courseId, tieBreakRule, matchStatus } = round;

  useFinishRedirect(
    matchStatus,
    loading,
    useCallback(() => navigation.navigate('TournamentFinish', { tournamentId, matchId }), [navigation, tournamentId, matchId]),
  );

  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [expandedSkinsPlayerId, setExpandedSkinsPlayerId] = useState<string | null>(null);

  useEffect(() => {
    fetchCourseCatalog()
      .then(setCatalog)
      .catch(() => {});
  }, []);

  const courseName = catalog.find((c) => c.id === courseId)?.name ?? '';

  const rosterIds = useMemo(() => roster.map((p) => p.id), [roster]);
  const playingHandicaps = useMemo(() => Object.fromEntries(roster.map((p) => [p.id, p.playingHandicap])), [roster]);
  const perPlayerThru = useMemo(
    () => Object.fromEntries(rosterIds.map((id) => [id, computeThru([id], scores, playOrder)])),
    [rosterIds, scores, playOrder],
  );

  const standings = useMemo(
    () => computeTournamentStandings(rosterIds, perPlayerThru, gross, holes, playingHandicaps, playOrder, tieBreakRule),
    [rosterIds, perPlayerThru, gross, holes, playingHandicaps, playOrder, tieBreakRule],
  );

  // Rank a hole ago, purely re-derived (no persistence) — same "nothing
  // materialized, everything computed on demand" philosophy skins.ts
  // already commits to. Only meaningful per-player (each player's own
  // thru minus one), not a shared "whole field a hole ago" snapshot.
  const prevRankByPlayer = useMemo(() => {
    const prevThru = Object.fromEntries(rosterIds.map((id) => [id, Math.max(0, (perPlayerThru[id] ?? 0) - 1)]));
    const prevStandings = computeTournamentStandings(rosterIds, prevThru, gross, holes, playingHandicaps, playOrder, tieBreakRule);
    return Object.fromEntries(prevStandings.map((r) => [r.playerId, r.rank]));
  }, [rosterIds, perPlayerThru, gross, holes, playingHandicaps, playOrder, tieBreakRule]);

  const bestGrossRow = useMemo(() => {
    const started = standings.filter((r) => r.thru > 0);
    if (started.length === 0) return null;
    return started.reduce((best, r) => (r.gross < best.gross ? r : best));
  }, [standings]);

  const skinsConfig = sideGames.find((g) => g.type === 'skins');
  const skinsResults = useMemo(
    () => (skinsConfig ? resolveSkinsHoles(skinsConfig, scores, holes, playingHandicaps, playOrder) : []),
    [skinsConfig, scores, holes, playingHandicaps, playOrder],
  );
  const skinsStandings = useMemo(() => (skinsConfig ? computeSkinsStandings(skinsConfig, skinsResults) : {}), [skinsConfig, skinsResults]);
  const skinsRows = skinsConfig
    ? [...skinsConfig.participantIds].sort((a, b) => (skinsStandings[b]?.netDollars ?? 0) - (skinsStandings[a]?.netDollars ?? 0))
    : [];

  const allFinished = standings.length > 0 && standings.every((r) => r.finished);

  const isSystem36 = round.scoringFormat === 'system_36';
  // System 36 shows NO provisional board — locked until the last card is in
  // (field thru === 18), then the settled Stableford ranking. Ranked by
  // Stableford points descending; see computeSystem36Standings.
  const s36Unlocked = isLeaderboardUnlocked(thru);
  const s36Locked = isSystem36 && !s36Unlocked;
  const s36Standings = useMemo(
    () => (isSystem36 ? computeSystem36Standings(rosterIds, perPlayerThru, gross, holes, playOrder) : []),
    [isSystem36, rosterIds, perPlayerThru, gross, holes, playOrder],
  );

  // Stableford ranks by points, live throughout — no lock like System 36
  // (points are derived from an ordinary upfront Playing Handicap, so
  // there's nothing to wait on).
  const isStableford = round.scoringFormat === 'stableford';
  const stablefordStandings = useMemo(
    () => (isStableford ? computeStablefordStandings(rosterIds, perPlayerThru, gross, holes, playingHandicaps, playOrder, tieBreakRule) : []),
    [isStableford, rosterIds, perPlayerThru, gross, holes, playingHandicaps, playOrder, tieBreakRule],
  );
  const stablefordPrevRankByPlayer = useMemo(() => {
    if (!isStableford) return {};
    const prevThru = Object.fromEntries(rosterIds.map((id) => [id, Math.max(0, (perPlayerThru[id] ?? 0) - 1)]));
    const prevStandings = computeStablefordStandings(rosterIds, prevThru, gross, holes, playingHandicaps, playOrder, tieBreakRule);
    return Object.fromEntries(prevStandings.map((r) => [r.playerId, r.rank]));
  }, [isStableford, rosterIds, perPlayerThru, gross, holes, playingHandicaps, playOrder, tieBreakRule]);
  const stablefordBestGrossRow = useMemo(() => {
    const started = stablefordStandings.filter((r) => r.thru > 0);
    if (started.length === 0) return null;
    return started.reduce((best, r) => (r.gross < best.gross ? r : best));
  }, [stablefordStandings]);
  // "36 pts plays to handicap" callout — names whoever's beaten that mark,
  // once the round is fully in (mid-round totals aren't a fair comparison
  // against a full-18 target).
  const stablefordAllFinished = stablefordStandings.length > 0 && stablefordStandings.every((r) => r.finished);
  const stablefordBeatMarkNames = stablefordAllFinished
    ? stablefordStandings
        .filter((r) => r.points > 36)
        .map((r) => roster.find((p) => p.id === r.playerId)?.name.split(' ')[0])
        .filter((n): n is string => n !== undefined)
    : [];

  function handleTabNavigate(tab: InRoundTab) {
    if (tab === 'leaderboard') return;
    if (tab === 'scorecard') navigation.navigate('TournamentScorecard', { tournamentId, matchId });
    else if (tab === 'lobby') navigation.navigate('TournamentLobby', { tournamentId, matchId });
    else if (tab === 'finish') navigation.navigate('TournamentFinish', { tournamentId, matchId });
  }

  if (loading) {
    return (
      <View style={styles.page}>
        <SafeAreaView style={styles.centerFill}>
          <Text style={styles.loadingText}>Loading leaderboard…</Text>
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

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
              <ChevronLeft size={20} color="rgba(255,255,255,0.8)" />
            </Pressable>
            <View style={styles.headerTitleGroup}>
              <Text style={styles.headerTitle}>Leaderboard</Text>
              <Text style={styles.headerSubtitle}>
                {round.matchName}
                {courseName ? ` · ${courseName}` : ''}
              </Text>
            </View>
            {s36Locked ? (
              <View style={styles.lockedPill}>
                <Lock size={11} color="rgba(255,255,255,0.72)" />
                <Text style={styles.lockedPillLabel}>LOCKED</Text>
              </View>
            ) : (
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusPillLabel}>THRU {thru}</Text>
              </View>
            )}
          </View>
        </View>

        {s36Locked ? (
          <View style={styles.lockedFill}>
            <View style={styles.lockedPlate}>
              <Trophy size={36} color={colors.primary} />
              <View style={styles.lockedPlateBadge}>
                <Lock size={14} color={colors.textMuted} />
              </View>
            </View>
            <Text style={styles.lockedHeadline}>Standings open at {SYSTEM36_TOTAL_HOLES}</Text>
            <Text style={styles.lockedBody}>
              Everyone’s handicap is still moving, so there’s no real board yet. Keep scoring — standings appear the moment the last card is in.
            </Text>
            <Pressable style={styles.lockedButton} onPress={() => navigation.navigate('TournamentScorecard', { tournamentId, matchId })}>
              <List size={16} color={palette.white} />
              <Text style={styles.lockedButtonLabel}>Back to scorecard</Text>
            </Pressable>
          </View>
        ) : isSystem36 ? (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <View style={styles.captionRow}>
              <CircleDot size={11} color={colors.statusSuccess} />
              <Text style={styles.captionText}>Final · {holes.length} holes · System 36 · most Stableford pts</Text>
            </View>

            <View style={styles.tableCard}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  {/* HEADER */}
                  <View style={styles.tableHeaderRow}>
                    <View style={styles.s36PosHeader}>
                      <Text style={[styles.tableHeaderLabel, { width: 38 }]}>Pos</Text>
                      <Text style={styles.tableHeaderLabel}>Player</Text>
                    </View>
                    <Text style={[styles.tableHeaderLabel, styles.s36ColGross]}>Gross</Text>
                    <Text style={[styles.tableHeaderLabel, styles.s36ColS36]}>S36</Text>
                    <Text style={[styles.tableHeaderLabel, styles.s36ColHcp]}>HCP</Text>
                    <Text style={[styles.tableHeaderLabel, styles.s36ColStbf, styles.s36StbfHeader]}>Stbf</Text>
                  </View>
                  {s36Standings.map((row) => {
                    const player = roster.find((p) => p.id === row.playerId);
                    if (!player) return null;
                    const isYou = row.playerId === viewerId;
                    const isLeader = row.rank === 1;
                    const rowBg = isLeader ? LEADER_GOLD_BG : isYou ? '#F7FBF5' : colors.surfaceCard;
                    return (
                      <View key={row.playerId} style={[styles.tableRow, { backgroundColor: rowBg }]}>
                        <View style={[styles.s36PosCell, { backgroundColor: rowBg }]}>
                          <View style={styles.s36RankCol}>
                            <Text style={[styles.posRankText, isLeader && { color: LEADER_GOLD }]}>{row.rank}</Text>
                            {isLeader ? <Crown size={14} color={LEADER_GOLD} /> : null}
                          </View>
                          <View style={[styles.posAvatar, { backgroundColor: getSolidAvatarColor(roster.indexOf(player)) }]}>
                            <Text style={styles.posAvatarLabel}>{player.name[0]?.toUpperCase()}</Text>
                          </View>
                          <View style={styles.posNameCol}>
                            <Text style={[styles.posName, (isLeader || isYou) && { color: colors.primary }]} numberOfLines={1}>
                              {player.name}
                              {isYou ? ' (you)' : ''}
                            </Text>
                            <Text style={styles.posMeta}>System 36</Text>
                          </View>
                        </View>
                        <Text style={[styles.s36StatCell, styles.s36ColGross]}>{row.gross}</Text>
                        <Text style={[styles.s36StatCell, styles.s36ColS36]}>{row.s36Points}</Text>
                        <Text style={[styles.s36StatCell, styles.s36ColHcp]}>{row.s36Handicap}</Text>
                        <Text style={[styles.s36StbfCell, styles.s36ColStbf, row.rank > 1 && !isYou && styles.s36StbfCellMuted]}>{row.stableford}</Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            <View style={styles.s36Explainer}>
              <Text style={styles.s36ExplainerText}>System 36 points set each handicap; Stableford points decide the win.</Text>
            </View>
          </ScrollView>
        ) : isStableford ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.captionRow}>
            <CircleDot size={11} color={colors.statusSuccess} />
            <Text style={styles.captionText}>
              {stablefordAllFinished ? 'Final' : 'Live'} · {holes.length} holes · Stableford · nett {round.handicapAllowancePct}%
            </Text>
          </View>

          {/* STANDINGS TABLE — ranked by points, descending */}
          <View style={styles.tableCard}>
            <View style={styles.tableHeaderRow}>
              <View style={styles.posHeaderCell}>
                <Text style={[styles.tableHeaderLabel, { width: 40 }]}>Pos</Text>
                <Text style={styles.tableHeaderLabel}>Player</Text>
              </View>
              <Text style={[styles.tableHeaderLabel, styles.holeHeaderCell]}>Thru</Text>
              <Text style={[styles.tableHeaderLabel, styles.statHeaderCell]}>Gross</Text>
              <Text style={[styles.tableHeaderLabel, styles.statHeaderCell]}>Nett</Text>
              <Text style={[styles.tableHeaderLabel, styles.statHeaderCell, styles.totalHeaderCell]}>Points</Text>
            </View>
            {stablefordStandings.map((row) => {
              const player = roster.find((p) => p.id === row.playerId);
              if (!player) return null;
              const isYou = row.playerId === viewerId;
              const isLeader = row.rank === 1;
              const prevRank = stablefordPrevRankByPlayer[row.playerId] ?? row.rank;
              const delta = row.thru > 0 ? prevRank - row.rank : 0;
              const rowBg = isLeader ? LEADER_GOLD_BG : isYou ? colors.surfaceBrandSoft : colors.surfaceCard;
              return (
                <View key={row.playerId} style={[styles.tableRow, { backgroundColor: rowBg }]}>
                  <View style={[styles.posCell, { backgroundColor: rowBg }]}>
                    <View style={styles.posRankCol}>
                      <Text style={[styles.posRankText, isLeader && { color: LEADER_GOLD }, isYou && !isLeader && { color: colors.primary }]}>
                        {row.rank}
                      </Text>
                      {isLeader ? (
                        <Crown size={14} color={LEADER_GOLD} />
                      ) : delta > 0 ? (
                        <View style={styles.deltaGroup}>
                          <ChevronUp size={11} color={colors.statusSuccess} />
                          <Text style={[styles.deltaText, { color: colors.statusSuccess }]}>{delta}</Text>
                        </View>
                      ) : delta < 0 ? (
                        <View style={styles.deltaGroup}>
                          <ChevronDown size={11} color={colors.statusDanger} />
                          <Text style={[styles.deltaText, { color: colors.statusDanger }]}>{Math.abs(delta)}</Text>
                        </View>
                      ) : (
                        <Minus size={11} color={palette.sand[400]} />
                      )}
                    </View>
                    <View style={[styles.posAvatar, { backgroundColor: getSolidAvatarColor(roster.indexOf(player)) }]}>
                      <Text style={styles.posAvatarLabel}>{player.name[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={styles.posNameCol}>
                      <Text style={[styles.posName, isLeader && { color: LEADER_GOLD }, isYou && !isLeader && { color: colors.primary }]} numberOfLines={1}>
                        {player.name}
                        {isYou ? ' (you)' : ''}
                      </Text>
                      <Text style={styles.posMeta}>HCP {player.playingHandicap}</Text>
                    </View>
                  </View>
                  <Text style={styles.holeCell}>{row.finished ? 'F' : row.thru}</Text>
                  <Text style={styles.statCell}>{row.gross}</Text>
                  <Text style={styles.statCell}>{row.nett}</Text>
                  <Text style={[styles.totalCell, { color: colors.primary }]}>{row.thru > 0 ? row.points : '–'}</Text>
                </View>
              );
            })}
          </View>

          {/* PLAYS TO HANDICAP */}
          <View style={styles.playsToHcpCard}>
            <View style={styles.playsToHcpIcon}>
              <Trophy size={17} color={colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.playsToHcpTitle}>36 pts plays to handicap</Text>
              <Text style={styles.playsToHcpBody}>
                {stablefordBeatMarkNames.length > 0
                  ? `${joinNames(stablefordBeatMarkNames)} ${stablefordBeatMarkNames.length === 1 ? 'beats' : 'both beat'} their mark today.`
                  : stablefordAllFinished
                    ? 'No one beat their handicap mark today.'
                    : '2 points a hole across 18 holes plays exactly to handicap.'}
              </Text>
            </View>
          </View>

          {/* BEST GROSS */}
          {stablefordBestGrossRow ? (
            <Card variant="inverse" watermark watermarkSize={110} padding={spacing[3] + 1} style={styles.grossStrip}>
              <View style={styles.grossIconTile}>
                <Award size={19} color={colors.accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.grossOverline}>Best gross</Text>
                <Text style={styles.grossLine}>
                  {roster.find((p) => p.id === stablefordBestGrossRow.playerId)?.name} · {stablefordBestGrossRow.gross} (
                  {toParLabel(stablefordBestGrossRow.gross - parTotal(stablefordBestGrossRow.thru, holes, playOrder))})
                </Text>
              </View>
            </Card>
          ) : null}

          {/* SKINS RESULTS */}
          {skinsConfig && skinsRows.length > 0 ? (
            <View>
              <View style={styles.skinsHeaderRow}>
                <View style={styles.skinsHeaderLeft}>
                  <Coins size={15} color={colors.scoreBirdie} />
                  <Text style={styles.skinsHeaderLabel}>Side game · Skins</Text>
                </View>
                <Text style={styles.skinsHeaderMeta}>${skinsConfig.stakePerHole}/hole · separate</Text>
              </View>
              <View style={styles.skinsCard}>
                {skinsRows.map((playerId, index) => {
                  const player = roster.find((p) => p.id === playerId);
                  const result = skinsStandings[playerId];
                  if (!player || !result) return null;
                  const won = result.netDollars >= 0;
                  const expanded = expandedSkinsPlayerId === playerId;
                  const skinsWonLabel = Number.isInteger(result.skinsWon) ? result.skinsWon : result.skinsWon.toFixed(1);
                  return (
                    <View key={playerId} style={styles.skinsRowWrap}>
                      <Pressable style={styles.skinsRow} onPress={() => setExpandedSkinsPlayerId(expanded ? null : playerId)}>
                        <Text style={styles.skinsRank}>{index + 1}</Text>
                        <View style={[styles.skinsAvatar, { backgroundColor: getSolidAvatarColor(roster.indexOf(player)) }]}>
                          <Text style={styles.posAvatarLabel}>{player.name[0]?.toUpperCase()}</Text>
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
                <View style={styles.skinsFooter}>
                  <HandCoins size={13} color="#9A5A1E" />
                  <Text style={styles.skinsFooterText}>Tap a player for the hole-by-hole breakdown</Text>
                </View>
              </View>
            </View>
          ) : null}
        </ScrollView>
        ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.captionRow}>
            <CircleDot size={11} color={colors.statusSuccess} />
            <Text style={styles.captionText}>
              {allFinished ? 'Final' : 'Live'} · {holes.length} holes · nett {round.handicapAllowancePct}%
            </Text>
          </View>

          {/* STANDINGS TABLE */}
          <View style={styles.tableCard}>
            <View style={styles.tableHeaderRow}>
              <View style={styles.posHeaderCell}>
                <Text style={[styles.tableHeaderLabel, { width: 40 }]}>Pos</Text>
                <Text style={styles.tableHeaderLabel}>Player</Text>
              </View>
              <Text style={[styles.tableHeaderLabel, styles.holeHeaderCell]}>Hole</Text>
              <Text style={[styles.tableHeaderLabel, styles.statHeaderCell]}>Gross</Text>
              <Text style={[styles.tableHeaderLabel, styles.statHeaderCell]}>Nett</Text>
              <Text style={[styles.tableHeaderLabel, styles.statHeaderCell, styles.totalHeaderCell]}>Total</Text>
            </View>
            {standings.map((row) => {
              const player = roster.find((p) => p.id === row.playerId);
              if (!player) return null;
              const isYou = row.playerId === viewerId;
              const isLeader = row.rank === 1;
              const prevRank = prevRankByPlayer[row.playerId] ?? row.rank;
              const delta = row.thru > 0 ? prevRank - row.rank : 0;
              const rowBg = isLeader ? LEADER_GOLD_BG : isYou ? colors.surfaceBrandSoft : colors.surfaceCard;
              return (
                <View key={row.playerId} style={[styles.tableRow, { backgroundColor: rowBg }]}>
                  <View style={[styles.posCell, { backgroundColor: rowBg }]}>
                    <View style={styles.posRankCol}>
                      <Text style={[styles.posRankText, isLeader && { color: LEADER_GOLD }, isYou && !isLeader && { color: colors.primary }]}>
                        {row.rank}
                      </Text>
                      {isLeader ? (
                        <Crown size={14} color={LEADER_GOLD} />
                      ) : delta > 0 ? (
                        <View style={styles.deltaGroup}>
                          <ChevronUp size={11} color={colors.statusSuccess} />
                          <Text style={[styles.deltaText, { color: colors.statusSuccess }]}>{delta}</Text>
                        </View>
                      ) : delta < 0 ? (
                        <View style={styles.deltaGroup}>
                          <ChevronDown size={11} color={colors.statusDanger} />
                          <Text style={[styles.deltaText, { color: colors.statusDanger }]}>{Math.abs(delta)}</Text>
                        </View>
                      ) : (
                        <Minus size={11} color={palette.sand[400]} />
                      )}
                    </View>
                    <View style={[styles.posAvatar, { backgroundColor: getSolidAvatarColor(roster.indexOf(player)) }]}>
                      <Text style={styles.posAvatarLabel}>{player.name[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={styles.posNameCol}>
                      <Text style={[styles.posName, isLeader && { color: LEADER_GOLD }, isYou && !isLeader && { color: colors.primary }]} numberOfLines={1}>
                        {player.name}
                        {isYou ? ' (you)' : ''}
                      </Text>
                      <Text style={styles.posMeta}>HCP {player.playingHandicap}</Text>
                    </View>
                  </View>
                  <Text style={styles.holeCell}>{row.finished ? 'F' : row.thru}</Text>
                  <Text style={styles.statCell}>{row.gross}</Text>
                  <Text style={styles.statCell}>{row.nett}</Text>
                  <Text
                    style={[
                      styles.totalCell,
                      { color: row.toPar < 0 ? colors.statusSuccess : row.toPar > 0 ? colors.textSecondary : colors.textSecondary },
                    ]}
                  >
                    {row.thru > 0 ? toParLabel(row.toPar) : '–'}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* BEST GROSS */}
          {bestGrossRow ? (
            <Card variant="inverse" watermark watermarkSize={110} padding={spacing[3] + 1} style={styles.grossStrip}>
              <View style={styles.grossIconTile}>
                <Award size={19} color={colors.accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.grossOverline}>Best gross</Text>
                <Text style={styles.grossLine}>
                  {roster.find((p) => p.id === bestGrossRow.playerId)?.name} · {bestGrossRow.gross} (
                  {toParLabel(bestGrossRow.gross - parTotal(bestGrossRow.thru, holes, playOrder))})
                </Text>
              </View>
            </Card>
          ) : null}

          {/* SKINS RESULTS */}
          {skinsConfig && skinsRows.length > 0 ? (
            <View>
              <View style={styles.skinsHeaderRow}>
                <View style={styles.skinsHeaderLeft}>
                  <Coins size={15} color={colors.scoreBirdie} />
                  <Text style={styles.skinsHeaderLabel}>Side game · Skins</Text>
                </View>
                <Text style={styles.skinsHeaderMeta}>${skinsConfig.stakePerHole}/hole · separate</Text>
              </View>
              <View style={styles.skinsCard}>
                {skinsRows.map((playerId, index) => {
                  const player = roster.find((p) => p.id === playerId);
                  const result = skinsStandings[playerId];
                  if (!player || !result) return null;
                  const won = result.netDollars >= 0;
                  const expanded = expandedSkinsPlayerId === playerId;
                  const skinsWonLabel = Number.isInteger(result.skinsWon) ? result.skinsWon : result.skinsWon.toFixed(1);
                  return (
                    <View key={playerId} style={styles.skinsRowWrap}>
                      <Pressable style={styles.skinsRow} onPress={() => setExpandedSkinsPlayerId(expanded ? null : playerId)}>
                        <Text style={styles.skinsRank}>{index + 1}</Text>
                        <View style={[styles.skinsAvatar, { backgroundColor: getSolidAvatarColor(roster.indexOf(player)) }]}>
                          <Text style={styles.posAvatarLabel}>{player.name[0]?.toUpperCase()}</Text>
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
                <View style={styles.skinsFooter}>
                  <HandCoins size={13} color="#9A5A1E" />
                  <Text style={styles.skinsFooterText}>Tap a player for the hole-by-hole breakdown</Text>
                </View>
              </View>
            </View>
          ) : null}
        </ScrollView>
        )}

        <InRoundTabBar active={s36Locked ? 'scorecard' : 'leaderboard'} onNavigate={handleTabNavigate} leaderboardLocked={s36Locked} />
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
    fontSize: 18,
    color: palette.white,
  },
  headerSubtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.pill,
    paddingVertical: spacing[1] + 2,
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
  lockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.pill,
    paddingVertical: spacing[1] + 2,
    paddingHorizontal: spacing[2] + 2,
    flexShrink: 0,
  },
  lockedPillLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    color: 'rgba(255,255,255,0.72)',
  },
  // ---- SY9 locked state ----
  lockedFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    paddingHorizontal: spacing[6],
  },
  lockedPlate: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1.5,
    borderColor: palette.green[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedPlateBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedHeadline: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 21,
    color: colors.primary,
    marginTop: spacing[5],
    textAlign: 'center',
  },
  lockedBody: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12.5,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: spacing[2] + 1,
    textAlign: 'center',
    maxWidth: 266,
  },
  lockedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 3,
    height: 46,
    paddingHorizontal: spacing[5] + 2,
    marginTop: spacing[6],
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  lockedButtonLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 13.5,
    color: palette.white,
  },
  // ---- SY9b final table columns ----
  s36PosHeader: {
    width: 160,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2] + 1,
    paddingLeft: spacing[2] + 2,
  },
  s36PosCell: {
    width: 160,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2] + 1,
    paddingLeft: spacing[2] + 2,
  },
  s36RankCol: {
    width: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  s36ColGross: { width: 40, textAlign: 'center' },
  s36ColS36: { width: 34, textAlign: 'center' },
  s36ColHcp: { width: 38, textAlign: 'center' },
  s36ColStbf: { width: 50, textAlign: 'center', paddingRight: spacing[2] },
  s36StbfHeader: {
    color: palette.orange[300],
  },
  s36StatCell: {
    fontFamily: getFontFamily('numeric', '400'),
    fontSize: 12,
    color: colors.textPrimary,
  },
  s36StbfCell: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 16,
    color: colors.primary,
  },
  s36StbfCellMuted: {
    color: colors.textSecondary,
  },
  s36Explainer: {
    paddingHorizontal: spacing[1],
  },
  s36ExplainerText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },
  // ---- SB9 "plays to handicap" callout ----
  playsToHcpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.lg - 2,
    padding: spacing[3] + 1,
  },
  playsToHcpIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md - 1,
    backgroundColor: colors.surfaceBrandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  playsToHcpTitle: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: colors.textPrimary,
  },
  playsToHcpBody: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
    lineHeight: 16,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: screenGutter, paddingTop: spacing[4], paddingBottom: spacing[5], gap: spacing[4] },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
    marginTop: -spacing[2],
  },
  captionText: {
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
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  posHeaderCell: {
    flex: 1,
    minWidth: POS_COL_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2] + 1,
    paddingLeft: spacing[2] + 2,
  },
  tableHeaderLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 9,
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.72)',
    textTransform: 'uppercase',
  },
  holeHeaderCell: {
    width: HOLE_COL_WIDTH,
    textAlign: 'center',
  },
  statHeaderCell: {
    width: STAT_COL_WIDTH,
    textAlign: 'center',
  },
  totalHeaderCell: {
    color: palette.orange[300],
    paddingRight: spacing[2],
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  posCell: {
    flex: 1,
    minWidth: POS_COL_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2] + 1,
    paddingLeft: spacing[2] + 2,
  },
  posRankCol: {
    width: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  posRankText: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.textSecondary,
    width: 16,
    textAlign: 'center',
  },
  deltaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deltaText: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 9,
  },
  posAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  posAvatarLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 13,
    color: palette.white,
  },
  posNameCol: { flex: 1, minWidth: 0 },
  posName: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 13,
    color: colors.textPrimary,
  },
  posMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    color: colors.textDisabled,
  },
  holeCell: {
    width: HOLE_COL_WIDTH,
    textAlign: 'center',
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: colors.textDisabled,
  },
  statCell: {
    width: STAT_COL_WIDTH,
    textAlign: 'center',
    fontFamily: getFontFamily('numeric', '400'),
    fontSize: 12,
    color: colors.textPrimary,
  },
  totalCell: {
    width: STAT_COL_WIDTH,
    textAlign: 'center',
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 15,
    paddingRight: spacing[2],
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
  grossOverline: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
  },
  grossLine: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: palette.white,
    marginTop: 1,
  },
  skinsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2] + 1,
  },
  skinsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
  },
  skinsHeaderLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.7,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  skinsHeaderMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
  },
  skinsCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: '#F4C79B',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  skinsRowWrap: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3EEE3',
  },
  skinsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
    paddingVertical: spacing[2] + 2,
    paddingHorizontal: spacing[3],
  },
  chevronExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  skinsRank: {
    width: 16,
    textAlign: 'center',
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 13,
    color: colors.textSecondary,
  },
  skinsAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    fontSize: 13,
    flexShrink: 0,
    minWidth: 34,
    textAlign: 'right',
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
  skinsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1] + 2,
    paddingVertical: spacing[2] + 1,
    backgroundColor: '#FDFAF4',
  },
  skinsFooterText: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    color: '#9A5A1E',
  },
});
