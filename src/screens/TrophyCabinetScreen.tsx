import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronLeft, Lock, Share2, Trophy } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Share, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Avatar } from '../components/Avatar';
import { BadgeCard } from '../components/BadgeCard';
import { EmptyTrophyCard } from '../components/EmptyTrophyCard';
import { FeaturedTrophyCard } from '../components/FeaturedTrophyCard';
import { IconButton } from '../components/IconButton';
import type { AttestationStatus, Attester } from '../data/attestations';
import { fetchAttestationStatus, fetchAttesters } from '../data/attestations';
import type { MomentBadges } from '../data/badgeMoments';
import { fetchLatestMoments } from '../data/badgeMoments';
import { getInitials } from '../data/profile';
import { buildTrophyBadges, pickFeaturedBadge, trophyCounts } from '../data/trophies';
import type { RootStackParamList } from '../navigation/types';
import { useProfile } from '../state/ProfileContext';
import { colors, getFontFamily, palette, radius, screenGutter, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'TrophyCabinet'>;

export function TrophyCabinetScreen({ navigation }: Props) {
  const { profile, refresh } = useProfile();

  // Same shared-context staleness as ProfileScreen — refetch on focus so a
  // round finished elsewhere shows up here without a manual reload.
  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, [refresh]),
  );

  const [attested, setAttested] = useState<AttestationStatus>({ birdieStreak: false, parStreak: false, holeInOne: false, eagle: false });
  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      fetchAttestationStatus(profile.id)
        .then(setAttested)
        .catch(() => {});
    }, [profile?.id]),
  );

  const [moments, setMoments] = useState<MomentBadges>({ hole_in_one: null, eagle: null });
  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      fetchLatestMoments(profile.id)
        .then(setMoments)
        .catch(() => {});
    }, [profile?.id]),
  );

  const trophyBadges = useMemo(
    () => buildTrophyBadges(profile, attested, moments),
    [profile?.birdieStreakBest, profile?.parStreakBest, attested, moments],
  );
  const counts = useMemo(() => trophyCounts(trophyBadges), [trophyBadges]);
  const featuredBadge = useMemo(() => pickFeaturedBadge(trophyBadges, moments), [trophyBadges, moments]);

  const [featuredAttesters, setFeaturedAttesters] = useState<Attester[]>([]);
  useEffect(() => {
    if (!profile || !featuredBadge) {
      setFeaturedAttesters([]);
      return;
    }
    fetchAttesters(profile.id, featuredBadge.attestationType)
      .then(setFeaturedAttesters)
      .catch(() => {});
  }, [profile?.id, featuredBadge?.attestationType]);

  const onShare = () => {
    Share.share({ message: `${counts.earned} of ${counts.total} trophies earned on Golf Kaki — ${counts.gold} gold.` }).catch(() => {});
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
              <Avatar initials={getInitials(profile?.displayName ?? '')} size={52} bordered />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{profile?.displayName ?? ''}</Text>
              <Text style={styles.profileSub}>
                {counts.earned} of {counts.total} trophies earned
              </Text>
            </View>
            <View style={styles.goldChip}>
              <Trophy size={13} color={colors.scoreEagle} />
              <Text style={styles.goldChipLabel}>{counts.gold} gold</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${counts.progressPercent}%` }]} />
          </View>

          {featuredBadge ? (
            <FeaturedTrophyCard
              badge={featuredBadge}
              attesters={featuredAttesters}
              style={styles.featuredCard}
              // BragCardScreen only renders a Hole-in-One moment today (see
              // src/data/trophies.ts's BRAG_CARD) — only route there when
              // that's genuinely what's featured, so this never opens a card
              // that doesn't match the badge just tapped.
              onPress={featuredBadge.attestationType === 'hole_in_one' ? () => navigation.navigate('BragCard') : undefined}
            />
          ) : (
            <EmptyTrophyCard onStartRound={() => navigation.navigate('SelectCourse')} style={styles.featuredCard} />
          )}

          <Text style={styles.sectionLabel}>The cabinet</Text>
          <View style={styles.cabinetGrid}>
            {trophyBadges.map((badge) => (
              <BadgeCard key={badge.name} badge={badge} />
            ))}
          </View>

          <View style={styles.footerRow}>
            <Lock size={13} color={colors.textMuted} />
            <Text style={styles.footerLabel}>{counts.locked} more to chase</Text>
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
