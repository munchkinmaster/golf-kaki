import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import {
  Check,
  ChevronRight,
  Flag,
  Flame,
  MapPin,
  Plus,
  Repeat,
  Target,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Avatar } from '../components/Avatar';
import { BottomNav } from '../components/BottomNav';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { HandicapBadge } from '../components/HandicapBadge';
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

  useEffect(() => {
    if (!profile) return;
    // Notifications are supplementary — a failed fetch just means none show, not a blocking error.
    loadNotifications(profile.id).catch(() => {});
  }, [profile, loadNotifications]);

  // Refetch on focus, not just mount — the viewer lands back on Home right
  // after starting or finishing a round.
  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      loadRounds(profile.id).catch(() => {});
    }, [profile, loadRounds]),
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
          <HandicapBadge value={profile.handicap} />
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
                onResume={() =>
                  navigation.navigate('Scorecard', {
                    matchId: liveRounds[0]!.matchId,
                    matchName: liveRounds[0]!.matchName,
                    courseName: liveRounds[0]!.courseName,
                    gameModeName: liveRounds[0]!.gameModeName,
                    isHost: false,
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

function LiveBadge() {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.45, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.liveBadge}>
      <Animated.View style={[styles.liveDot, { opacity: pulse }]} />
      <Text style={styles.liveLabel}>Live</Text>
    </View>
  );
}

function HomeLiveRoundCard({ round, onResume }: { round: RoundSummary; onResume: () => void }) {
  const up = round.viewerUp ?? 0;
  const scoreValue = round.viewerUp === null ? '–' : String(Math.abs(up));
  const scoreLabel = round.viewerUp === null ? '' : up > 0 ? 'up' : up < 0 ? 'down' : 'square';
  const sub = [round.courseName, round.comboLabel, `Thru ${round.thru}`].filter(Boolean).join(' · ');

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
          label="Resume"
          variant="accent"
          size="sm"
          icon={<ChevronRight size={16} color={colors.textOnAccent} />}
          iconPosition="right"
          onPress={onResume}
        />
      </View>
    </Card>
  );
}

function GameInviteCard({
  invite,
  colorIndex,
  onDecline,
  onAccept,
}: {
  invite: MatchInvite;
  colorIndex: number;
  onDecline: () => void;
  onAccept: () => void;
}) {
  const playerColor = getPlayerColors(colorIndex);
  const holesPart = invite.summaryLine.split(' · ')[0];

  return (
    <View style={[styles.notifCard, styles.notifCardInvite]}>
      <View style={styles.notifTopRow}>
        <Avatar initials={getInitials(invite.hostName)} size={42} backgroundColor={playerColor.background} color={playerColor.color} />
        <View style={styles.notifBody}>
          <Text style={styles.notifLead}>
            <Text style={styles.notifLeadStrong}>{invite.hostName}</Text> invited you
          </Text>
          <Text style={styles.notifHeadline}>{invite.matchName}</Text>
        </View>
        <View style={[styles.newPill, styles.newPillOrange]}>
          <Text style={[styles.newPillLabel, styles.newPillLabelOrange]}>New</Text>
        </View>
      </View>
      <View style={styles.notifMetaRow}>
        <View style={styles.notifMetaItem}>
          <MapPin size={13} color={colors.textDisabled} />
          <Text style={styles.notifMetaText}>{invite.courseName}</Text>
        </View>
        <View style={styles.notifMetaItem}>
          <Flag size={13} color={colors.textDisabled} />
          <Text style={styles.notifMetaText}>
            {holesPart} · {invite.gameModeName}
          </Text>
        </View>
      </View>
      <View style={styles.notifActions}>
        <Pressable style={styles.notifActionGhost} onPress={onDecline}>
          <X size={16} color={colors.textMuted} />
          <Text style={styles.notifActionGhostLabel}>Decline</Text>
        </Pressable>
        <Pressable style={styles.notifActionAccent} onPress={onAccept}>
          <Check size={16} color={palette.white} />
          <Text style={styles.notifActionAccentLabel}>Accept</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FriendRequestCard({
  request,
  colorIndex,
  onIgnore,
  onAccept,
}: {
  request: FriendRequest;
  colorIndex: number;
  onIgnore: () => void;
  onAccept: () => void;
}) {
  const playerColor = getPlayerColors(colorIndex);

  return (
    <View style={[styles.notifCard, styles.notifCardFriend]}>
      <View style={styles.notifTopRow}>
        <Avatar initials={getInitials(request.name)} size={42} backgroundColor={playerColor.background} color={playerColor.color} />
        <View style={styles.notifBody}>
          <Text style={styles.notifLead}>
            <Text style={styles.notifLeadStrong}>{request.name}</Text> wants to be your kaki
          </Text>
          <View style={styles.notifMetaRow}>
            <View style={styles.notifMetaItem}>
              <Users size={13} color={colors.textDisabled} />
              <Text style={styles.notifMetaText}>{request.handle}</Text>
            </View>
            {request.handicap !== null ? (
              <View style={styles.notifMetaItem}>
                <Target size={13} color={colors.textDisabled} />
                <Text style={styles.notifMetaText}>HCP {request.handicap}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={[styles.newPill, styles.newPillGreen]}>
          <Text style={[styles.newPillLabel, styles.newPillLabelGreen]}>New</Text>
        </View>
      </View>
      <View style={styles.notifActions}>
        <Pressable style={styles.notifActionGhost} onPress={onIgnore}>
          <X size={16} color={colors.textMuted} />
          <Text style={styles.notifActionGhostLabel}>Ignore</Text>
        </Pressable>
        <Pressable style={styles.notifActionPrimary} onPress={onAccept}>
          <UserPlus size={16} color={palette.white} />
          <Text style={styles.notifActionAccentLabel}>Accept</Text>
        </Pressable>
      </View>
    </View>
  );
}

function badgeTypeLabel(badgeType: AttestableBadge['badgeType']): string {
  return badgeType === 'birdie_streak' ? 'birdie streak' : 'par streak';
}

function BadgeAttestationCard({
  badge,
  colorIndex,
  onConfirm,
}: {
  badge: AttestableBadge;
  colorIndex: number;
  onConfirm: () => void;
}) {
  const playerColor = getPlayerColors(colorIndex);
  const Icon = badge.badgeType === 'birdie_streak' ? Flame : Repeat;

  return (
    <View style={[styles.notifCard, styles.notifCardFriend]}>
      <View style={styles.notifTopRow}>
        <Avatar initials={getInitials(badge.playerName)} size={42} backgroundColor={playerColor.background} color={playerColor.color} />
        <View style={styles.notifBody}>
          <Text style={styles.notifLead}>
            <Text style={styles.notifLeadStrong}>{badge.playerName}</Text>'s {badgeTypeLabel(badge.badgeType)}
          </Text>
          <View style={styles.notifMetaRow}>
            <View style={styles.notifMetaItem}>
              <Icon size={13} color={colors.textDisabled} />
              <Text style={styles.notifMetaText}>{badge.streakLength} in a row</Text>
            </View>
          </View>
        </View>
        <View style={[styles.newPill, styles.newPillGreen]}>
          <Text style={[styles.newPillLabel, styles.newPillLabelGreen]}>New</Text>
        </View>
      </View>
      <View style={styles.notifActions}>
        <Pressable style={styles.notifActionPrimary} onPress={onConfirm}>
          <Check size={16} color={palette.white} />
          <Text style={styles.notifActionAccentLabel}>Confirm</Text>
        </Pressable>
      </View>
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
  notifCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing[3] + 2,
    marginBottom: spacing[2] + 2,
    ...shadows.xs,
  },
  notifCardInvite: {
    borderColor: palette.orange[200],
  },
  notifCardFriend: {
    borderColor: palette.green[200],
  },
  notifTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
  },
  notifBody: {
    flex: 1,
    minWidth: 0,
  },
  notifLead: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: colors.textMuted,
  },
  notifLeadStrong: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  notifHeadline: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: 1,
  },
  newPill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: spacing[2] + 1,
    flexShrink: 0,
  },
  newPillLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  newPillOrange: {
    backgroundColor: palette.orange[100],
    borderColor: palette.orange[200],
  },
  newPillLabelOrange: {
    color: palette.orange[700],
  },
  newPillGreen: {
    backgroundColor: colors.surfaceBrandSoft,
    borderColor: palette.green[200],
  },
  newPillLabelGreen: {
    color: colors.statusSuccess,
  },
  notifMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3] + 1,
    marginTop: spacing[2] + 1,
  },
  notifMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
  },
  notifMetaText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
  },
  notifActions: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[3] + 1,
  },
  notifActionGhost: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1] + 3,
  },
  notifActionGhostLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: colors.textMuted,
  },
  notifActionAccent: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1] + 3,
    ...shadows.accent,
  },
  notifActionPrimary: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1] + 3,
  },
  notifActionAccentLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
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
