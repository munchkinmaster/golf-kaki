import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowRight, Check } from 'lucide-react-native';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Button } from '../components/Button';
import type { CourseSelection } from '../components/CoursePicker';
import { CoursePicker } from '../components/CoursePicker';
import { TournamentLockedNotice } from '../components/TournamentLockedNotice';
import { TournamentWizardHeader } from '../components/TournamentWizardHeader';
import { formatRoundDate } from '../data/roundDates';
import type { TournamentStackParamList } from '../navigation/types';
import { useTournamentDraft } from '../state/TournamentDraftContext';
import { colors, getFontFamily, palette, radius, screenGutter, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<TournamentStackParamList, 'TournamentCourse'>;

export function TournamentCourseScreen({ navigation, route }: Props) {
  const { draft, update, updateRound } = useTournamentDraft();
  const isMultiRound = draft.roundStructure === 'multi';
  const round = route.params?.round ?? 1;
  // MR2b for Rounds 2+ picks a PLANNED course (draft.rounds[i]) — optional,
  // confirmed on the day in MR11. Round 1 (and single-round S2) edits the
  // played course in draft.courseId/comboId/defaultTee, as before.
  const isPlannedRound = isMultiRound && round > 1;
  const roundPlan = draft.rounds[round - 1];
  const selection: CourseSelection = isPlannedRound
    ? { courseId: roundPlan?.plannedCourseId ?? null, comboId: roundPlan?.plannedComboId ?? null, defaultTee: roundPlan?.plannedTee ?? null, startHole: 1 }
    : { courseId: draft.courseId, comboId: draft.comboId, defaultTee: draft.defaultTee, startHole: draft.startHole };
  const setSelection = useCallback(
    (patch: Partial<CourseSelection>) => {
      if (!isPlannedRound) {
        update(patch);
        return;
      }
      updateRound(round - 1, {
        ...(patch.courseId !== undefined ? { plannedCourseId: patch.courseId } : {}),
        ...(patch.comboId !== undefined ? { plannedComboId: patch.comboId } : {}),
        ...(patch.defaultTee !== undefined ? { plannedTee: patch.defaultTee } : {}),
      });
    },
    [isPlannedRound, round, update, updateRound],
  );

  const canContinue = Boolean(selection.courseId && selection.comboId && selection.defaultTee);
  const summaryLine = `${draft.name} · Stroke play · ${draft.playAs === 'individual' ? 'Individual' : 'Team'}`;
  const roundDate = roundPlan ? formatRoundDate(roundPlan.date) : null;
  const locked = draft.tournamentId !== null;

  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <TournamentWizardHeader
          step="course"
          multiRound={isMultiRound}
          title={isMultiRound ? `Round ${round} course` : undefined}
          onBack={() => navigation.goBack()}
        />

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {isMultiRound ? (
            <View style={styles.roundMetaRow}>
              <View style={styles.roundChip}>
                <Text style={styles.roundChipLabel}>
                  Round {round} of {draft.roundsCount}
                </Text>
              </View>
              <Text style={styles.roundMetaText} numberOfLines={1}>
                {draft.name}
                {roundDate ? ` · ${roundDate}` : ''}
              </Text>
            </View>
          ) : (
            <Text style={styles.summaryLine}>{summaryLine}</Text>
          )}

          {locked ? <TournamentLockedNotice /> : null}
          <View pointerEvents={locked ? 'none' : 'auto'} style={[styles.lockableGroup, locked && styles.lockedContent]}>
            <CoursePicker
              value={selection}
              onChange={setSelection}
              // A planned course is optional, so a later round never gets one auto-picked.
              autoPick={!isPlannedRound}
              // The start hole belongs to the played (Round 1) course.
              showStartHole={!isPlannedRound}
              teeNote={isMultiRound ? 'Default for this round — players can still change their own tee' : 'Players can pick their own tee on the roster.'}
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {isMultiRound ? (
            <>
              <Button
                label={`Save Round ${round}`}
                variant="accent"
                size="lg"
                block
                disabled={!canContinue}
                onPress={() => navigation.goBack()}
                icon={<Check size={19} color={colors.textOnAccent} />}
                iconPosition="right"
              />
              {isPlannedRound && selection.courseId ? (
                <Pressable
                  style={styles.clearPlanButton}
                  onPress={() => {
                    updateRound(round - 1, { plannedCourseId: null, plannedComboId: null, plannedTee: null });
                    navigation.goBack();
                  }}
                >
                  <Text style={styles.clearPlanLabel}>No planned course — decide on the day</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <Button
              label="Continue"
              variant="accent"
              size="lg"
              block
              disabled={!canContinue}
              onPress={() => navigation.navigate('TournamentRules')}
              icon={<ArrowRight size={19} color={colors.textOnAccent} />}
              iconPosition="right"
            />
          )}
        </View>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[1],
    paddingBottom: spacing[6],
    gap: spacing[4],
  },
  lockableGroup: {
    gap: spacing[4],
  },
  lockedContent: {
    opacity: 0.5,
  },
  summaryLine: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
  },
  roundMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  roundChip: {
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1,
    borderColor: palette.multiRound.brandSoftBorder,
    borderRadius: radius.pill,
    paddingHorizontal: spacing[2] + 2,
    paddingVertical: spacing[1],
  },
  roundChipLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 12,
    color: colors.primary,
  },
  roundMetaText: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
  },
  clearPlanButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[1],
  },
  clearPlanLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.textMuted,
  },
  footer: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[3],
    paddingBottom: spacing[5],
    backgroundColor: colors.surfacePage,
  },
});
