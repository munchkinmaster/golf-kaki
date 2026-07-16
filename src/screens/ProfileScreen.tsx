import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Lock, Pencil, RefreshCw, Settings, Trophy } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Avatar } from '../components/Avatar';
import { BadgeCard } from '../components/BadgeCard';
import { BottomNav } from '../components/BottomNav';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyTrophyCard } from '../components/EmptyTrophyCard';
import { FeaturedTrophyCard } from '../components/FeaturedTrophyCard';
import { HandicapBadge } from '../components/HandicapBadge';
import { IconButton } from '../components/IconButton';
import { StatRow } from '../components/StatRow';
import type { AttestationStatus, Attester } from '../data/attestations';
import { fetchAttestationStatus, fetchAttesters } from '../data/attestations';
import type { MomentBadges } from '../data/badgeMoments';
import { fetchLatestMoments } from '../data/badgeMoments';
import { fetchHandicapRecordCount, handicapCaption } from '../data/handicap';
import { getInitials, stripHandlePrefix } from '../data/profile';
import { fetchRoundSummaries, profileRoundStats } from '../data/rounds';
import { buildTrophyBadges, pickFeaturedBadge, trophyCounts } from '../data/trophies';
import type { RootStackParamList } from '../navigation/types';
import { useProfile } from '../state/ProfileContext';
import { colors, getFontFamily, palette, radius, screenGutter, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  const { profile, error, refresh, updateProfile } = useProfile();

  // Handicap and trophy badges are recalculated server-side when a round
  // finishes, but this screen's `profile` is a shared context value fetched
  // once at sign-in — refetch on focus so a round finished elsewhere (or in
  // a prior visit) shows up here without a manual reload.
  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, [refresh]),
  );

  const [roundStats, setRoundStats] = useState<{ rounds: number; best: number | null; wins: number } | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      fetchRoundSummaries(profile.id, 'finished')
        .then((summaries) => setRoundStats(profileRoundStats(summaries)))
        .catch(() => {});
    }, [profile?.id]),
  );

  const stats = [
    { value: roundStats?.rounds ?? '–', label: 'Rounds', color: colors.textPrimary },
    { value: roundStats?.best ?? '–', label: 'Best', color: colors.scorePar },
    { value: roundStats?.wins ?? '–', label: 'Wins', color: colors.textPrimary },
  ];

  const [attested, setAttested] = useState<AttestationStatus>({ birdieStreak: false, parStreak: false, holeInOne: false, eagle: false, broke80: false });
  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      fetchAttestationStatus(profile.id)
        .then(setAttested)
        .catch(() => {});
    }, [profile?.id]),
  );

  const [moments, setMoments] = useState<MomentBadges>({ hole_in_one: null, eagle: null, broke_80: null });
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

  const [editingIdentity, setEditingIdentity] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [handleDraft, setHandleDraft] = useState('');
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);

  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);

  const [handicapRoundCount, setHandicapRoundCount] = useState<number | null>(null);
  useEffect(() => {
    if (!profile) return;
    fetchHandicapRecordCount(profile.id)
      .then(setHandicapRoundCount)
      .catch(() => {});
  }, [profile?.id]);

  function startEditIdentity() {
    if (!profile) return;
    setNameDraft(profile.displayName);
    setHandleDraft(`@${profile.handle}`);
    setIdentityError(null);
    setEditingIdentity(true);
  }
  async function saveIdentity() {
    setSavingIdentity(true);
    setIdentityError(null);
    try {
      await updateProfile({ displayName: nameDraft.trim(), handle: stripHandlePrefix(handleDraft) });
      setEditingIdentity(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setIdentityError(message.includes('duplicate') ? 'That handle is taken.' : "Couldn't save — try again.");
    } finally {
      setSavingIdentity(false);
    }
  }

  function startEditBio() {
    if (!profile) return;
    setBioDraft(profile.bio ?? '');
    setBioError(null);
    setEditingBio(true);
  }
  async function saveBio() {
    setSavingBio(true);
    setBioError(null);
    try {
      await updateProfile({ bio: bioDraft.trim() });
      setEditingBio(false);
    } catch {
      setBioError("Couldn't save — try again.");
    } finally {
      setSavingBio(false);
    }
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
          <View style={styles.headerSpacer} />
          <Text style={styles.headerTitle}>Profile</Text>
          <IconButton icon={Settings} iconSize={18} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarRing}>
              <Avatar initials={getInitials(profile.displayName)} size={88} bordered style={styles.profileAvatar} />
            </View>
          </View>

          {editingIdentity ? (
            <View style={styles.identityEditWrap}>
              <View style={[styles.inputRow, styles.inputRowFocused]}>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput value={nameDraft} onChangeText={setNameDraft} style={styles.inputName} />
              </View>
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Handle</Text>
                <TextInput value={handleDraft} onChangeText={setHandleDraft} style={styles.inputHandle} />
              </View>
              {identityError ? <Text style={styles.editErrorText}>{identityError}</Text> : null}
              <EditActions onSave={saveIdentity} onCancel={() => setEditingIdentity(false)} saving={savingIdentity} />
            </View>
          ) : (
            <>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{profile.displayName}</Text>
                <Pressable style={styles.editPencilBtn} onPress={startEditIdentity}>
                  <Pencil size={13} color={colors.primary} />
                </Pressable>
              </View>
              <Text style={styles.handle}>@{profile.handle}{profile.location ? ` · ${profile.location}` : ''}</Text>
            </>
          )}

          <HandicapBadge value={profile.handicap} label="Handicap" variant="orange" size="lg" style={styles.handicapBadge} />

          {handicapRoundCount !== null ? (
            <View style={styles.autoCountRow}>
              <RefreshCw size={12} color={colors.textDisabled} />
              <Text style={styles.autoCountLabel}>{handicapCaption(handicapRoundCount)}</Text>
            </View>
          ) : null}

          {editingBio ? (
            <View style={styles.bioEditWrap}>
              <TextInput
                value={bioDraft}
                onChangeText={setBioDraft}
                multiline
                textAlignVertical="top"
                style={styles.bioInput}
              />
              {bioError ? <Text style={styles.editErrorText}>{bioError}</Text> : null}
              <EditActions onSave={saveBio} onCancel={() => setEditingBio(false)} saving={savingBio} />
            </View>
          ) : (
            <>
              <Text style={styles.bio}>{profile.bio || 'Add a bio to tell your kaki about your game.'}</Text>
              <Pressable style={styles.editBioRow} onPress={startEditBio}>
                <Pencil size={13} color={colors.primary} />
                <Text style={styles.editBioLabel}>Edit bio</Text>
              </Pressable>
            </>
          )}

          <View style={styles.statsRow}>
            {stats.map((stat) => (
              <Card key={stat.label} style={styles.statCard}>
                <StatRow value={stat.value} label={stat.label} valueColor={stat.color} />
              </Card>
            ))}
          </View>

          <View style={styles.trophyHeaderRow}>
            <View style={styles.trophyTitleGroup}>
              <Text style={styles.sectionLabel}>Trophy cabinet</Text>
              <View style={styles.goldChip}>
                <Trophy size={12} color={colors.scoreEagle} />
                <Text style={styles.goldChipLabel}>{counts.gold} gold</Text>
              </View>
            </View>
            <Pressable onPress={() => navigation.navigate('TrophyCabinet')}>
              <Text style={styles.viewAllLabel}>View all</Text>
            </Pressable>
          </View>

          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${counts.progressPercent}%` }]} />
            </View>
            <Text style={styles.progressLabel}>
              {counts.earned} / {counts.total}
            </Text>
          </View>

          {featuredBadge ? (
            <FeaturedTrophyCard badge={featuredBadge} attesters={featuredAttesters} style={styles.featuredCard} />
          ) : (
            <EmptyTrophyCard onStartRound={() => navigation.navigate('SelectCourse')} style={styles.featuredCard} />
          )}

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

        <BottomNav
          active="profile"
          onNavigate={(tab) => {
            if (tab === 'home') navigation.navigate('Home');
            if (tab === 'kaki') navigation.navigate('Kaki');
            if (tab === 'rounds') navigation.navigate('Rounds');
          }}
          onStart={() => navigation.navigate('SelectCourse')}
        />
      </SafeAreaView>
    </View>
  );
}

function EditActions({ onSave, onCancel, saving }: { onSave: () => void; onCancel: () => void; saving?: boolean }) {
  return (
    <View style={styles.editActionsRow}>
      <Pressable
        style={[styles.editSaveBtn, saving && styles.editSaveBtnDisabled]}
        onPress={onSave}
        disabled={saving}
      >
        <Text style={styles.editSaveLabel}>{saving ? 'Saving…' : 'Save'}</Text>
      </Pressable>
      <Pressable style={styles.editCancelBtn} onPress={onCancel} disabled={saving}>
        <Text style={styles.editCancelLabel}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.surfacePage,
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
  headerSpacer: {
    width: 40,
    height: 40,
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
    paddingTop: spacing[2] + 2,
    paddingBottom: spacing[7],
    alignItems: 'center',
  },
  avatarWrap: {
    width: 96,
    height: 96,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: colors.scoreEagle,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.scoreEagle,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 18,
    elevation: 6,
  },
  profileAvatar: {
    borderWidth: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 3,
    marginTop: spacing[3],
  },
  name: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 23,
    color: colors.textPrimary,
  },
  editPencilBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1,
    borderColor: palette.green[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: colors.textDisabled,
    marginTop: 2,
  },
  identityEditWrap: {
    width: '100%',
    marginTop: spacing[3],
    gap: spacing[2],
  },
  inputRow: {
    height: 44,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    gap: spacing[2],
  },
  inputRowFocused: {
    borderColor: colors.primary,
  },
  inputLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
  },
  inputName: {
    flex: 1,
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.textPrimary,
    padding: 0,
  },
  inputHandle: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 15,
    color: colors.textPrimary,
    padding: 0,
  },
  editErrorText: {
    fontFamily: getFontFamily('body', '500'),
    fontSize: 12,
    color: colors.statusDanger,
  },
  editActionsRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: 2,
  },
  editSaveBtn: {
    flex: 1,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editSaveBtnDisabled: {
    opacity: 0.6,
  },
  editSaveLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.textInverse,
  },
  editCancelBtn: {
    flex: 1,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCancelLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.textMuted,
  },
  handicapBadge: {
    marginTop: spacing[3] + 2,
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
  bioEditWrap: {
    width: '100%',
    marginTop: spacing[4],
  },
  bioInput: {
    width: '100%',
    height: 76,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing[2] + 2,
    paddingHorizontal: spacing[3],
    fontFamily: getFontFamily('body', '400'),
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing[2] + 2,
    width: '100%',
    marginTop: spacing[5],
  },
  statCard: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 6,
  },
  trophyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: spacing[7] - 4,
    marginBottom: spacing[3] - 2,
  },
  trophyTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
  },
  sectionLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 1.1,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  goldChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1,
    borderColor: palette.green[200],
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
  },
  goldChipLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    color: colors.primary,
  },
  viewAllLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: colors.primary,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
    width: '100%',
    marginBottom: spacing[4] + 2,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: palette.green[700],
  },
  progressLabel: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 12,
    color: colors.textMuted,
  },
  featuredCard: {
    width: '100%',
    marginBottom: spacing[6] - 2,
  },
  cabinetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    marginTop: spacing[5],
  },
  footerLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textMuted,
  },
});
