import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { ArrowRight, CircleCheckBig, Flag, GitFork, Info, MapPin, Navigation, Ruler, Search, Users } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { TournamentLockedNotice } from '../components/TournamentLockedNotice';
import { TournamentWizardHeader } from '../components/TournamentWizardHeader';
import type { Course as CatalogCourse, NineCombo, TeeColor } from '../data/courses';
import { fetchCourseCatalog, getComboHoles } from '../data/courses';
import { fetchComboRating } from '../data/handicap';
import { distanceKm, formatDistanceKm } from '../lib/geo';
import type { TournamentStackParamList } from '../navigation/types';
import { useTournamentDraft } from '../state/TournamentDraftContext';
import { colors, getFontFamily, palette, radius, screenGutter, shadows, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<TournamentStackParamList, 'TournamentCourse'>;

type StartHole = { n: number; meta: string };

const NEARBY_COUNT = 5;

const TEE_OPTIONS: { id: TeeColor; label: string; dot: string; dotBorder?: string }[] = [
  { id: 'black', label: 'Black', dot: palette.tee.black },
  { id: 'blue', label: 'Blue', dot: palette.tee.blue },
  { id: 'white', label: 'White', dot: palette.tee.white, dotBorder: palette.tee.whiteBorder },
  { id: 'red', label: 'Red', dot: palette.tee.red },
];

export function TournamentCourseScreen({ navigation }: Props) {
  const { draft, update } = useTournamentDraft();
  const [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [comboSheetOpen, setComboSheetOpen] = useState(false);
  const [startHoleSheetOpen, setStartHoleSheetOpen] = useState(false);
  const [rating, setRating] = useState<{ courseRating: number; slopeRating: number } | null>(null);

  useEffect(() => {
    fetchCourseCatalog()
      .then(setCatalog)
      .catch(() => setCatalogError(true))
      .finally(() => setCatalogLoading(false));
  }, []);

  // Nearby sorting is a nice-to-have — same fallback stance as SelectCourseScreen: permission
  // denial, no fix, or a course missing lat/lng just falls back to the full catalog list.
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;
      const pos = await Location.getCurrentPositionAsync({});
      if (!cancelled) setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const allCourses = useMemo(
    () => catalog.map((c) => ({ id: c.id, name: c.name, area: c.area, totalHoles: c.nines.length * 9, latitude: c.latitude, longitude: c.longitude })),
    [catalog],
  );

  const nearbyCourses = useMemo(() => {
    if (!userLocation) return null;
    const withDistance = allCourses
      .filter((c): c is (typeof allCourses)[number] & { latitude: number; longitude: number } => c.latitude !== null && c.longitude !== null)
      .map((c) => ({ ...c, distanceKm: distanceKm(userLocation, c) }));
    if (withDistance.length === 0) return null;
    return withDistance.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, NEARBY_COUNT);
  }, [allCourses, userLocation]);

  const q = query.trim().toLowerCase();
  const filteredCourses = useMemo(
    () => allCourses.filter((c) => !q || c.name.toLowerCase().includes(q) || c.area.toLowerCase().includes(q)),
    [allCourses, q],
  );

  const selectedCatalogCourse = catalog.find((c) => c.id === draft.courseId);
  const comboOptions = selectedCatalogCourse?.combos ?? [];
  const selectedCombo = comboOptions.find((c) => c.id === draft.comboId) ?? comboOptions[0];

  // Auto-pick a course/combo/tee default so Continue is reachable without forcing an empty
  // choice — mirrors SelectCourseScreen's "nearest club, or catalog's first" default, plus
  // this screen's own combo/tee defaults once a course resolves.
  useEffect(() => {
    if (draft.courseId) return;
    const preferredId = nearbyCourses?.[0]?.id ?? allCourses[0]?.id;
    if (preferredId) update({ courseId: preferredId });
  }, [allCourses, nearbyCourses, draft.courseId, update]);

  useEffect(() => {
    if (!selectedCatalogCourse) return;
    if (!draft.comboId || !selectedCatalogCourse.combos.some((c) => c.id === draft.comboId)) {
      update({ comboId: selectedCatalogCourse.combos[0]?.id ?? null });
    }
    if (!draft.defaultTee) update({ defaultTee: 'blue' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the selected course itself changes
  }, [selectedCatalogCourse]);

  useEffect(() => {
    if (!selectedCatalogCourse || !selectedCombo || !draft.defaultTee) {
      setRating(null);
      return;
    }
    let cancelled = false;
    fetchComboRating(selectedCatalogCourse.id, selectedCombo.id, draft.defaultTee)
      .then((r) => {
        if (!cancelled) setRating(r);
      })
      .catch(() => {
        if (!cancelled) setRating(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCatalogCourse, selectedCombo, draft.defaultTee]);

  const comboParTotal = useMemo(() => {
    if (!selectedCatalogCourse || !selectedCombo) return null;
    return getComboHoles(selectedCatalogCourse, selectedCombo.id).reduce((sum, h) => sum + h.par, 0);
  }, [selectedCatalogCourse, selectedCombo]);

  const startHoles = useMemo<StartHole[]>(() => {
    if (!selectedCatalogCourse || !selectedCombo) return [];
    return getComboHoles(selectedCatalogCourse, selectedCombo.id).map((h) => ({ n: h.n, meta: `Par ${h.par} · SI ${h.si}` }));
  }, [selectedCatalogCourse, selectedCombo]);
  const startHoleMeta = startHoles.find((h) => h.n === draft.startHole)?.meta;

  // Keep the picked start hole valid as the course/combo changes — same
  // fallback-to-first-hole stance as SelectCourseScreen's identical effect.
  useEffect(() => {
    if (startHoles.length > 0 && !startHoles.some((h) => h.n === draft.startHole)) update({ startHole: startHoles[0]!.n });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- update() and draft.startHole are stable/derived; only re-run when the hole list itself changes
  }, [startHoles]);

  const canContinue = Boolean(draft.courseId && selectedCombo && draft.defaultTee);
  const summaryLine = `${draft.name} · Stroke play · ${draft.playAs === 'individual' ? 'Individual' : 'Team'}`;
  const locked = draft.tournamentId !== null;

  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <TournamentWizardHeader step="course" onBack={() => navigation.goBack()} />

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.summaryLine}>{summaryLine}</Text>

          {locked ? <TournamentLockedNotice /> : null}
          <View pointerEvents={locked ? 'none' : 'auto'} style={[styles.lockableGroup, locked && styles.lockedContent]}>
          <View>
            <Text style={styles.fieldLabel}>Course</Text>
            <View style={styles.searchBar}>
              <Search size={17} color={colors.textDisabled} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search golf clubs"
                placeholderTextColor={palette.soon.labelUpcoming}
                style={styles.searchInput}
              />
            </View>
            {catalogError ? <Text style={styles.errorText}>Couldn't load clubs — check your connection and try again.</Text> : null}

            {catalogLoading ? (
              <Text style={styles.loadingText}>Loading clubs…</Text>
            ) : q === '' && nearbyCourses ? (
              <>
                <View style={styles.nearbyHeaderRow}>
                  <Navigation size={12} color={palette.green[600]} />
                  <Text style={styles.nearbyHeaderText}>Near you</Text>
                </View>
                {nearbyCourses.map((course) => (
                  <CourseRow
                    key={course.id}
                    name={course.name}
                    meta={`${course.area} · ${formatDistanceKm(course.distanceKm)} · ${course.totalHoles} holes`}
                    selected={draft.courseId === course.id}
                    onPress={() => update({ courseId: course.id, comboId: null })}
                  />
                ))}
              </>
            ) : filteredCourses.length > 0 ? (
              filteredCourses.map((course) => (
                <CourseRow
                  key={course.id}
                  name={course.name}
                  meta={`${course.area} · ${course.totalHoles} holes`}
                  selected={draft.courseId === course.id}
                  onPress={() => update({ courseId: course.id, comboId: null })}
                />
              ))
            ) : (
              <Text style={styles.loadingText}>{q ? 'No clubs match that search.' : 'No clubs available yet.'}</Text>
            )}
          </View>

          {selectedCatalogCourse && selectedCombo ? (
            <>
              <View>
                <Text style={styles.fieldLabel}>Which 18 to play</Text>
                {selectedCatalogCourse.nines.length > 2 ? (
                  <View style={styles.infoRow}>
                    <Info size={12} color={colors.textDisabled} />
                    <Text style={styles.infoText}>{selectedCatalogCourse.nines.length * 9}-hole course — pick which two nines</Text>
                  </View>
                ) : null}
                <Pressable style={styles.comboPicker} onPress={() => setComboSheetOpen(true)}>
                  <View style={styles.comboPickerLeft}>
                    <Flag size={17} color={palette.green[600]} />
                    <Text style={styles.comboPickerLabel}>
                      {selectedCombo.label}
                      {comboParTotal !== null ? ` · Par ${comboParTotal}` : ''}
                    </Text>
                  </View>
                </Pressable>
                {selectedCatalogCourse.nines.length > 2 ? (
                  <View style={styles.noteRow}>
                    <GitFork size={14} color={colors.textSecondary} />
                    <Text style={styles.noteText}>
                      {selectedCatalogCourse.nines.find((n) => n.id === selectedCombo.front)?.name} plays as the front 9,{' '}
                      {selectedCatalogCourse.nines.find((n) => n.id === selectedCombo.back)?.name} as the back 9.
                    </Text>
                  </View>
                ) : null}
              </View>

              <View>
                <Text style={styles.fieldLabel}>Starting hole</Text>
                <Pressable style={styles.comboPicker} onPress={() => setStartHoleSheetOpen(true)}>
                  <View style={styles.comboPickerLeft}>
                    <Flag size={17} color={palette.green[600]} />
                    <Text style={styles.comboPickerLabel}>
                      Hole {draft.startHole}
                      {startHoleMeta ? ` · ${startHoleMeta}` : ''}
                    </Text>
                  </View>
                </Pressable>
                <View style={styles.noteRow}>
                  <Info size={12} color={colors.textDisabled} />
                  <Text style={styles.noteText}>Shotgun start — the field tees off here and plays 18 in order from this hole.</Text>
                </View>
              </View>

              <View>
                <Text style={styles.fieldLabel}>Default tee box</Text>
                <View style={styles.row}>
                  {TEE_OPTIONS.map((tee) => {
                    const selected = draft.defaultTee === tee.id;
                    return (
                      <Pressable
                        key={tee.id}
                        style={[styles.teeOption, selected && styles.teeOptionSelected]}
                        onPress={() => update({ defaultTee: tee.id })}
                      >
                        <View style={[styles.teeDot, { backgroundColor: tee.dot }, tee.dotBorder ? { borderWidth: 1, borderColor: tee.dotBorder } : null]} />
                        <Text style={[styles.teeOptionLabel, selected && styles.teeOptionLabelSelected]}>{tee.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.noteRow}>
                  <Users size={12} color={colors.textDisabled} />
                  <Text style={styles.infoText}>Players can pick their own tee on the roster.</Text>
                </View>
              </View>

              {rating ? (
                <View style={styles.ratingCard}>
                  <Ruler size={15} color={colors.primary} />
                  <Text style={styles.ratingText}>
                    Course rating {rating.courseRating.toFixed(1)} · Slope {rating.slopeRating} — used to convert handicaps for nett scoring.
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}
          </View>
        </ScrollView>

        <View style={styles.footer}>
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
        </View>
      </SafeAreaView>

      <BottomSheet visible={comboSheetOpen} onClose={() => setComboSheetOpen(false)} title="Select which nines" subtitle="Pick the two nines you're playing today.">
        {comboOptions.map((combo) => (
          <ComboRow
            key={combo.id}
            combo={combo}
            selected={combo.id === draft.comboId}
            onPress={() => {
              update({ comboId: combo.id });
              setComboSheetOpen(false);
            }}
          />
        ))}
      </BottomSheet>

      <BottomSheet
        visible={startHoleSheetOpen}
        onClose={() => setStartHoleSheetOpen(false)}
        title="Select starting hole"
        subtitle="Shotgun start — the field tees off from this hole and plays 18 in order from there."
      >
        {startHoles.map((hole) => (
          <StartHoleRow
            key={hole.n}
            hole={hole}
            selected={hole.n === draft.startHole}
            onPress={() => {
              update({ startHole: hole.n });
              setStartHoleSheetOpen(false);
            }}
          />
        ))}
      </BottomSheet>
    </View>
  );
}

function CourseRow({ name, meta, selected, onPress }: { name: string; meta: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.courseRow, selected ? styles.courseRowSelected : styles.courseRowUnselected]} onPress={onPress}>
      <View style={[styles.courseIcon, selected && styles.courseIconSelected]}>
        <MapPin size={16} color={selected ? palette.white : colors.textDisabled} />
      </View>
      <View style={styles.courseInfo}>
        <Text style={[styles.courseName, selected && styles.courseNameSelected]}>{name}</Text>
        <Text style={styles.courseMeta}>{meta}</Text>
      </View>
      {selected ? <CircleCheckBig size={20} color={colors.primary} /> : <View style={styles.courseRadioOff} />}
    </Pressable>
  );
}

function ComboRow({ combo, selected, onPress }: { combo: NineCombo; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.startHoleRow} onPress={onPress}>
      <Text style={[styles.startHoleRowLabel, selected && styles.startHoleRowLabelActive]}>{combo.label}</Text>
      {selected ? <CircleCheckBig size={22} color={colors.primary} /> : <View style={styles.courseRadioOff} />}
    </Pressable>
  );
}

function StartHoleRow({ hole, selected, onPress }: { hole: StartHole; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.startHoleRow} onPress={onPress}>
      <View>
        <Text style={[styles.startHoleRowLabel, selected && styles.startHoleRowLabelActive]}>Hole {hole.n}</Text>
        <Text style={styles.startHoleRowMeta}>{hole.meta}</Text>
      </View>
      {selected ? <CircleCheckBig size={22} color={colors.primary} /> : <View style={styles.courseRadioOff} />}
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
  fieldLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing[2] - 1,
  },
  searchBar: {
    height: 48,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
    paddingHorizontal: spacing[3] + 2,
    marginBottom: spacing[3],
  },
  searchInput: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 14,
    color: colors.textPrimary,
  },
  errorText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    marginBottom: spacing[2],
  },
  loadingText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: colors.textDisabled,
    textAlign: 'center',
    marginTop: spacing[4],
  },
  nearbyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
    marginBottom: spacing[2],
  },
  nearbyHeaderText: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 1.1,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: spacing[2] + 2,
    marginBottom: spacing[2] - 1,
  },
  courseRowSelected: {
    backgroundColor: colors.surfaceBrandSoft,
    borderColor: colors.primary,
  },
  courseRowUnselected: {
    backgroundColor: colors.surfaceCard,
    borderColor: colors.borderDefault,
  },
  courseIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm + 1,
    backgroundColor: palette.soon.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  courseIconSelected: {
    backgroundColor: colors.primary,
  },
  courseInfo: {
    flex: 1,
    minWidth: 0,
  },
  courseName: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: colors.textPrimary,
  },
  courseNameSelected: {
    color: colors.primary,
  },
  courseMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: 1,
  },
  courseRadioOff: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: palette.soon.radioOff,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
    marginBottom: spacing[2] - 1,
  },
  infoText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
  },
  comboPicker: {
    height: 50,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.md,
    justifyContent: 'center',
    paddingHorizontal: spacing[4] - 1,
    ...shadows.xs,
  },
  comboPickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
  },
  comboPickerLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 15,
    color: colors.textPrimary,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[2],
    padding: spacing[2] + 1,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.sm + 2,
  },
  noteText: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  row: {
    flexDirection: 'row',
    gap: spacing[1] + 2,
  },
  teeOption: {
    flex: 1,
    height: 46,
    borderRadius: radius.md - 1,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1] + 2,
  },
  teeOptionSelected: {
    backgroundColor: colors.surfaceBrandSoft,
    borderColor: colors.primary,
  },
  teeDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  teeOptionLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: colors.textDisabled,
  },
  teeOptionLabelSelected: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    color: colors.primary,
  },
  ratingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
    padding: spacing[3] - 1,
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1,
    borderColor: palette.green[200],
    borderRadius: radius.md,
  },
  ratingText: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[3],
    paddingBottom: spacing[5],
    backgroundColor: colors.surfacePage,
  },
  startHoleRow: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSunken,
  },
  startHoleRowLabel: {
    fontFamily: getFontFamily('body', '500'),
    fontWeight: '500',
    fontSize: 15,
    color: colors.textPrimary,
  },
  startHoleRowLabelActive: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    color: colors.primary,
  },
  startHoleRowMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: 2,
  },
});
