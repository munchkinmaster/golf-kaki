import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowRight, Calendar, ChevronDown, ChevronRight, Flag, Info, MapPin } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Button } from '../components/Button';
import { RoundDatePickerSheet } from '../components/RoundDatePickerSheet';
import { TournamentLockedNotice } from '../components/TournamentLockedNotice';
import { TournamentWizardHeader } from '../components/TournamentWizardHeader';
import type { Course as CatalogCourse } from '../data/courses';
import { fetchCourseCatalog } from '../data/courses';
import { formatRoundDate, localDateString, setRoundDate } from '../data/roundDates';
import { teePresentation } from '../data/tees';
import type { TournamentStackParamList } from '../navigation/types';
import { useTournamentDraft } from '../state/TournamentDraftContext';
import { colors, getFontFamily, palette, radius, screenGutter, shadows, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<TournamentStackParamList, 'TournamentRounds'>;

/**
 * MR2 — a multi-round tournament's schedule. Every round gets a date now (so
 * everyone can block it out); only Round 1 needs a course now, later rounds
 * can carry an optional planned course that's confirmed on the day (MR11).
 * Single-round tournaments never reach this screen (S1 goes straight to S2).
 */
export function TournamentRoundsScreen({ navigation }: Props) {
  const { draft, update } = useTournamentDraft();
  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [pickingDateFor, setPickingDateFor] = useState<number | null>(null);
  const locked = draft.tournamentId !== null;
  const today = useMemo(() => localDateString(), []);

  useEffect(() => {
    fetchCourseCatalog()
      .then(setCatalog)
      .catch(() => setCatalog([]));
  }, []);

  /** "Sentosa GC · Serapong" — the club plus which 18, matching MR2's planned-course row. */
  const courseLabel = (courseId: string | null, comboId: string | null): string | null => {
    if (!courseId) return null;
    const course = catalog.find((c) => c.id === courseId);
    if (!course) return null;
    const combo = course.combos.find((c) => c.id === comboId);
    return combo && course.combos.length > 1 ? `${course.name} · ${combo.label}` : course.name;
  };

  const dates = draft.rounds.map((r) => r.date);
  const round1Ready = Boolean(draft.courseId && draft.comboId && draft.defaultTee);
  const summary = `${draft.name} · ${draft.roundsCount} rounds · Stroke play · Individual · aggregate`;

  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <TournamentWizardHeader step="course" multiRound onBack={() => navigation.goBack()} />

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.summary}>{summary}</Text>
          {locked ? <TournamentLockedNotice /> : null}

          <View pointerEvents={locked ? 'none' : 'auto'} style={[styles.cardStack, locked && styles.lockedContent]}>
            {draft.rounds.map((round, i) => {
              const isRound1 = i === 0;
              const isFinal = i === draft.rounds.length - 1;
              const needsCourse = isRound1 && !round1Ready;
              const label = isRound1 ? courseLabel(draft.courseId, draft.comboId) : courseLabel(round.plannedCourseId, round.plannedComboId);
              return (
                <View key={i} style={[styles.roundCard, needsCourse && styles.roundCardRequired]}>
                  <View style={styles.roundHeader}>
                    <View style={styles.roundPill}>
                      <Text style={styles.roundPillLabel}>
                        Round {i + 1}
                        {isFinal ? ' · Final' : ''}
                      </Text>
                    </View>
                    <Pressable style={styles.dateChip} onPress={() => setPickingDateFor(i)} accessibilityLabel={`Change Round ${i + 1} date`}>
                      <Calendar size={13} color={colors.textMuted} />
                      <Text style={styles.dateChipLabel}>{formatRoundDate(round.date)}</Text>
                      <ChevronDown size={13} color={palette.soon.labelUpcoming} />
                    </Pressable>
                  </View>

                  <View style={styles.divider} />

                  <Pressable style={styles.courseRow} onPress={() => navigation.navigate('TournamentCourse', { round: i + 1 })}>
                    {needsCourse ? (
                      <>
                        <View style={[styles.courseTile, styles.courseTileRequired]}>
                          <MapPin size={17} color={palette.multiRound.required.text} />
                        </View>
                        <View style={styles.courseBody}>
                          <Text style={[styles.courseName, styles.courseNameRequired]}>Choose course</Text>
                          <View style={styles.tagRow}>
                            <Text style={[styles.tag, styles.tagRequired]}>Required</Text>
                          </View>
                        </View>
                        <ChevronRight size={18} color={palette.multiRound.required.text} />
                      </>
                    ) : label ? (
                      <>
                        <View style={[styles.courseTile, styles.courseTileSet]}>
                          <Flag size={17} color={colors.accent} />
                        </View>
                        <View style={styles.courseBody}>
                          <Text style={styles.courseName} numberOfLines={1}>
                            {label}
                          </Text>
                          <View style={styles.tagRow}>
                            {isRound1 ? (
                              <Text style={[styles.tag, styles.tagSet]}>{teePresentation(draft.courseId, draft.defaultTee ?? 'blue').label} tee · start hole {draft.startHole}</Text>
                            ) : (
                              <Text style={[styles.tag, styles.tagPlanned]}>Planned · confirm on the day</Text>
                            )}
                          </View>
                        </View>
                        <ChevronRight size={18} color={palette.soon.labelUpcoming} />
                      </>
                    ) : (
                      <>
                        <View style={[styles.courseTile, styles.courseTileEmpty]}>
                          <MapPin size={17} color={palette.soon.labelUpcoming} />
                        </View>
                        <View style={styles.courseBody}>
                          <Text style={[styles.courseName, styles.courseNameEmpty]}>Course on the day</Text>
                          <View style={styles.tagRow}>
                            <Text style={[styles.tag, styles.tagEmpty]}>Optional · add a planned course</Text>
                          </View>
                        </View>
                        <ChevronRight size={18} color={palette.soon.labelUpcoming} />
                      </>
                    )}
                  </Pressable>
                </View>
              );
            })}
          </View>

          <View style={styles.note}>
            <Info size={15} color={palette.multiRound.note.icon} />
            <Text style={styles.noteText}>
              Set the dates now so everyone can block them out. Only Round 1 needs a course now. Courses, holes and tee times for later rounds are confirmed on the day.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label="Continue"
            variant="accent"
            size="lg"
            block
            disabled={!round1Ready}
            onPress={() => navigation.navigate('TournamentRules')}
            icon={<ArrowRight size={19} color={colors.textOnAccent} />}
            iconPosition="right"
          />
        </View>
      </SafeAreaView>

      <RoundDatePickerSheet
        visible={pickingDateFor !== null}
        roundIndex={pickingDateFor ?? 0}
        dates={dates}
        today={today}
        onClose={() => setPickingDateFor(null)}
        onConfirm={(date) => {
          if (pickingDateFor === null) return;
          const next = setRoundDate(dates, pickingDateFor, date);
          update({ rounds: draft.rounds.map((r, i) => ({ ...r, date: next[i]! })) });
          setPickingDateFor(null);
        }}
      />
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
    paddingTop: spacing[2],
    paddingBottom: spacing[5],
    gap: spacing[3],
  },
  summary: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    marginBottom: 2,
  },
  cardStack: {
    gap: spacing[3],
  },
  lockedContent: {
    opacity: 0.5,
  },
  roundCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.lg - 2,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3] + 2,
  },
  roundCardRequired: {
    borderColor: colors.accent,
    ...shadows.accent,
    shadowOpacity: 0.15,
  },
  roundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  roundPill: {
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1,
    borderColor: palette.multiRound.brandSoftBorder,
    borderRadius: radius.pill,
    paddingHorizontal: spacing[2] + 2,
    paddingVertical: spacing[1],
  },
  roundPillLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 13,
    color: colors.primary,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
    minHeight: 44,
    paddingHorizontal: spacing[2] + 2,
    backgroundColor: colors.surfaceMutedTile,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.md - 2,
  },
  dateChipLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: palette.multiRound.divider,
    marginVertical: spacing[3] - 1,
  },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 2,
    minHeight: 44,
  },
  courseTile: {
    width: 38,
    height: 38,
    borderRadius: radius.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseTileRequired: {
    backgroundColor: palette.multiRound.required.fill,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.multiRound.required.border,
  },
  courseTileSet: {
    backgroundColor: colors.primary,
  },
  courseTileEmpty: {
    backgroundColor: palette.soon.surface,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.multiRound.emptyTileBorder,
  },
  courseBody: {
    flex: 1,
    minWidth: 0,
  },
  courseName: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: colors.textPrimary,
  },
  courseNameRequired: {
    color: palette.multiRound.required.text,
  },
  courseNameEmpty: {
    color: palette.soon.labelDone,
  },
  tagRow: {
    flexDirection: 'row',
    marginTop: spacing[1],
  },
  tag: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 10,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    overflow: 'hidden',
  },
  tagRequired: {
    color: palette.multiRound.required.text,
    backgroundColor: palette.multiRound.required.fill,
    borderColor: palette.multiRound.required.border,
  },
  tagSet: {
    color: colors.primary,
    backgroundColor: colors.surfaceBrandSoft,
    borderColor: palette.multiRound.brandSoftBorder,
  },
  tagPlanned: {
    color: palette.multiRound.note.icon,
    backgroundColor: palette.multiRound.note.fill,
    borderColor: palette.multiRound.note.border,
  },
  tagEmpty: {
    color: palette.soon.labelDone,
    backgroundColor: palette.soon.surface,
    borderColor: colors.borderDefault,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
    marginTop: spacing[1] + 2,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3] + 2,
    backgroundColor: palette.multiRound.note.fill,
    borderWidth: 1,
    borderColor: palette.multiRound.note.border,
    borderRadius: radius.md,
  },
  noteText: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    lineHeight: 17,
    color: palette.multiRound.note.text,
  },
  footer: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[3],
    paddingBottom: spacing[5],
    backgroundColor: colors.surfacePage,
  },
});
