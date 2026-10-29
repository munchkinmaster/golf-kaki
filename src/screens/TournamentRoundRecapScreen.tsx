import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Calendar, Flag, Info, List, MapPin, Trophy } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { HeroStatTiles, MultiRoundStandingsTable, RecapActions, RecapHero, TieBreakCard } from '../components/TournamentRecap';
import type { Course as CatalogCourse } from '../data/courses';
import { fetchCourseCatalog } from '../data/courses';
import { computeAggregateStandings, hasSharedPlace, positionSummary, sharedPlaceNote } from '../data/multiRound';
import { formatRoundDate } from '../data/roundDates';
import type { TournamentResults } from '../data/tournamentResults';
import { fetchTournamentResults } from '../data/tournamentResults';
import { fetchTournamentLobby } from '../data/tournaments';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../state/AuthContext';
import { colors, getFontFamily, palette, radius, screenGutter, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'TournamentRoundRecap'>;

/**
 * MR10 — shown when a non-final round of a multi-round tournament finishes
 * (TournamentFinishScreen hands over here): the viewer's round, where they
 * stand overall, the aggregate table so far, and what's up next. The final
 * round goes to MR13 (TournamentCompleteScreen) instead.
 */
export function TournamentRoundRecapScreen({ navigation, route }: Props) {
  const { tournamentId, matchId } = route.params;
  const { session } = useAuth();
  const viewerId = session?.user.id;
  const [results, setResults] = useState<TournamentResults | null>(null);
  const [name, setName] = useState('');
  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchTournamentResults(tournamentId), fetchTournamentLobby(tournamentId, matchId), fetchCourseCatalog()])
      .then(([res, lobby, courses]) => {
        if (cancelled) return;
        setResults(res);
        setName(lobby.name);
        setCatalog(courses);
      })
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [tournamentId, matchId]);

  const round = results?.rounds.find((r) => r.matchId === matchId);
  if (loadError || (results && !round)) {
    return (
      <View style={[styles.page, styles.centerFill]}>
        <Text style={styles.mutedText}>Couldn't load this round.</Text>
      </View>
    );
  }
  if (!results || !round) {
    return (
      <View style={[styles.page, styles.centerFill]}>
        <Text style={styles.mutedText}>Loading…</Text>
      </View>
    );
  }

  const count = results.rounds.length;
  // Standings AFTER this round — later rounds don't count yet, even if one's already been set up.
  const roundsSoFar = results.rounds.map((r) => (r.index <= round.index ? r : { ...r, status: 'planned' as const }));
  const rosterIds = results.roster.filter((p) => p.status === 'joined').map((p) => p.id);
  const rows = computeAggregateStandings(rosterIds, roundsSoFar, results.entries, results.tieBreakRule);
  const nameOf = (id: string) => results.roster.find((p) => p.id === id)?.name ?? '';
  const firstNameOf = (id: string) => nameOf(id).split(' ')[0] ?? '';
  const position = positionSummary(rows, viewerId, round.index, count - round.index, firstNameOf);
  const mine = viewerId ? results.entries[viewerId]?.[round.index] : undefined;
  const played = mine?.kind === 'played' ? mine : null;

  const courseLabel = (courseId: string | null, comboId: string | null) => {
    const course = catalog.find((c) => c.id === courseId);
    const combo = course?.combos.find((c) => c.id === comboId);
    return course ? (combo && course.combos.length > 1 ? `${course.name} · ${combo.label}` : course.name) : null;
  };
  const next = results.rounds.find((r) => r.index === round.index + 1);
  const nextLabel = next ? courseLabel(next.courseId ?? next.plannedCourseId, next.courseId ? next.comboId : next.plannedComboId) : null;

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <RecapHero
          overline={`Round ${round.index} of ${count} complete`}
          title={name}
          subtitle={[courseLabel(round.courseId, round.comboId), formatRoundDate(round.date)].filter(Boolean).join(' · ')}
          onClose={() => navigation.navigate('Home')}
        >
          <HeroStatTiles gross={played?.gross ?? null} nett={played?.nett ?? null} toPar={played?.toPar ?? null} />
        </RecapHero>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {position ? (
            <View style={styles.positionCard}>
              <View style={styles.positionIcon}>
                <Trophy size={20} color={colors.accent} />
              </View>
              <View style={styles.positionBody}>
                <Text style={styles.positionTitle}>{position.title}</Text>
                <Text style={styles.positionDetail}>{position.detail}</Text>
              </View>
            </View>
          ) : null}

          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>Overall · after Round {round.index}</Text>
              <Text style={styles.sectionCaption}>nett to par</Text>
            </View>
            <MultiRoundStandingsTable
              rows={rows}
              roundIndexes={roundsSoFar.filter((r) => r.status === 'done' || r.status === 'live').map((r) => r.index)}
              nameOf={nameOf}
              colorIndexOf={(id) => rosterIds.indexOf(id)}
              viewerId={viewerId}
            />
          </View>

          {/* MR10 is only ever a non-final round, so level totals are always still shared here. */}
          {hasSharedPlace(rows) ? <TieBreakCard title="Tied places" notes={[sharedPlaceNote(results.tieBreakRule)]} /> : null}

          {next ? (
            <View>
              <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Up next</Text>
              <View style={styles.nextCard}>
                <View style={styles.nextHeader}>
                  <Text style={styles.roundPill}>Round {next.index}</Text>
                  <View style={styles.nextDate}>
                    <Calendar size={13} color={colors.textMuted} />
                    <Text style={styles.nextDateLabel}>{formatRoundDate(next.date)}</Text>
                  </View>
                </View>
                <View style={styles.nextCourseRow}>
                  <View style={[styles.nextCourseTile, nextLabel ? styles.nextCourseTileSet : styles.nextCourseTileEmpty]}>
                    {nextLabel ? <Flag size={16} color={colors.accent} /> : <MapPin size={16} color={palette.soon.labelUpcoming} />}
                  </View>
                  <View style={styles.nextCourseBody}>
                    <Text style={styles.nextCourseName}>{nextLabel ?? 'Course on the day'}</Text>
                    <Text style={styles.nextCourseMeta}>{next.status === 'planned' ? (nextLabel ? 'Planned · confirm on the day' : 'Set by your organiser on the day') : 'Confirmed'}</Text>
                  </View>
                </View>
                <View style={styles.nextNote}>
                  <Info size={13} color={colors.textMuted} />
                  <Text style={styles.nextNoteText}>Your organiser confirms the course on the day. You'll get a notification when it's set.</Text>
                </View>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <RecapActions
          secondary="Scorecard"
          secondaryIcon={<List size={16} color={colors.primary} />}
          onSecondary={() => navigation.navigate('TournamentScorecardGrid', { tournamentId, matchId })}
          onDone={() => navigation.navigate('Home')}
        />
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
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: screenGutter, paddingTop: spacing[4], paddingBottom: spacing[5], gap: spacing[5] },
  positionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3] + 2,
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1.5,
    borderColor: palette.multiRound.brandSoftBorder,
    borderRadius: radius.lg - 2,
  },
  positionIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md - 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionBody: { flex: 1, minWidth: 0 },
  positionTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 16,
    color: colors.primary,
  },
  positionDetail: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  sectionLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 1.1,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  sectionLabelSpaced: { marginBottom: spacing[2] },
  sectionCaption: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
  },
  nextCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.lg - 2,
    padding: spacing[3] + 1,
    gap: spacing[3],
  },
  nextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundPill: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 13,
    color: colors.primary,
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1,
    borderColor: palette.multiRound.brandSoftBorder,
    borderRadius: radius.pill,
    paddingHorizontal: spacing[2] + 2,
    paddingVertical: spacing[1],
    overflow: 'hidden',
  },
  nextDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
  },
  nextDateLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: colors.textMuted,
  },
  nextCourseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 2,
  },
  nextCourseTile: {
    width: 36,
    height: 36,
    borderRadius: radius.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextCourseTileSet: { backgroundColor: colors.primary },
  nextCourseTileEmpty: {
    backgroundColor: palette.soon.surface,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.multiRound.emptyTileBorder,
  },
  nextCourseBody: { flex: 1, minWidth: 0 },
  nextCourseName: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: colors.textPrimary,
  },
  nextCourseMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: 1,
  },
  nextNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2] - 1,
    paddingVertical: spacing[2] + 1,
    paddingHorizontal: spacing[3],
    backgroundColor: colors.surfaceMutedTile,
    borderWidth: 1,
    borderColor: palette.sand[200],
    borderRadius: radius.md - 2,
  },
  nextNoteText: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    lineHeight: 15,
    color: colors.textMuted,
  },
});
