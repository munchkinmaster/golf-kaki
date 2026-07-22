import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronLeft, ChevronRight, Trophy } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Avatar } from '../components/Avatar';
import { IconButton } from '../components/IconButton';
import { BadgeAttestationCard, FriendRequestCard, GameInviteCard } from '../components/NotificationCards';
import type { AttestableBadge } from '../data/attestations';
import { attestBadge, fetchAttestableBadges } from '../data/attestations';
import type { FriendRequest } from '../data/kaki';
import { acceptFriendRequest, fetchKakiOverview, removeKakiRelationship } from '../data/kaki';
import type { MatchInvite } from '../data/matches';
import { acceptMatchInvite, declineMatchInvite, fetchMatchInvites } from '../data/matches';
import { getInitials } from '../data/profile';
import { moneyLabel } from '../data/round';
import type { EarlierItem } from '../data/notifications';
import { fetchEarlierActivity, formatRelativeTime } from '../data/notifications';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../state/AuthContext';
import { colors, getFontFamily, getPlayerColors, palette, radius, screenGutter, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

export function NotificationsScreen({ navigation }: Props) {
  const { session } = useAuth();
  const viewerId = session?.user.id ?? null;

  const [matchInvites, setMatchInvites] = useState<MatchInvite[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [attestableBadges, setAttestableBadges] = useState<AttestableBadge[]>([]);
  const [earlier, setEarlier] = useState<EarlierItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!viewerId) return;
    const [invites, overview, attestable, earlierActivity] = await Promise.all([
      fetchMatchInvites(viewerId),
      fetchKakiOverview(viewerId),
      fetchAttestableBadges(viewerId),
      fetchEarlierActivity(viewerId),
    ]);
    setMatchInvites(invites);
    setFriendRequests(overview.requests);
    setAttestableBadges(attestable);
    setEarlier(earlierActivity);
  }, [viewerId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [load]),
  );

  async function handleAcceptInvite(invite: MatchInvite) {
    setMatchInvites((prev) => prev.filter((i) => i.matchId !== invite.matchId));
    try {
      await acceptMatchInvite(invite.matchId, viewerId!);
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
      setMatchInvites((prev) => [...prev, invite]);
    }
  }

  function handleDeclineInvite(invite: MatchInvite) {
    setMatchInvites((prev) => prev.filter((i) => i.matchId !== invite.matchId));
    declineMatchInvite(invite.matchId, viewerId!).catch(() => setMatchInvites((prev) => [...prev, invite]));
  }

  function handleAcceptFriendRequest(request: FriendRequest) {
    setFriendRequests((prev) => prev.filter((r) => r.relationshipId !== request.relationshipId));
    acceptFriendRequest(request.relationshipId).catch(() => setFriendRequests((prev) => [...prev, request]));
  }

  function handleIgnoreFriendRequest(request: FriendRequest) {
    setFriendRequests((prev) => prev.filter((r) => r.relationshipId !== request.relationshipId));
    removeKakiRelationship(request.relationshipId).catch(() => setFriendRequests((prev) => [...prev, request]));
  }

  function handleAttestBadge(badge: AttestableBadge) {
    setAttestableBadges((prev) => prev.filter((b) => !(b.playerId === badge.playerId && b.badgeType === badge.badgeType)));
    attestBadge(badge.playerId, badge.badgeType, viewerId!).catch(() => setAttestableBadges((prev) => [...prev, badge]));
  }

  function openEarlierItem(item: EarlierItem) {
    if (item.type === 'result') {
      navigation.navigate('Recap', { matchId: item.matchId, matchName: item.matchName, courseName: item.courseName, gameModeName: item.gameModeName });
    } else {
      navigation.navigate('Kaki');
    }
  }

  const todayCount = matchInvites.length + friendRequests.length + attestableBadges.length;

  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <IconButton icon={ChevronLeft} iconSize={20} onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {loading ? <Text style={styles.stateText}>Loading…</Text> : null}

          {!loading ? (
            <>
              <Text style={styles.sectionLabel}>Today</Text>
              {todayCount === 0 ? (
                <Text style={styles.emptyText}>You're all caught up.</Text>
              ) : (
                <View style={styles.todayList}>
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
              )}

              {earlier.length > 0 ? (
                <>
                  <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Earlier</Text>
                  <View style={styles.earlierList}>
                    {earlier.map((item) => (
                      <EarlierRow key={item.key} item={item} onPress={() => openEarlierItem(item)} />
                    ))}
                  </View>
                </>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function EarlierRow({ item, onPress }: { item: EarlierItem; onPress: () => void }) {
  return (
    <Pressable style={styles.earlierRow} onPress={onPress}>
      {item.type === 'result' ? (
        <View style={styles.earlierIconTile}>
          <Trophy size={18} color={colors.scoreEagle} />
        </View>
      ) : (
        <Avatar initials={getInitials(item.name)} size={38} backgroundColor={getPlayerColors(1).background} color={getPlayerColors(1).color} />
      )}
      <View style={styles.earlierBody}>
        {item.type === 'result' ? (
          <>
            <Text style={styles.earlierLead}>
              <Text style={styles.earlierLeadStrong}>{item.matchName}</Text> results are in
            </Text>
            <Text style={styles.earlierMeta}>
              {item.won ? 'You won' : 'You lost'} · {moneyLabel(item.money)} · {formatRelativeTime(item.at)}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.earlierLead}>
              <Text style={styles.earlierLeadStrong}>{item.name}</Text> is now your kaki
            </Text>
            <Text style={styles.earlierMeta}>{formatRelativeTime(item.at)}</Text>
          </>
        )}
      </View>
      <ChevronRight size={17} color={palette.sand[400]} />
    </Pressable>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenGutter,
    paddingTop: spacing[1] + 2,
    paddingBottom: spacing[3],
  },
  headerTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 16,
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingBottom: spacing[7],
  },
  stateText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: colors.textDisabled,
    textAlign: 'center',
    marginTop: spacing[5],
  },
  sectionLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: spacing[2] + 1,
  },
  sectionLabelSpaced: {
    marginTop: spacing[2],
  },
  emptyText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: colors.textDisabled,
    marginBottom: spacing[4],
  },
  todayList: {
    marginBottom: spacing[2],
  },
  earlierList: {
    gap: spacing[2] + 1,
  },
  earlierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: palette.sand[200],
    borderRadius: radius.lg,
    padding: spacing[3] + 1,
    opacity: 0.82,
  },
  earlierIconTile: {
    width: 38,
    height: 38,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.surfaceBrandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  earlierBody: {
    flex: 1,
    minWidth: 0,
  },
  earlierLead: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: colors.textMuted,
  },
  earlierLeadStrong: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  earlierMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    marginTop: 1,
  },
});
