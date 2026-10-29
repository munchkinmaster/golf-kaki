import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check, ChevronLeft, Flag, Info, MapPin, Repeat } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Button } from '../components/Button';
import type { CourseSelection } from '../components/CoursePicker';
import { IconButton } from '../components/IconButton';
import { Toggle } from '../components/Toggle';
import type { Course as CatalogCourse, TeeColor } from '../data/courses';
import { fetchCourseCatalog, getComboHoles } from '../data/courses';
import { computeCourseHandicap, computePlayingHandicap, fetchComboRating } from '../data/handicap';
import { formatRoundDate } from '../data/roundDates';
import type { TournamentResults } from '../data/tournamentResults';
import { fetchTournamentResults } from '../data/tournamentResults';
import type { TournamentLobby } from '../data/tournaments';
import { fetchHandicapIndexes, fetchTournamentLobby, setupTournamentRound } from '../data/tournaments';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../state/AuthContext';
import { colors, getFontFamily, getSolidAvatarColor, palette, radius, screenGutter, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'TournamentSetupRound'>;

/**
 * MR11 — the organiser confirms a later round on the day: the course (the
 * planned one, or changed for traffic / maintenance / weather) and who's
 * playing. No tees, handicaps or tee time here — tees and Play HC are set in
 * the lobby, where everyone sees the same screen. Confirm creates the
 * round's match (setupTournamentRound) and opens its lobby. Editable again
 * until the round's first score.
 */
export function TournamentSetupRoundScreen({ navigation, route }: Props) {
  const { tournamentId, roundIndex, selection: pickedSelection } = route.params;
  const { session } = useAuth();
  const viewerId = session?.user.id;
  const [results, setResults] = useState<TournamentResults | null>(null);
  const [round1, setRound1] = useState<TournamentLobby | null>(null);
  /** The round's current seats when re-editing an already set-up round (tees carry over). */
  const [existing, setExisting] = useState<TournamentLobby | null>(null);
  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [selection, setSelection] = useState<CourseSelection | null>(null);
  const [playing, setPlaying] = useState<Record<string, boolean>>({});
  const [rating, setRating] = useState<{ courseRating: number; slopeRating: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [res, courses] = await Promise.all([fetchTournamentResults(tournamentId), fetchCourseCatalog()]);
      const first = res.rounds[0]?.matchId;
      const thisRound = res.rounds.find((r) => r.index === roundIndex);
      if (!first || !thisRound) throw new Error('round not found');
      const [lobby1, current] = await Promise.all([
        fetchTournamentLobby(tournamentId, first),
        thisRound.matchId ? fetchTournamentLobby(tournamentId, thisRound.matchId) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      setResults(res);
      setCatalog(courses);
      setRound1(lobby1);
      setExisting(current);
      setSelection(
        (prev) =>
          prev ??
          (thisRound.matchId
            ? { courseId: thisRound.courseId, comboId: thisRound.comboId, defaultTee: thisRound.defaultTee ?? 'blue', startHole: thisRound.startHole }
            : { courseId: thisRound.plannedCourseId, comboId: thisRound.plannedComboId, defaultTee: thisRound.defaultTee ?? 'blue', startHole: 1 }),
      );
      const joined = res.roster.filter((p) => p.status === 'joined');
      setPlaying(Object.fromEntries(joined.map((p) => [p.id, current ? current.players.some((s) => s.id === p.id && s.status === 'joined') : true])));
    })().catch(() => {
      if (!cancelled) setLoadError(true);
    });
    return () => {
      cancelled = true;
    };
  }, [tournamentId, roundIndex]);

  // Back from the "Change" course picker.
  useEffect(() => {
    if (pickedSelection) setSelection(pickedSelection);
  }, [pickedSelection]);

  const course = catalog.find((c) => c.id === selection?.courseId);
  const combo = course?.combos.find((c) => c.id === selection?.comboId);
  const par = useMemo(() => (course && combo ? getComboHoles(course, combo.id).reduce((sum, h) => sum + h.par, 0) : null), [course, combo]);

  useEffect(() => {
    if (!course || !combo || !selection?.defaultTee) {
      setRating(null);
      return;
    }
    let cancelled = false;
    fetchComboRating(course.id, combo.id, selection.defaultTee)
      .then((r) => !cancelled && setRating(r))
      .catch(() => !cancelled && setRating(null));
    return () => {
      cancelled = true;
    };
  }, [course, combo, selection?.defaultTee]);

  if (loadError) {
    return (
      <View style={[styles.page, styles.centerFill]}>
        <Text style={styles.mutedText}>Couldn't load this round — go back and try again.</Text>
      </View>
    );
  }
  if (!results || !round1 || !selection) {
    return (
      <View style={[styles.page, styles.centerFill]}>
        <Text style={styles.mutedText}>Loading…</Text>
      </View>
    );
  }

  const thisRound = results.rounds.find((r) => r.index === roundIndex)!;
  const plannedCourse = catalog.find((c) => c.id === thisRound.plannedCourseId);
  const plannedCombo = plannedCourse?.combos.find((c) => c.id === thisRound.plannedComboId);
  const changedFromPlan = plannedCourse !== undefined && (selection.courseId !== thisRound.plannedCourseId || selection.comboId !== thisRound.plannedComboId);
  const roster = results.roster.filter((p) => p.status === 'joined');
  const playingIds = roster.filter((p) => playing[p.id]).map((p) => p.id);
  const canConfirm = Boolean(course && combo && selection.defaultTee) && playingIds.length > 0 && !saving;
  const allowancePct = round1.handicapAllowancePct;

  const openPicker = () =>
    navigation.navigate('TournamentRoundCourse', {
      tournamentId,
      roundIndex,
      selection,
      subtitle: `${round1.name} · ${formatRoundDate(thisRound.date)}`,
    });

  async function confirm() {
    if (!course || !combo || !selection) return;
    setSaving(true);
    setSaveError(null);
    try {
      const indexes = await fetchHandicapIndexes(playingIds);
      const teeFor = (id: string): TeeColor => existing?.players.find((s) => s.id === id)?.teeColor ?? selection.defaultTee ?? 'blue';
      const tees = [...new Set(playingIds.map(teeFor))];
      const ratings = Object.fromEntries(await Promise.all(tees.map(async (t) => [t, await fetchComboRating(course.id, combo.id, t)] as const)));
      const coursePar = getComboHoles(course, combo.id).reduce((sum, h) => sum + h.par, 0);
      const matchId = await setupTournamentRound({
        tournamentId,
        roundIndex,
        courseId: course.id,
        comboId: combo.id,
        startHole: selection.startHole,
        players: playingIds.map((id) => {
          const tee = teeFor(id);
          const r = ratings[tee];
          const index = indexes[id] ?? null;
          // Same Play HC chain as S4 / the lobby's tee sheet — recomputed from
          // THIS course's tee ratings, at the round's allowance.
          const playingHandicap =
            index !== null && r ? computePlayingHandicap(computeCourseHandicap(index, r.slopeRating, r.courseRating, coursePar), allowancePct) : 0;
          return { playerId: id, handicapIndex: index, teeColor: tee, playingHandicap };
        }),
      });
      navigation.replace('TournamentLobby', { tournamentId, matchId });
    } catch {
      setSaveError("Couldn't set up the round — check your connection and try again.");
      setSaving(false);
    }
  }

  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <IconButton icon={ChevronLeft} size={44} iconSize={20} onPress={() => navigation.goBack()} />
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Set up Round {roundIndex}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {round1.name} · {formatRoundDate(thisRound.date)}
            </Text>
          </View>
          <Text style={styles.hostPill}>Host</Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View>
            <Text style={styles.sectionLabel}>Course</Text>
            <View style={[styles.courseCard, course ? styles.courseCardSet : styles.courseCardRequired]}>
              <Pressable style={styles.courseRow} onPress={openPicker} accessibilityLabel="Change course">
                <View style={[styles.courseTile, course ? styles.courseTileSet : styles.courseTileRequired]}>
                  {course ? <Flag size={18} color={colors.accent} /> : <MapPin size={18} color={palette.multiRound.required.text} />}
                </View>
                <View style={styles.courseBody}>
                  <Text style={[styles.courseName, !course && styles.courseNameRequired]} numberOfLines={2}>
                    {course ? `${course.name} · ${course.area}` : 'Choose course'}
                  </Text>
                  {course ? (
                    <Text style={styles.courseMeta}>
                      {[combo && course.combos.length > 1 ? combo.label : null, par !== null ? `Par ${par}` : null, rating ? `CR ${rating.courseRating.toFixed(1)}` : null, rating ? `Slope ${rating.slopeRating}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  ) : (
                    <Text style={styles.courseMeta}>Required before you confirm</Text>
                  )}
                </View>
                <Text style={styles.changeLink}>{course ? 'Change' : 'Choose'}</Text>
              </Pressable>
              {changedFromPlan ? (
                <View style={styles.changedRow}>
                  <Repeat size={14} color={palette.multiRound.required.text} />
                  <Text style={styles.changedText}>
                    Changed from plan:{' '}
                    <Text style={styles.changedStrike}>
                      {plannedCourse!.name}
                      {plannedCombo && plannedCourse!.combos.length > 1 ? ` · ${plannedCombo.label}` : ''}
                    </Text>
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>Who’s playing</Text>
              <Text style={styles.sectionCaption}>
                {playingIds.length} of {roster.length}
              </Text>
            </View>
            <View style={styles.playersCard}>
              {roster.map((p, i) => {
                const on = playing[p.id] ?? false;
                return (
                  <View key={p.id} style={[styles.playerRow, i > 0 && styles.playerRowDivider]}>
                    <View style={[styles.avatar, { backgroundColor: on ? getSolidAvatarColor(i) : palette.multiRound.pending.avatarFill }]}>
                      <Text style={[styles.avatarLabel, !on && styles.avatarLabelOff]}>{p.name[0]?.toUpperCase() ?? '?'}</Text>
                    </View>
                    <View style={styles.playerBody}>
                      <Text style={[styles.playerName, !on && styles.playerNameOff]} numberOfLines={1}>
                        {p.name}
                        {p.id === viewerId ? ' (you)' : ''}
                      </Text>
                      {on ? null : <Text style={styles.dnsNote}>Not playing · will show DNS</Text>}
                    </View>
                    <Toggle
                      value={on}
                      onValueChange={(value) => setPlaying((prev) => ({ ...prev, [p.id]: value }))}
                      accessibilityLabel={`${p.name} is playing Round ${roundIndex}`}
                    />
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.note}>
            <Info size={15} color={palette.multiRound.note.icon} />
            <Text style={styles.noteText}>Editable until the first score is entered. Players are notified when you confirm. Tees and handicaps are set in the lobby.</Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
          <Button
            label={saving ? 'Setting up…' : 'Confirm & Next'}
            variant="accent"
            size="lg"
            block
            disabled={!canConfirm}
            onPress={confirm}
            icon={<Check size={19} color={colors.textOnAccent} />}
            iconPosition="right"
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surfacePage },
  safeArea: { flex: 1 },
  centerFill: { alignItems: 'center', justifyContent: 'center', padding: screenGutter },
  mutedText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: colors.textDisabled,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: screenGutter,
    paddingTop: screenGutter,
    paddingBottom: spacing[3],
  },
  headerTitleGroup: { flex: 1, minWidth: 0 },
  headerTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 21,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    marginTop: 2,
  },
  hostPill: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 11,
    color: colors.primary,
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1,
    borderColor: palette.multiRound.brandSoftBorder,
    borderRadius: radius.pill,
    paddingHorizontal: spacing[2] + 2,
    paddingVertical: spacing[1],
    overflow: 'hidden',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: screenGutter, paddingTop: spacing[2], paddingBottom: spacing[6], gap: spacing[5] },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 1.1,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing[2],
  },
  sectionCaption: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    marginBottom: spacing[2],
  },
  courseCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderRadius: radius.lg - 2,
    paddingHorizontal: spacing[3] + 1,
  },
  courseCardSet: { borderColor: colors.primary },
  courseCardRequired: { borderColor: colors.accent },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    minHeight: 44,
  },
  courseTile: {
    width: 38,
    height: 38,
    borderRadius: radius.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseTileSet: { backgroundColor: colors.primary },
  courseTileRequired: {
    backgroundColor: palette.multiRound.required.fill,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.multiRound.required.border,
  },
  courseBody: { flex: 1, minWidth: 0 },
  courseName: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: colors.textPrimary,
  },
  courseNameRequired: { color: palette.multiRound.required.text },
  courseMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: 2,
  },
  changeLink: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 13,
    color: colors.primary,
  },
  changedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3] - 2,
    borderTopWidth: 1,
    borderTopColor: palette.multiRound.divider,
  },
  changedText: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textMuted,
  },
  changedStrike: {
    color: palette.multiRound.required.text,
    textDecorationLine: 'line-through',
  },
  playersCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.lg - 2,
    paddingHorizontal: spacing[3] + 1,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 52,
    paddingVertical: spacing[2],
  },
  playerRowDivider: {
    borderTopWidth: 1,
    borderTopColor: palette.multiRound.divider,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 12,
    color: palette.white,
  },
  avatarLabelOff: { color: palette.soon.labelUpcoming },
  playerBody: { flex: 1, minWidth: 0 },
  playerName: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: colors.textPrimary,
  },
  playerNameOff: { color: palette.multiRound.pending.name },
  dnsNote: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: palette.multiRound.note.icon,
    marginTop: 1,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2] + 1,
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
  errorText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.statusDanger,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
});
