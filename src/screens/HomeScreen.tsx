import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronRight, Flag, Home as HomeIcon, Plus, Trophy, User, Users } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { HandicapBadge } from '../components/HandicapBadge';
import { TabBar } from '../components/TabBar';
import type { TabBarItem } from '../components/TabBar';
import type { RootStackParamList } from '../navigation/types';
import { colors, getFontFamily, palette, screenGutter, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const TABS: TabBarItem[] = [
  { key: 'home', label: 'Home', icon: HomeIcon },
  { key: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { key: 'profile', label: 'Profile', icon: User },
];

type PastGame = {
  title: string;
  subtitle: string;
  score: number;
  icon: 'trophy' | 'flag';
};

const PAST_GAMES: PastGame[] = [
  { title: 'Friday Skins', subtitle: 'Tanah Merah · 14 Jun · Won', score: 88, icon: 'trophy' },
  { title: 'Sunday Medal', subtitle: 'Laguna · 8 Jun · 2nd', score: 95, icon: 'flag' },
  { title: 'Kaki Cup R2', subtitle: 'Sentosa · 1 Jun · Won', score: 82, icon: 'flag' },
];

export function HomeScreen({ navigation }: Props) {
  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.greeting}>
            <Avatar initials="WL" size={44} bordered />
            <View>
              <Text style={styles.greetingLabel}>Morning,</Text>
              <Text style={styles.greetingName}>Wei Liang</Text>
            </View>
          </View>
          <HandicapBadge value={7} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.ctaGroup}>
            <Button
              label="Create a game"
              variant="accent"
              size="lg"
              block
              icon={<Plus size={20} color={colors.textOnAccent} />}
            />
            <Button
              label="Join a game"
              variant="secondary"
              size="lg"
              block
              icon={<Users size={20} color={colors.textInverse} />}
            />
          </View>

          <Text style={styles.sectionLabel}>In play</Text>
          <Card variant="inverse" style={styles.liveCard}>
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
              />
            </View>
          </Card>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>Past games</Text>
            <Text style={styles.seeAll}>See all</Text>
          </View>
          <View style={styles.pastGameList}>
            {PAST_GAMES.map((game) => (
              <Card key={game.title} style={styles.pastGameRow}>
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
            ))}
          </View>
        </ScrollView>

        <TabBar
          items={TABS}
          activeKey="home"
          onChange={(key) => {
            if (key === 'profile') navigation.navigate('Profile');
          }}
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
    paddingTop: spacing[2],
    paddingBottom: spacing[3],
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
    letterSpacing: 1.1,
    color: colors.textMuted,
    textTransform: 'uppercase',
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
  },
  seeAll: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: colors.primary,
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
