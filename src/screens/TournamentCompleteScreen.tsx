import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronRight, Crown, Repeat, Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { formatToPar, shortCourseName } from '../components/MultiRoundLobby';
import { MultiRoundStandingsTable, RecapActions, RecapHero, TieBreakCard } from '../components/TournamentRecap';
import type { Course as CatalogCourse } from '../data/courses';
import { fetchCourseCatalog } from '../data/courses';
import { computeAggregateStandings, explainTieBreaks, findLowRound } from '../data/multiRound';
import { formatDayMonth, formatRoundDate } from '../data/roundDates';
import type { TournamentResults } from '../data/tournamentResults';
import { fetchTournamentResults } from '../data/tournamentResults';
import { fetchTournamentLobby } from '../data/tournaments';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../state/AuthContext';
import { colors, getFontFamily, palette, radius, screenGutter, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'TournamentComplete'>;

/**
 * MR13 — the final summary once the last round of a multi-round tournament
 * finishes: champion, final standings across every round, low round / best
 * gross, and each round's course (flagging any changed on the day).
 */
export function TournamentCompleteScreen({ navigation, route }: Props) {
  const { tournamentId } = route.params;
  const { session } = useAuth();
  const viewerId = session?.user.id;
  const [results, setResults] = useState<TournamentResults | null>(null);
  const [name, setName] = useState('');
  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [res, courses] = await Promise.all([fetchTournamentResults(tournamentId), fetchCourseCatalog()]);
      const firstMatch = res.rounds[0]?.matchId;
      const lobby = firstMatch ? await fetchTournamentLobby(tournamentId, firstMatch) : null;
      if (cancelled) return;
      setResults(res);
      setCatalog(courses);
      setName(lobby?.name ?? '');
    })().catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  if (loadError) {
    return (
      <View style={[styles.page, styles.centerFill]}>
        <Text style={styles.mutedText}>Couldn't load this tournament.</Text>
      </View>
    );
  }
  if (!results) {
    return (
      <View style={[styles.page, styles.centerFill]}>
        <Text style={styles.mutedText}>Loading…</Text>
      </View>
    );
  }

  const rounds = results.rounds;
  const rosterIds = results.roster.filter((p) => p.status === 'joined').map((p) => p.id);
  const rows = computeAggregateStandings(rosterIds, rounds, results.entries, results.tieBreakRule);
  const nameOf = (id: string) => results.roster.find((p) => p.id === id)?.name ?? '';
  const firstNameOf = (id: string) => nameOf(id).split(' ')[0] ?? '';
  const youSuffix = (id: string) => (id === viewerId ? ' (you)' : '');
  const champions = rows.filter((r) => r.rank === 1);
  const champion = champions[0];
  // Level totals split by the tie-break need saying so — otherwise a champion
  // on the same +16 as 2nd and 3rd reads as a bug.
  const tieBreaks = explainTieBreaks(rows, results.tieBreakRule, firstNameOf);
  const championOnCountback = champions.length === 1 && champion !== undefined && tieBreaks.decidedIds.has(champion.playerId);
  // Tournament rounds are always 18 holes (createTournamentMatch / setup_tournament_round).
  const holes = rounds.length * 18;

  const courseFor = (courseId: string | null, comboId: string | null) => {
    const course = catalog.find((c) => c.id === courseId);
    const combo = course?.combos.find((c) => c.id === comboId);
    return { course, label: course ? (combo && course.combos.length > 1 ? `${course.name} · ${combo.label}` : course.name) : '…' };
  };

  const lowRound = findLowRound(rosterIds, rounds, results.entries);
  // Best gross: lowest total gross among players who completed every round.
  const bestGross = rows
    .filter((r) => r.missedRounds.length === 0)
    .map((r) => {
      const cells = Object.values(r.rounds).filter((c): c is Extract<typeof c, { kind: 'played' }> => c.kind === 'played');
      const gross = cells.reduce((sum, c) => sum + c.gross, 0);
      const par = cells.reduce((sum, c) => sum + (c.nett - c.toPar), 0);
      return { playerId: r.playerId, gross, overPar: gross - par };
    })
    .sort((a, b) => a.gross - b.gross)[0];

  const firstDate = rounds[0]?.date;
  const lastDate = rounds[rounds.length - 1]?.date;

  function share() {
    if (!champion) return;
    const lines = rows.filter((r) => r.rank !== null).map((r) => `${r.rank}. ${nameOf(r.playerId)} ${formatToPar(r.totalToPar)}`);
    Share.share({ message: `${name} — final standings\n${lines.join('\n')}\n\nScored on Golf Kaki` }).catch(() => {});
  }

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <RecapHero
          overline="Tournament complete"
          title={name}
          subtitle={`${rounds.length} rounds · ${holes} holes${firstDate && lastDate ? ` · ${formatDayMonth(firstDate)} – ${formatDayMonth(lastDate)}` : ''}`}
          onClose={() => navigation.navigate('Home')}
        >
          {champion ? (
            <View style={styles.championCard}>
              <View style={styles.championAvatar}>
                <Text style={styles.championInitial}>{nameOf(champion.playerId)[0]?.toUpperCase() ?? '?'}</Text>
                <View style={styles.crownBadge}>
                  <Crown size={11} color={palette.white} />
                </View>
              </View>
              <View style={styles.championBody}>
                <Text style={styles.championOverline}>{champions.length > 1 ? 'Joint champions' : championOnCountback ? 'Champion · on countback' : 'Champion'}</Text>
                <Text style={styles.championName} numberOfLines={1}>
                  {champions.map((c) => `${firstNameOf(c.playerId)}${youSuffix(c.playerId)}`).join(' & ')}
                </Text>
              </View>
              <View style={styles.championScore}>
                <Text style={styles.championToPar}>{formatToPar(champion.totalToPar)}</Text>
                <Text style={styles.championNett}>{champion.totalNett} nett</Text>
              </View>
            </View>
          ) : null}
        </RecapHero>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>Final standings · nett</Text>
              <Text style={styles.sectionCaption}>{rosterIds.length} players</Text>
            </View>
            <MultiRoundStandingsTable
              rows={rows}
              roundIndexes={rounds.map((r) => r.index)}
              nameOf={nameOf}
              colorIndexOf={(id) => rosterIds.indexOf(id)}
              viewerId={viewerId}
              countbackIds={tieBreaks.decidedIds}
            />
          </View>

          <TieBreakCard notes={tieBreaks.notes} />

          <View style={styles.statRow}>
            <View style={styles.statTile}>
              <Text style={styles.statLabel}>Low round</Text>
              <Text style={styles.statValue}>{lowRound ? `${firstNameOf(lowRound.playerId)} · ${lowRound.nett}` : '–'}</Text>
              <Text style={styles.statMeta}>
                {lowRound
                  ? `R${lowRound.roundIndex} · ${(() => {
                      const r = rounds.find((x) => x.index === lowRound.roundIndex);
                      const { course } = courseFor(r?.courseId ?? null, r?.comboId ?? null);
                      return course ? shortCourseName(course.name) : '';
                    })()}`
                  : ''}
              </Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statLabel}>Best gross</Text>
              <Text style={styles.statValue}>{bestGross ? `${firstNameOf(bestGross.playerId)} · ${bestGross.gross}` : '–'}</Text>
              <Text style={styles.statMeta}>{bestGross ? `${formatToPar(bestGross.overPar)} over ${holes}` : ''}</Text>
            </View>
          </View>

          <View>
            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Rounds played</Text>
            <View style={styles.roundsCard}>
              {rounds.map((r, i) => (
                <Pressable
                  key={r.index}
                  style={[styles.roundRow, i > 0 && styles.roundRowDivider]}
                  disabled={!r.matchId}
                  onPress={() => r.matchId && navigation.navigate('TournamentScorecardGrid', { tournamentId, matchId: r.matchId })}
                >
                  <View style={styles.roundBadge}>
                    <Text style={styles.roundBadgeLabel}>{r.index}</Text>
                  </View>
                  <View style={styles.roundBody}>
                    <Text style={styles.roundName} numberOfLines={1}>
                      {courseFor(r.courseId, r.comboId).label}
                    </Text>
                    <View style={styles.roundMetaRow}>
                      <Text style={styles.roundMeta}>{formatRoundDate(r.date)}</Text>
                      {r.changedOnTheDay ? (
                        <View style={styles.changedTag}>
                          <Repeat size={10} color={palette.multiRound.required.text} />
                          <Text style={styles.changedTagLabel}>Changed on the day</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  {r.matchId ? <ChevronRight size={16} color={palette.soon.labelUpcoming} /> : null}
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>

        <RecapActions secondary="Share" secondaryIcon={<Share2 size={16} color={colors.primary} />} onSecondary={share} onDone={() => navigation.navigate('Home')} />
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
  championCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing[4],
    padding: spacing[3] + 2,
    backgroundColor: palette.multiRound.hero.tileFill,
    borderRadius: radius.lg,
  },
  championAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  championInitial: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 20,
    color: palette.white,
  },
  crownBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: palette.score.eagle,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  championBody: { flex: 1, minWidth: 0 },
  championOverline: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: palette.multiRound.hero.label,
  },
  championName: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 18,
    color: palette.white,
    marginTop: 1,
  },
  championScore: { alignItems: 'flex-end' },
  championToPar: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 26,
    color: palette.multiRound.timeline.done,
  },
  championNett: {
    fontFamily: getFontFamily('numeric', '400'),
    fontSize: 11,
    color: palette.multiRound.hero.label,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: screenGutter, paddingTop: spacing[4], paddingBottom: spacing[5], gap: spacing[5] },
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
  statRow: {
    flexDirection: 'row',
    gap: spacing[2] + 1,
  },
  statTile: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.lg - 2,
    padding: spacing[3] + 1,
  },
  statLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textDisabled,
  },
  statValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.textPrimary,
    marginTop: spacing[1],
  },
  statMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: 2,
  },
  roundsCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.lg - 2,
    paddingHorizontal: spacing[3] + 1,
  },
  roundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    minHeight: 52,
  },
  roundRowDivider: {
    borderTopWidth: 1,
    borderTopColor: palette.multiRound.divider,
  },
  roundBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1,
    borderColor: palette.multiRound.brandSoftBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBadgeLabel: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 12,
    color: colors.primary,
  },
  roundBody: { flex: 1, minWidth: 0 },
  roundName: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: colors.textPrimary,
  },
  roundMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: 2,
  },
  roundMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
  },
  changedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: palette.multiRound.required.fill,
    borderWidth: 1,
    borderColor: palette.multiRound.required.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing[2] - 2,
    paddingVertical: 1,
  },
  changedTagLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 9,
    color: palette.multiRound.required.text,
  },
});
