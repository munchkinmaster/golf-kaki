import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Camera, ChevronLeft, Home as HomeIcon, Pencil, RefreshCw, Settings, Trophy, User, UserPlus } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Avatar } from '../components/Avatar';
import { Card } from '../components/Card';
import { HandicapBadge } from '../components/HandicapBadge';
import { IconButton } from '../components/IconButton';
import { StatRow } from '../components/StatRow';
import { TabBar } from '../components/TabBar';
import type { TabBarItem } from '../components/TabBar';
import type { RootStackParamList } from '../navigation/types';
import { colors, getFontFamily, getPlayerColors, palette, screenGutter, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

const TABS: TabBarItem[] = [
  { key: 'home', label: 'Home', icon: HomeIcon },
  { key: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { key: 'profile', label: 'Profile', icon: User },
];

const STATS = [
  { value: 42, label: 'Rounds', color: colors.textPrimary },
  { value: 78, label: 'Best', color: colors.scorePar },
  { value: 5, label: 'Wins', color: colors.textPrimary },
];

type Friend = {
  initials: string;
  name: string;
  handicap: number;
  strokeNote: string;
  strokeColor: string;
  chipLabel: string;
  chipColor: string;
  chipBackground: string;
};

const FRIENDS: Friend[] = [
  {
    initials: 'M',
    name: 'Marcus',
    handicap: 2,
    strokeNote: 'Gives you 5',
    strokeColor: colors.scorePar,
    chipLabel: '+5',
    chipColor: colors.scorePar,
    chipBackground: colors.surfaceBrandSoft,
  },
  {
    initials: 'D',
    name: 'Dinesh',
    handicap: 16,
    strokeNote: 'You give 9',
    strokeColor: colors.textAccent,
    chipLabel: '−9',
    chipColor: colors.textAccent,
    chipBackground: colors.surfaceAccentSoft,
  },
  {
    initials: 'J',
    name: 'Jia Hui',
    handicap: 9,
    strokeNote: 'Even strokes',
    strokeColor: colors.textMuted,
    chipLabel: 'Even',
    chipColor: colors.textMuted,
    chipBackground: colors.surfaceSunken,
  },
];

export function ProfileScreen({ navigation }: Props) {
  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>Profile</Text>
          <IconButton icon={Settings} iconSize={18} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.avatarWrap}>
            <Avatar initials="WL" size={96} bordered style={styles.profileAvatar} />
            <View style={styles.cameraBadge}>
              <Camera size={15} color={palette.white} />
            </View>
          </View>

          <Text style={styles.name}>Wei Liang</Text>
          <Text style={styles.handle}>@weiliang · Singapore</Text>

          <HandicapBadge value={7} label="Handicap" variant="orange" size="lg" style={styles.handicapBadge} />

          <View style={styles.autoCountRow}>
            <RefreshCw size={12} color={colors.textDisabled} />
            <Text style={styles.autoCountLabel}>Auto-counted from best 8 of last 20 rounds</Text>
          </View>

          <Text style={styles.bio}>Weekend hacker, fairway optimist. Will play anyone for a teh tarik.</Text>
          <View style={styles.editBioRow}>
            <Pencil size={13} color={colors.primary} />
            <Text style={styles.editBioLabel}>Edit bio</Text>
          </View>

          <View style={styles.statsRow}>
            {STATS.map((stat) => (
              <Card key={stat.label} style={styles.statCard}>
                <StatRow value={stat.value} label={stat.label} valueColor={stat.color} />
              </Card>
            ))}
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>Friends · {FRIENDS.length}</Text>
            <View style={styles.addRow}>
              <UserPlus size={14} color={colors.primary} />
              <Text style={styles.addLabel}>Add</Text>
            </View>
          </View>
          <View style={styles.friendList}>
            {FRIENDS.map((friend, index) => {
              const avatarColors = getPlayerColors(index);
              return (
                <Card key={friend.name} style={styles.friendRow}>
                  <Avatar initials={friend.initials} size={40} backgroundColor={avatarColors.background} color={avatarColors.color} />
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{friend.name}</Text>
                    <Text style={styles.friendSub}>
                      HCP {friend.handicap} · <Text style={{ color: friend.strokeColor }}>{friend.strokeNote}</Text>
                    </Text>
                  </View>
                  <View style={[styles.friendChip, { backgroundColor: friend.chipBackground }]}>
                    <Text style={[styles.friendChipLabel, { color: friend.chipColor }]}>{friend.chipLabel}</Text>
                  </View>
                </Card>
              );
            })}
          </View>
        </ScrollView>

        <TabBar
          items={TABS}
          activeKey="profile"
          onChange={(key) => {
            if (key === 'home') navigation.navigate('Home');
          }}
        />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenGutter,
    paddingVertical: spacing[2],
  },
  headerTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 16,
    color: colors.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingBottom: spacing[7],
    alignItems: 'center',
  },
  avatarWrap: {
    width: 96,
    height: 96,
  },
  profileAvatar: {
    borderWidth: 3,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 23,
    color: colors.textPrimary,
    marginTop: spacing[3],
  },
  handle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: colors.textDisabled,
    marginTop: 2,
  },
  handicapBadge: {
    marginTop: spacing[3],
  },
  autoCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
    marginTop: spacing[2] - 1,
  },
  autoCountLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
  },
  bio: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing[4],
    paddingHorizontal: spacing[1] + 2,
  },
  editBioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
    marginTop: spacing[2] + 1,
  },
  editBioLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing[2] + 2,
    width: '100%',
    marginTop: spacing[6] - 2,
  },
  statCard: {
    flex: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: spacing[6] - 2,
    marginBottom: spacing[2] + 1,
  },
  sectionLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 1.1,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
  },
  addLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: colors.primary,
  },
  friendList: {
    width: '100%',
    gap: spacing[2],
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3] - 2,
  },
  friendInfo: {
    flex: 1,
    minWidth: 0,
  },
  friendName: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: colors.textPrimary,
  },
  friendSub: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: 1,
  },
  friendChip: {
    borderRadius: 999,
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2] + 1,
  },
  friendChipLabel: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 12,
  },
});
