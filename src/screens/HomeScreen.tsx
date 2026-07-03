import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Eye,
  Flag,
  MapPin,
  Plus,
  Target,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Avatar } from '../components/Avatar';
import { BottomNav } from '../components/BottomNav';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { HandicapBadge } from '../components/HandicapBadge';
import { getInitials } from '../data/profile';
import type { RootStackParamList } from '../navigation/types';
import { useProfile } from '../state/ProfileContext';
import { colors, getFontFamily, palette, radius, screenGutter, shadows, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

// Same identity as the "in play" live card below — accepting the invite joins that match.
const INVITE_MATCH = { matchName: 'Sat Fourball', courseName: 'Sentosa Golf Club', gameModeName: 'Kaki Match Play' };

type PastGame = {
  title: string;
  subtitle: string;
  score: number;
  icon: 'trophy' | 'flag';
  /** Canonical course name, for opening the Recap. */
  course: string;
};

const PAST_GAMES: PastGame[] = [
  { title: 'Friday Skins', subtitle: 'Tanah Merah · 14 Jun · Won', score: 88, icon: 'trophy', course: 'Tanah Merah Country Club' },
  { title: 'Sunday Medal', subtitle: 'Laguna · 8 Jun · 2nd', score: 95, icon: 'flag', course: 'Laguna National G&CC' },
  { title: 'Kaki Cup R2', subtitle: 'Sentosa · 1 Jun · Won', score: 82, icon: 'flag', course: 'Sentosa Golf Club' },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

export function HomeScreen({ navigation }: Props) {
  const { profile } = useProfile();
  const [showInvite, setShowInvite] = useState(true);
  const [showFriendRequest, setShowFriendRequest] = useState(true);
  const [showConfirmScore, setShowConfirmScore] = useState(true);

  const notificationCount = [showInvite, showFriendRequest, showConfirmScore].filter(Boolean).length;

  function acceptInvite() {
    setShowInvite(false);
    navigation.navigate('InGameLobby', INVITE_MATCH);
  }

  function viewConfirmCard() {
    navigation.navigate('Scorecard', { ...INVITE_MATCH, isHost: true });
  }

  if (!profile) {
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

              {showInvite ? (
                <GameInviteCard onDecline={() => setShowInvite(false)} onAccept={acceptInvite} />
              ) : null}
              {showFriendRequest ? (
                <FriendRequestCard onIgnore={() => setShowFriendRequest(false)} onAccept={() => setShowFriendRequest(false)} />
              ) : null}
              {showConfirmScore ? (
                <ConfirmScoreCard onViewCard={viewConfirmCard} onConfirm={() => setShowConfirmScore(false)} />
              ) : null}
            </View>
          ) : null}

          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>In play</Text>
          <Card variant="inverse" watermark style={styles.liveCard}>
            <View style={styles.liveCardTop}>
              <View>
                <LiveBadge />
                <Text style={styles.liveTitle}>Sat Fourball</Text>
                <Text style={styles.liveSubtitle}>Sentosa · Serapong · Thru 4</Text>
              </View>
              <View style={styles.liveScore}>
                <Text style={styles.liveScoreValue}>4</Text>
                <Text style={styles.liveScoreLabel}>up</Text>
              </View>
            </View>
            <View style={styles.liveCardBottom}>
              <View style={styles.avatarStack}>
                <Avatar initials="M" size={30} style={[styles.stackedAvatar, { backgroundColor: palette.green[100] }]} />
                <Avatar
                  initials="W"
                  size={30}
                  style={[styles.stackedAvatar, styles.stackedAvatarOverlap, { backgroundColor: palette.orange[200] }]}
                  color={palette.orange[700]}
                />
                <Avatar
                  initials="D"
                  size={30}
                  style={[styles.stackedAvatar, styles.stackedAvatarOverlap, { backgroundColor: palette.sand[200] }]}
                  color={palette.ink[500]}
                />
              </View>
              <Button
                label="Resume"
                variant="accent"
                size="sm"
                icon={<ChevronRight size={16} color={colors.textOnAccent} />}
                iconPosition="right"
                onPress={() =>
                  navigation.navigate('Scorecard', {
                    matchName: 'Sat Fourball',
                    courseName: 'Sentosa Golf Club',
                    gameModeName: 'Kaki Match Play',
                    isHost: true,
                  })
                }
              />
            </View>
          </Card>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>Past games</Text>
            <Pressable onPress={() => navigation.navigate('Rounds', { initialTab: 'past' })}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          <View style={styles.pastGameList}>
            {PAST_GAMES.map((game) => (
              <Pressable
                key={game.title}
                onPress={() =>
                  navigation.navigate('Recap', {
                    matchName: game.title,
                    courseName: game.course,
                    gameModeName: 'Kaki Match Play',
                  })
                }
              >
                <Card style={styles.pastGameRow}>
                  <View style={styles.pastGameIcon}>
                    {game.icon === 'trophy' ? (
                      <Trophy size={18} color={colors.scoreEagle} />
                    ) : (
                      <Flag size={18} color={colors.scorePar} />
                    )}
                  </View>
                  <View style={styles.pastGameInfo}>
                    <Text style={styles.pastGameTitle}>{game.title}</Text>
                    <Text style={styles.pastGameSubtitle}>{game.subtitle}</Text>
                  </View>
                  <View style={styles.pastGameScoreWrap}>
                    <Text style={styles.pastGameScore}>{game.score}</Text>
                    <Text style={styles.pastGameScoreLabel}>gross</Text>
                  </View>
                  <ChevronRight size={17} color={palette.sand[400]} />
                </Card>
              </Pressable>
            ))}
          </View>
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

function GameInviteCard({ onDecline, onAccept }: { onDecline: () => void; onAccept: () => void }) {
  return (
    <View style={[styles.notifCard, styles.notifCardInvite]}>
      <View style={styles.notifTopRow}>
        <Avatar initials="M" size={42} backgroundColor={palette.green[100]} color={colors.primary} />
        <View style={styles.notifBody}>
          <Text style={styles.notifLead}>
            <Text style={styles.notifLeadStrong}>Marcus</Text> invited you
          </Text>
          <Text style={styles.notifHeadline}>Sat Fourball</Text>
        </View>
        <View style={[styles.newPill, styles.newPillOrange]}>
          <Text style={[styles.newPillLabel, styles.newPillLabelOrange]}>New</Text>
        </View>
      </View>
      <View style={styles.notifMetaRow}>
        <View style={styles.notifMetaItem}>
          <MapPin size={13} color={colors.textDisabled} />
          <Text style={styles.notifMetaText}>Sentosa · Serapong</Text>
        </View>
        <View style={styles.notifMetaItem}>
          <Calendar size={13} color={colors.textDisabled} />
          <Text style={styles.notifMetaText}>Sat 5 Jul · 7:10 AM</Text>
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

function FriendRequestCard({ onIgnore, onAccept }: { onIgnore: () => void; onAccept: () => void }) {
  return (
    <View style={[styles.notifCard, styles.notifCardFriend]}>
      <View style={styles.notifTopRow}>
        <Avatar initials="A" size={42} backgroundColor="#DDEAF3" color="#3E6480" />
        <View style={styles.notifBody}>
          <Text style={styles.notifLead}>
            <Text style={styles.notifLeadStrong}>Aiken Lim</Text> wants to be your kaki
          </Text>
          <View style={styles.notifMetaRow}>
            <View style={styles.notifMetaItem}>
              <Users size={13} color={colors.textDisabled} />
              <Text style={styles.notifMetaText}>2 mutual kaki</Text>
            </View>
            <View style={styles.notifMetaItem}>
              <Target size={13} color={colors.textDisabled} />
              <Text style={styles.notifMetaText}>HCP 12</Text>
            </View>
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

function ConfirmScoreCard({ onViewCard, onConfirm }: { onViewCard: () => void; onConfirm: () => void }) {
  return (
    <View style={[styles.notifCard, styles.notifCardConfirm]}>
      <View style={styles.notifTopRow}>
        <View style={styles.notifIconChip}>
          <ClipboardCheck size={21} color={colors.scoreEagle} />
        </View>
        <View style={styles.notifBody}>
          <Text style={styles.notifHeadline}>Confirm your score</Text>
          <Text style={styles.notifSubtext}>Sat Fourball · your card is waiting</Text>
        </View>
        <View style={[styles.newPill, styles.newPillAmber]}>
          <Text style={[styles.newPillLabel, styles.newPillLabelAmber]}>Action</Text>
        </View>
      </View>
      <View style={styles.notifMetaRow}>
        <View style={styles.notifMetaItem}>
          <Bell size={13} color={colors.textDisabled} />
          <Text style={styles.notifMetaText}>Reminded by Marcus</Text>
        </View>
        <View style={styles.notifMetaItem}>
          <Check size={13} color={colors.textDisabled} />
          <Text style={styles.notifMetaText}>3 of 4 confirmed</Text>
        </View>
      </View>
      <View style={styles.notifActions}>
        <Pressable style={styles.notifActionGhost} onPress={onViewCard}>
          <Eye size={16} color={colors.textMuted} />
          <Text style={styles.notifActionGhostLabel}>View card</Text>
        </Pressable>
        <Pressable style={styles.notifActionPrimary} onPress={onConfirm}>
          <CheckCircle2 size={16} color={palette.white} />
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
  notifCardConfirm: {
    borderColor: '#F0E0B0',
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
  notifSubtext: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    marginTop: 1,
  },
  notifIconChip: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: '#FBEFD0',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
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
  newPillAmber: {
    backgroundColor: '#FBEFD0',
    borderColor: '#E5CE8E',
  },
  newPillLabelAmber: {
    color: '#9A6B12',
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
