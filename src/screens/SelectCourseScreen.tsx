import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  Circle,
  CircleCheckBig,
  Flag,
  Info,
  MapPin,
  Search,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Button } from '../components/Button';
import { IconButton } from '../components/IconButton';
import type { Course as CatalogCourse, NineCombo } from '../data/courses';
import { fetchCourseCatalog, getComboHoles } from '../data/courses';
import type { RootStackParamList } from '../navigation/types';
import { colors, getFontFamily, motion, palette, radius, screenGutter, shadows, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'SelectCourse'>;

type HolesToPlay = 9 | 18;

type Course = {
  id: string;
  name: string;
  area: string;
  totalHoles: number;
};

type StartHole = {
  n: number;
  meta: string;
};

export function SelectCourseScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [holesToPlay, setHolesToPlay] = useState<HolesToPlay>(18);
  const [startHole, setStartHole] = useState(1);
  const [startHoleSheetOpen, setStartHoleSheetOpen] = useState(false);

  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [selectedComboId, setSelectedComboId] = useState<string | undefined>(undefined);
  const [comboSheetOpen, setComboSheetOpen] = useState(false);

  useEffect(() => {
    fetchCourseCatalog()
      .then(setCatalog)
      .catch(() => setCatalogError(true))
      .finally(() => setCatalogLoading(false));
  }, []);

  const allCourses = useMemo<Course[]>(
    () => catalog.map((c) => ({ id: c.id, name: c.name, area: c.area, totalHoles: c.nines.length * 9 })),
    [catalog],
  );

  // Nothing's selected until the catalog loads — default to the first club.
  useEffect(() => {
    if (!selectedCourseId && allCourses.length > 0) setSelectedCourseId(allCourses[0]!.id);
  }, [allCourses, selectedCourseId]);

  const q = query.trim().toLowerCase();
  const filteredCourses = useMemo(
    () => allCourses.filter((c) => !q || c.name.toLowerCase().includes(q) || c.area.toLowerCase().includes(q)),
    [allCourses, q],
  );

  const selectedCourse = allCourses.find((c) => c.id === selectedCourseId);
  const selectedCatalogCourse = catalog.find((c) => c.id === selectedCourseId);
  const comboOptions = selectedCatalogCourse?.combos ?? [];
  const selectedCombo = comboOptions.find((c) => c.id === selectedComboId) ?? comboOptions[0];

  useEffect(() => {
    setSelectedComboId(selectedCatalogCourse?.combos[0]?.id);
  }, [selectedCatalogCourse]);

  const startHoles = useMemo<StartHole[]>(() => {
    if (!selectedCatalogCourse || !selectedCombo) return [];
    return getComboHoles(selectedCatalogCourse, selectedCombo.id).map((h) => ({ n: h.n, meta: `Par ${h.par} · SI ${h.si}` }));
  }, [selectedCatalogCourse, selectedCombo]);

  // Keep the picked start hole valid as the selected course/combo changes.
  useEffect(() => {
    if (startHoles.length > 0 && !startHoles.some((h) => h.n === startHole)) setStartHole(startHoles[0]!.n);
  }, [startHoles, startHole]);

  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <IconButton icon={ChevronLeft} iconSize={20} onPress={() => navigation.goBack()} />
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Where are you playing?</Text>
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressSegment, styles.progressSegmentDone]} />
                <View style={styles.progressSegment} />
              </View>
              <Text style={styles.progressLabel}>Course &amp; holes</Text>
            </View>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <View style={styles.searchBar}>
            <Search size={18} color={colors.textDisabled} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search golf clubs"
              placeholderTextColor={colors.textDisabled}
              style={styles.searchInput}
            />
          </View>
          {catalogError ? <Text style={styles.catalogErrorText}>Couldn't load clubs — check your connection and try again.</Text> : null}
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {catalogLoading ? (
            <Text style={styles.noResultsText}>Loading clubs…</Text>
          ) : filteredCourses.length > 0 ? (
            <View>
              {filteredCourses.map((course) => (
                <CourseRow
                  key={course.id}
                  course={course}
                  selected={selectedCourseId === course.id}
                  onPress={() => setSelectedCourseId(course.id)}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.noResultsText}>{q ? 'No clubs match that search.' : 'No clubs available yet.'}</Text>
          )}

          {selectedCourse ? (
            <View style={styles.holesSection}>
              {selectedCatalogCourse && comboOptions.length > 0 ? (
                <>
                  <Text style={styles.holesSectionLabel}>Select course</Text>
                  <View style={styles.infoRow}>
                    <Info size={12} color={colors.textDisabled} />
                    <Text style={styles.infoText}>
                      {selectedCatalogCourse.name} has {selectedCatalogCourse.nines.length * 9} holes — pick which two nines
                    </Text>
                  </View>
                  <Pressable style={styles.ninePicker} onPress={() => setComboSheetOpen(true)}>
                    <View style={styles.ninePickerLeft}>
                      <Flag size={17} color={palette.green[600]} />
                      <Text style={styles.ninePickerLabel}>{selectedCombo?.label}</Text>
                    </View>
                    <ChevronDown size={18} color={colors.textDisabled} />
                  </Pressable>
                </>
              ) : null}

              <View style={styles.holesToPlayHeader}>
                <Text style={styles.holesSectionLabel}>Holes to play</Text>
                <Pressable style={styles.startHoleChipRow} onPress={() => setStartHoleSheetOpen(true)}>
                  <Text style={styles.startHoleChipLabel}>Starting from</Text>
                  <View style={styles.startHoleChip}>
                    <Text style={styles.startHoleChipValue}>Hole {startHole}</Text>
                    <ChevronDown size={14} color={colors.primary} />
                  </View>
                </Pressable>
              </View>
              <View style={styles.holesToggleRow}>
                <Pressable
                  style={[styles.holesToggle, holesToPlay === 9 && styles.holesToggleActive]}
                  onPress={() => setHolesToPlay(9)}
                >
                  <Text style={[styles.holesToggleLabel, holesToPlay === 9 && styles.holesToggleLabelActive]}>9 holes</Text>
                </Pressable>
                <Pressable
                  style={[styles.holesToggle, holesToPlay === 18 && styles.holesToggleActive]}
                  onPress={() => setHolesToPlay(18)}
                >
                  <Text style={[styles.holesToggleLabel, holesToPlay === 18 && styles.holesToggleLabelActive]}>18 holes</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label="Continue"
            variant="accent"
            size="lg"
            block
            disabled={!selectedCourse}
            onPress={() => {
              if (!selectedCourse || !selectedCombo) return;
              const summaryLine = `${holesToPlay} holes · ${selectedCombo.label}`;
              navigation.navigate('CreateGame', {
                courseId: selectedCourse.id,
                comboId: selectedCombo.id,
                holesToPlay,
                courseName: selectedCourse.name,
                summaryLine,
              });
            }}
            icon={<ArrowRight size={19} color={colors.textOnAccent} />}
            iconPosition="right"
          />
        </View>
      </SafeAreaView>

      <StartHoleSheet
        open={startHoleSheetOpen}
        holes={startHoles}
        selected={startHole}
        onConfirm={(n) => {
          setStartHole(n);
          setStartHoleSheetOpen(false);
        }}
        onClose={() => setStartHoleSheetOpen(false)}
      />

      <ComboPickerSheet
        open={comboSheetOpen}
        combos={comboOptions}
        selectedId={selectedCombo?.id}
        onConfirm={(id) => {
          setSelectedComboId(id);
          setComboSheetOpen(false);
        }}
        onClose={() => setComboSheetOpen(false)}
      />
    </View>
  );
}

function CourseRow({ course, selected, onPress }: { course: Course; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.courseRow, selected ? styles.courseRowSelected : styles.courseRowUnselected]}
      onPress={onPress}
    >
      <View style={[styles.courseIcon, selected && styles.courseIconSelected]}>
        <MapPin size={19} color={selected ? palette.white : colors.textDisabled} />
      </View>
      <View style={styles.courseInfo}>
        <Text style={[styles.courseName, selected && styles.courseNameSelected]}>{course.name}</Text>
        <View style={styles.courseMetaRow}>
          <Text style={styles.courseMetaText}>{course.area}</Text>
          <Text style={styles.courseMetaDot}>·</Text>
          <Text style={styles.courseMetaNumeric}>{course.totalHoles} holes</Text>
        </View>
      </View>
      {selected ? (
        <CircleCheckBig size={22} color={colors.primary} />
      ) : (
        <Circle size={22} color={palette.sand[400]} />
      )}
    </Pressable>
  );
}

const SHEET_OFFSCREEN_Y = 600;

function StartHoleSheet({
  open,
  holes,
  selected,
  onConfirm,
  onClose,
}: {
  open: boolean;
  holes: StartHole[];
  selected: number;
  onConfirm: (n: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);
  const [draftHole, setDraftHole] = useState(selected);

  useEffect(() => {
    if (open) {
      setDraftHole(selected);
      setMounted(true);
    }
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: motion.duration.slow,
      easing: Easing.bezier(...motion.easing.out),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, selected, progress]);

  if (!mounted) return null;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [SHEET_OFFSCREEN_Y, 0] });

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.scrim, { opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + spacing[5], transform: [{ translateY }] }]}>
          <View style={styles.sheetHandleWrap}>
            <View style={styles.sheetHandle} />
          </View>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Select starting hole</Text>
            <Pressable style={styles.sheetCloseButton} onPress={onClose}>
              <X size={17} color={colors.textMuted} />
            </Pressable>
          </View>
          <Text style={styles.sheetSubtitle}>Shotgun starts let your group tee off from any hole.</Text>
          <View style={styles.startHoleList}>
            {holes.map((hole) => {
              const on = hole.n === draftHole;
              return (
                <Pressable key={hole.n} style={styles.startHoleRow} onPress={() => setDraftHole(hole.n)}>
                  <View>
                    <Text style={[styles.startHoleRowLabel, on && styles.startHoleRowLabelActive]}>Hole {hole.n}</Text>
                    <Text style={styles.startHoleRowMeta}>{hole.meta}</Text>
                  </View>
                  {on ? (
                    <CircleCheckBig size={22} color={colors.primary} />
                  ) : (
                    <Circle size={22} color={palette.sand[400]} />
                  )}
                </Pressable>
              );
            })}
          </View>
          <Button label="Confirm" variant="accent" size="lg" block style={styles.sheetConfirmButton} onPress={() => onConfirm(draftHole)} />
        </Animated.View>
      </View>
    </Modal>
  );
}

function ComboPickerSheet({
  open,
  combos,
  selectedId,
  onConfirm,
  onClose,
}: {
  open: boolean;
  combos: NineCombo[];
  selectedId: string | undefined;
  onConfirm: (id: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);
  const [draftId, setDraftId] = useState(selectedId);

  useEffect(() => {
    if (open) {
      setDraftId(selectedId);
      setMounted(true);
    }
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: motion.duration.slow,
      easing: Easing.bezier(...motion.easing.out),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, selectedId, progress]);

  if (!mounted) return null;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [SHEET_OFFSCREEN_Y, 0] });

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.scrim, { opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + spacing[5], transform: [{ translateY }] }]}>
          <View style={styles.sheetHandleWrap}>
            <View style={styles.sheetHandle} />
          </View>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Select which nines</Text>
            <Pressable style={styles.sheetCloseButton} onPress={onClose}>
              <X size={17} color={colors.textMuted} />
            </Pressable>
          </View>
          <Text style={styles.sheetSubtitle}>Pick the two nines you're playing today.</Text>
          <View style={styles.startHoleList}>
            {combos.map((combo) => {
              const on = combo.id === draftId;
              return (
                <Pressable key={combo.id} style={styles.startHoleRow} onPress={() => setDraftId(combo.id)}>
                  <Text style={[styles.startHoleRowLabel, on && styles.startHoleRowLabelActive]}>{combo.label}</Text>
                  {on ? (
                    <CircleCheckBig size={22} color={colors.primary} />
                  ) : (
                    <Circle size={22} color={palette.sand[400]} />
                  )}
                </Pressable>
              );
            })}
          </View>
          <Button
            label="Confirm"
            variant="accent"
            size="lg"
            block
            style={styles.sheetConfirmButton}
            onPress={() => draftId && onConfirm(draftId)}
          />
        </Animated.View>
      </View>
    </Modal>
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
    gap: spacing[3],
    paddingHorizontal: screenGutter,
    paddingTop: screenGutter,
    paddingBottom: spacing[1],
  },
  headerTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
    marginTop: spacing[2],
  },
  progressTrack: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing[1] + 1,
  },
  progressSegment: {
    flex: 1,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.borderDefault,
  },
  progressSegmentDone: {
    backgroundColor: colors.primary,
  },
  progressLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    color: colors.primary,
  },
  searchWrap: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[2] + 2,
    paddingBottom: spacing[2],
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
  },
  searchInput: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 15,
    color: colors.textPrimary,
  },
  catalogErrorText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    marginTop: spacing[2],
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingBottom: spacing[6],
  },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  courseRowSelected: {
    backgroundColor: colors.surfaceBrandSoft,
    borderColor: colors.primary,
    ...shadows.sm,
  },
  courseRowUnselected: {
    backgroundColor: colors.surfaceCard,
    borderColor: colors.borderDefault,
  },
  courseIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md - 1,
    backgroundColor: colors.surfaceSunken,
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
    fontSize: 15,
    color: colors.textPrimary,
  },
  courseNameSelected: {
    color: colors.primary,
  },
  courseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 3,
    marginTop: spacing[1],
  },
  courseMetaText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
  },
  courseMetaDot: {
    fontSize: 12,
    color: colors.borderDefault,
  },
  courseMetaNumeric: {
    fontFamily: getFontFamily('numeric', '400'),
    fontSize: 12,
    color: colors.textDisabled,
  },
  noResultsText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: colors.textDisabled,
    textAlign: 'center',
    marginTop: spacing[6],
  },
  holesSection: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    marginTop: spacing[4] + 2,
    paddingTop: spacing[4],
  },
  holesSectionLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing[2] - 1,
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
  ninePicker: {
    height: 50,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3] + 3,
    marginBottom: spacing[4],
  },
  ninePickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
  },
  ninePickerLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 15,
    color: colors.textPrimary,
  },
  holesToPlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2] - 1,
  },
  startHoleChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
  },
  startHoleChipLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: colors.textSecondary,
  },
  startHoleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1,
    borderColor: palette.green[200],
    borderRadius: radius.pill,
    paddingVertical: spacing[1] - 1,
    paddingHorizontal: spacing[2] + 1,
  },
  startHoleChipValue: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.primary,
  },
  holesToggleRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  holesToggle: {
    flex: 1,
    height: 46,
    borderRadius: radius.md - 1,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holesToggleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadows.sm,
  },
  holesToggleLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: colors.textDisabled,
  },
  holesToggleLabelActive: {
    color: colors.textInverse,
  },
  footer: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[3],
    paddingBottom: spacing[5],
    backgroundColor: colors.surfacePage,
  },
  modalRoot: {
    flex: 1,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlayScrim,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surfaceCard,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: screenGutter,
    shadowColor: '#0E3A28',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 16,
  },
  sheetHandleWrap: {
    alignItems: 'center',
    paddingVertical: spacing[2] + 2,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderDefault,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 18,
    color: colors.textPrimary,
  },
  sheetCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSubtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    marginTop: spacing[2] + 1,
    marginBottom: spacing[1],
  },
  startHoleList: {
    marginTop: spacing[1],
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
  sheetConfirmButton: {
    marginTop: spacing[3] + 2,
  },
});
