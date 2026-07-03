import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronLeft, Lock, Share2, Trophy } from 'lucide-react-native';
import { Share, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Avatar } from '../components/Avatar';
import { BadgeCard } from '../components/BadgeCard';
import { FeaturedTrophyCard } from '../components/FeaturedTrophyCard';
import { IconButton } from '../components/IconButton';
import { FEATURED_BADGE, GOLD_TROPHIES, PROGRESS_PERCENT, TROPHIES_EARNED, TROPHIES_GOAL, TROPHIES_LOCKED, TROPHY_BADGES } from '../data/trophies';
import type { RootStackParamList } from '../navigation/types';
import { colors, getFontFamily, palette, radius, screenGutter, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'TrophyCabinet'>;

export function TrophyCabinetScreen({ navigation }: Props) {
  const onShare = () => {
    Share.share({ message: `${TROPHIES_EARNED} of ${TROPHIES_GOAL} trophies earned on Golf Kaki — ${GOLD_TROPHIES} gold.` }).catch(() => {});
  };

  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <IconButton icon={ChevronLeft} iconSize={20} onPress={() => navigation.goBack()} />
            <Text style={styles.headerTitle}>Trophies</Text>
          </View>
          <IconButton icon={Share2} iconSize={16} color={colors.primary} onPress={onShare} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.profileRow}>
            <View style={styles.avatarRing}>
              <Avatar initials="WL" size={52} bordered />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>Wei Liang</Text>
              <Text style={styles.profileSub}>
                {TROPHIES_EARNED} of {TROPHIES_GOAL} trophies earned
              </Text>
            </View>
            <View style={styles.goldChip}>
              <Trophy size={13} color={colors.scoreEagle} />
              <Text style={styles.goldChipLabel}>{GOLD_TROPHIES} gold</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${PROGRESS_PERCENT}%` }]} />
          </View>

          <FeaturedTrophyCard
            badge={FEATURED_BADGE}
            style={styles.featuredCard}
            onPress={() => navigation.navigate('BragCard')}
          />

          <Text style={styles.sectionLabel}>The cabinet</Text>
          <View style={styles.cabinetGrid}>
            {TROPHY_BADGES.map((badge) => (
              <BadgeCard key={badge.name} badge={badge} />
            ))}
          </View>

          <View style={styles.footerRow}>
            <Lock size={13} color={colors.textMuted} />
            <Text style={styles.footerLabel}>{TROPHIES_LOCKED} more to chase</Text>
          </View>
        </ScrollView>
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
    paddingTop: screenGutter,
    paddingBottom: spacing[2],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
  },
  headerTitle: {
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
    paddingTop: spacing[1],
    paddingBottom: spacing[7],
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3] + 1,
    marginBottom: spacing[4],
  },
  avatarRing: {
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.scoreEagle,
    shadowColor: colors.scoreEagle,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 14,
    elevation: 5,
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  profileSub: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12.5,
    color: colors.textMuted,
    marginTop: 1,
  },
  goldChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1,
    borderColor: palette.green[200],
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
  },
  goldChipLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: colors.primary,
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
    marginBottom: spacing[5] - 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: palette.green[700],
  },
  featuredCard: {
    marginBottom: spacing[6] - 2,
  },
  sectionLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: spacing[3] - 2,
  },
  cabinetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  footerLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textMuted,
  },
});
