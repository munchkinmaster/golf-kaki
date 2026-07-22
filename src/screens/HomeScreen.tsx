import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronRight, Flag, Plus, Trophy, Users } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Avatar } from '../components/Avatar';
import { BottomNav } from '../components/BottomNav';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { HandicapBadge } from '../components/HandicapBadge';
import { NotificationBell } from '../components/NotificationBell';
import { BadgeAttestationCard, FriendRequestCard, GameInviteCard } from '../components/NotificationCards';
import type { AttestableBadge } from '../data/attestations';
import { attestBadge, fetchAttestableBadges } from '../data/attestations';
import type { FriendRequest } from '../data/kaki';
import { acceptFriendRequest, fetchKakiOverview, removeKakiRelationship } from '../data/kaki';
import type { MatchInvite } from '../data/matches';
import { acceptMatchInvite, declineMatchInvite, fetchMatchInvites } from '../data/matches';
import { getInitials } from '../data/profile';
import type { RoundSummary } from '../data/rounds';
import { fetchRoundSummaries } from '../data/rounds';
import type { RootStackParamList } from '../navigation/types';
import { useProfile } from '../state/ProfileContext';
import { colors, getFontFamily, getPlayerColors, palette, radius, screenGutter, shadows, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

function pastGameSubtitle(round: RoundSummary): string {
  const parts = [round.courseName, round.finishedAt ? new Date(round.finishedAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }) : null];
  return parts.filter(Boolean).join(' · ');
}

export function HomeScreen({ navigation }: Props) {
  const { profile, error, refresh } = useProfile();
  const [matchInvites, setMatchInvites] = useState<MatchInvite[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [attestableBadges, setAttestableBadges] = useState<AttestableBadge[]>([]);
  const [liveRounds, setLiveRounds] = useState<RoundSummary[]>([]);
  const [pastRounds, setPastRounds] = useState<RoundSummary[]>([]);

  const notificationCount = matchInvites.length + friendRequests.length + attestableBadges.length;

  const loadNotifications = useCallback(async (viewerId: string) => {
    const [invites, overview, attestable] = await Promise.all([fetchMatchInvites(viewerId), fetchKakiOverview(viewerId), fetchAttestableBadges(viewerId)]);
    setMatchInvites(invites);
    setFriendRequests(overview.requests);
    setAttestableBadges(attestable);
  }, []);

  const loadRounds = useCallback(async (viewerId: string) => {
    const [live, past] = await Promise.all([fetchRoundSummaries(viewerId, 'live'), fetchRoundSummaries(viewerId, 'finished')]);
    setLiveRounds(live);
    setPastRounds(past.slice(0, 3));
  }, []);

  // Refetch on focus, not just mount — an invite/request/attestation can land
  // while the viewer is on another screen entirely (no realtime push yet, see
  // NotificationsScreen), and the viewer just as often lands back on Home
  // right after starting or finishing a round.
  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      // Notifications are supplementary — a failed fetch just means none show, not a blocking error.
      loadNotifications(profile.id).catch(() => {});
      loadRounds(profile.id).catch(() => {});
    }, [profile, loadNotifications, loadRounds]),
  );

  async function handleAcceptInvite(invite: MatchInvite) {
    setMatchInvites((prev) => prev.filter((i) => i.matchId !== invite.matchId));
    try {
      await acceptMatchInvite(invite.matchId, profile!.id);
      if (invite.status === 'live') {
        navigation.navigate('Scorecard', {
          matchId: invite.matchId,
          matchName: invite.matchName,
          courseName: invite.courseName,
          gameModeName: invite.gameModeName,
          isHost: false,
        });
      } else {
        navigation.navigate('MatchLobby', {
          matchId: invite.matchId,
          matchCode: invite.matchCode,
          matchName: invite.matchName,
          courseName: invite.courseName,
          summaryLine: invite.summaryLine,
          gameModeName: invite.gameModeName,
          holesToPlay: invite.holesToPlay,
        });
      }
    } catch {
      // Accept failed server-side — put the card back so they can retry.
      setMatchInvites((prev) => [...prev, invite]);
    }
  }

  async function handleDeclineInvite(invite: MatchInvite) {
    setMatchInvites((prev) => prev.filter((i) => i.matchId !== invite.matchId));
    declineMatchInvite(invite.matchId, profile!.id).catch(() => setMatchInvites((prev) => [...prev, invite]));
  }

  async function handleAcceptFriendRequest(request: FriendRequest) {
    setFriendRequests((prev) => prev.filter((r) => r.relationshipId !== request.relationshipId));
    acceptFriendRequest(request.relationshipId).catch(() => setFriendRequests((prev) => [...prev, request]));
  }

  async function handleIgnoreFriendRequest(request: FriendRequest) {
    setFriendRequests((prev) => prev.filter((r) => r.relationshipId !== request.relationshipId));
    removeKakiRelationship(request.relationshipId).catch(() => setFriendRequests((prev) => [...prev, request]));
  }

  async function handleAttestBadge(badge: AttestableBadge) {
    setAttestableBadges((prev) => prev.filter((b) => !(b.playerId === badge.playerId && b.badgeType === badge.badgeType)));
    attestBadge(badge.playerId, badge.badgeType, profile!.id).catch(() => setAttestableBadges((prev) => [...prev, badge]));
  }

  if (!profile) {
    if (error) {
      return (
        <View style={[styles.page, styles.loadErrorWrap]}>
          <Text style={styles.loadErrorText}>Couldn't load your profile.</Text>
          <Button label="Try again" variant="secondary" onPress={refresh} />
        </View>
      );
    }
    return <View style={styles.page} />;
  }

  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.greeting}>
            <Avatar initials={getInitials(profile.displayName)} size={44} bordered />
            <View>
              <Text style={styles.greetingLabel}>{getGreeting()},</Text>
              <Text style={styles.greetingName}>{profile.displayName}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <NotificationBell count={notificationCount} onPress={() => navigation.navigate('Notifications')} />
            <HandicapBadge value={profile.handicap} />
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.ctaGroup}>
            <Button
              label="Create a game"
              variant="accent"
              size="lg"
              block
              icon={<Plus size={20} color={colors.textOnAccent} />}
              onPress={() => navigation.navigate('SelectCourse')}
            />
            <Button
              label="Join a game"
              variant="secondary"
              size="lg"
              block
              icon={<Users size={20} color={colors.textInverse} />}
              onPress={() => navigation.navigate('JoinGame')}
            />
          </View>

          {notificationCount > 0 ? (
            <View style={styles.notificationsSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>Notifications</Text>
                <View style={styles.notificationCountBadge}>
                  <Text style={styles.notificationCountLabel}>{notificationCount}</Text>
                </View>
              </View>

              {matchInvites.map((invite, index) => (
                <GameInviteCard
                  key={invite.matchId}
                  invite={invite}
                  colorIndex={index}
                  onDecline={() => handleDeclineInvite(invite)}
                  onAccept={() => handleAcceptInvite(invite)}
                />
              ))}
              {friendRequests.map((request, index) => (
                <FriendRequestCard
                  key={request.relationshipId}
                  request={request}
                  colorIndex={index}
                  onIgnore={() => handleIgnoreFriendRequest(request)}
                  onAccept={() => handleAcceptFriendRequest(request)}
                />
              ))}
              {attestableBadges.map((badge, index) => (
                <BadgeAttestationCard
                  key={`${badge.playerId}:${badge.badgeType}`}
                  badge={badge}
                  colorIndex={index}
                  onConfirm={() => handleAttestBadge(badge)}
                />
              ))}
            </View>
          ) : null}

          {liveRounds[0] ? (
            <>
              <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>In play</Text>
              <HomeLiveRoundCard
                round={liveRounds[0]}
                isHost={profile?.id === liveRounds[0]!.hostId}
                onResume={() =>
                  navigation.navigate('Scorecard', {
                    matchId: liveRounds[0]!.matchId,
                    matchName: liveRounds[0]!.matchName,
                    courseName: liveRounds[0]!.courseName,
                    gameModeName: liveRounds[0]!.gameModeName,
                    isHost: false,
                  })
                }
                onFinish={() =>
                  navigation.navigate('Finish', {
                    matchId: liveRounds[0]!.matchId,
                    matchName: liveRounds[0]!.matchName,
                    courseName: liveRounds[0]!.courseName,
                    gameModeName: liveRounds[0]!.gameModeName,
                  })
                }
              />
            </>
          ) : null}

          {pastRounds.length > 0 ? (
            <>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>Past games</Text>
                <Pressable onPress={() => navigation.navigate('Rounds', { initialTab: 'past' })}>
                  <Text style={styles.seeAll}>See all</Text>
                </Pressable>
              </View>
              <View style={styles.pastGameList}>
                {pastRounds.map((round) => (
                  <Pressable
                    key={round.matchId}
                    onPress={() =>
                      navigation.navigate('Recap', {
                        matchId: round.matchId,
                        matchName: round.matchName,
                        courseName: round.courseName,
                        gameModeName: round.gameModeName,
                      })
                    }
                  >
                    <Card style={styles.pastGameRow}>
                      <View style={styles.pastGameIcon}>
                        {(round.viewerMoney ?? 0) > 0 ? (
                          <Trophy size={18} color={colors.scoreEagle} />
                        ) : (
                          <Flag size={18} color={colors.scorePar} />
                        )}
                      </View>
                      <View style={styles.pastGameInfo}>
                        <Text style={styles.pastGameTitle}>{round.matchName}</Text>
                        <Text style={styles.pastGameSubtitle}>{pastGameSubtitle(round)}</Text>
                      </View>
                      <View style={styles.pastGameScoreWrap}>
                        <Text style={styles.pastGameScore}>{round.viewerGross ?? '–'}</Text>
                        <Text style={styles.pastGameScoreLabel}>gross</Text>
                      </View>
                      <ChevronRight size={17} color={palette.sand[400]} />
                    </Card>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>

        <BottomNav
          active="home"
          onNavigate={(tab) => {
            if (tab === 'profile') navigation.navigate('Profile');
            if (tab === 'kaki') navigation.navigate('Kaki');
            if (tab === 'rounds') navigation.navigate('Rounds');
          }}
          onStart={() => navigation.navigate('SelectCourse')}
        />
      </SafeAreaView>
    </View>
  );
}

// Static, not pulsing — temporary experiment to check whether iOS Safari's
// tap unresponsiveness is caused by continuous JS-driven Animated loops
// (useNativeDriver doesn't offload to a native thread on web the way it does
// in the native app). Revert to the pulsing version if this doesn't help.
function LiveBadge() {
  return (
    <View style={styles.liveBadge}>
      <View style={styles.liveDot} />
      <Text style={styles.liveLabel}>Live</Text>
    </View>
  );
}

function HomeLiveRoundCard({
  round,
  isHost,
  onResume,
  onFinish,
}: {
  round: RoundSummary;
  isHost: boolean;
  onResume: () => void;
  onFinish: () => void;
}) {
  const up = round.viewerUp ?? 0;
  const scoreValue = round.viewerUp === null ? '–' : String(Math.abs(up));
  const scoreLabel = round.viewerUp === null ? '' : up > 0 ? 'up' : up < 0 ? 'down' : 'square';
  const sub = [round.courseName, round.comboLabel, `Thru ${round.thru}`].filter(Boolean).join(' · ');
  // Every hole scored but the host hasn't tapped Finish yet — nothing ends
  // the round automatically, so nudge whoever can act (see FinishScreen's
  // finishRound, which only the host may call).
  const fullyScored = round.thru >= round.holesToPlay;

  return (
    <Card variant="inverse" watermark style={styles.liveCard}>
      <View style={styles.liveCardTop}>
        <View>
          <LiveBadge />
          <Text style={styles.liveTitle}>{round.matchName}</Text>
          <Text style={styles.liveSubtitle}>{sub}</Text>
        </View>
        <View style={styles.liveScore}>
          <Text style={styles.liveScoreValue}>{scoreValue}</Text>
          <Text style={styles.liveScoreLabel}>{scoreLabel}</Text>
        </View>
      </View>
      {fullyScored ? (
        <View style={styles.liveNudgeRow}>
          <Flag size={13} color="rgba(255,255,255,0.7)" />
          <Text style={styles.liveNudgeText}>{isHost ? 'Fully scored — finish to save it' : 'Fully scored — waiting for host to finish'}</Text>
        </View>
      ) : null}
      <View style={styles.liveCardBottom}>
        <View style={styles.avatarStack}>
          {round.players.slice(0, 4).map((player, index) => {
            const playerColor = getPlayerColors(index);
            return (
              <Avatar
                key={player.playerId}
                initials={getInitials(player.name)}
                size={30}
                style={[styles.stackedAvatar, index > 0 && styles.stackedAvatarOverlap, { backgroundColor: playerColor.background }]}
                color={playerColor.color}
              />
            );
          })}
        </View>
        <Button
          label={fullyScored && isHost ? 'Finish round' : 'Resume'}
          variant="accent"
          size="sm"
          icon={<ChevronRight size={16} color={colors.textOnAccent} />}
          iconPosition="right"
          onPress={fullyScored && isHost ? onFinish : onResume}
        />
      </View>
    </Card>
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
  loadErrorWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    paddingHorizontal: screenGutter,
  },
  loadErrorText: {
    fontFamily: getFontFamily('body', '500'),
    fontSize: 14,
    color: colors.textMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenGutter,
    paddingTop: screenGutter,
    paddingBottom: screenGutter,
  },
  greeting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 2,
  },
  greetingLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textMuted,
  },
  greetingName: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 18,
    color: colors.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingBottom: spacing[7],
  },
  ctaGroup: {
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  sectionLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.1,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  sectionLabelSpaced: {
    marginBottom: spacing[2] + 1,
  },
  liveCard: {
    marginBottom: spacing[6],
  },
  liveCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2] - 2,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  liveLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 0.9,
    color: palette.orange[300],
    textTransform: 'uppercase',
  },
  liveTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 20,
    color: palette.white,
  },
  liveSubtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 3,
  },
  liveScore: {
    alignItems: 'flex-end',
  },
  liveScoreValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 30,
    color: palette.green[300],
  },
  liveScoreLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  liveNudgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] - 2,
    marginTop: spacing[3],
  },
  liveNudgeText: {
    fontFamily: getFontFamily('body', '500'),
    fontWeight: '500',
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  liveCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[4],
  },
  avatarStack: {
    flexDirection: 'row',
  },
  stackedAvatar: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  stackedAvatarOverlap: {
    marginLeft: -9,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2] + 1,
  },
  seeAll: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 16,
    color: colors.primary,
  },
  notificationsSection: {
    marginBottom: spacing[3],
  },
  notificationCountBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationCountLabel: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 11,
    color: palette.white,
  },
  pastGameList: {
    gap: spacing[2] + 2,
  },
  pastGameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  pastGameIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.surfaceBrandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastGameInfo: {
    flex: 1,
  },
  pastGameTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.textPrimary,
  },
  pastGameSubtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
  },
  pastGameScoreWrap: {
    alignItems: 'flex-end',
  },
  pastGameScore: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 17,
    color: colors.textPrimary,
  },
  pastGameScoreLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    color: colors.textDisabled,
  },
});
