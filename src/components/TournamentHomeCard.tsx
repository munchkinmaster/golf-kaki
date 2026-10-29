import { ArrowRight, Hourglass, MapPin } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ActiveTournament } from '../data/tournamentHome';
import { colors, getFontFamily, palette, radius, shadows, spacing } from '../theme/tokens';
import { Card } from './Card';
import { formatToPar } from './MultiRoundLobby';

const SEGMENT_FILL: Record<ActiveTournament['timeline'][number], string> = {
  done: palette.multiRound.timeline.done,
  live: colors.accent,
  current: colors.accent,
  upcoming: palette.multiRound.timeline.upcoming,
};

/**
 * MR12 — the Home tournament card for an in-progress multi-round tournament:
 * where the round stands, the viewer's overall position, and one CTA that
 * depends on role and round state (see homeCardAction).
 */
export function TournamentHomeCard({ tournament, onAction }: { tournament: ActiveTournament; onAction: () => void }) {
  const { action, phase } = tournament;
  return (
    <View>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionLabel}>Tournament</Text>
        <Text style={[styles.rolePill, tournament.isOrganiser ? styles.rolePillOrganiser : styles.rolePillPlayer]}>{tournament.isOrganiser ? 'Organiser' : 'Player'}</Text>
      </View>
      <Card variant="inverse" watermark watermarkSize={120} padding={spacing[4]}>
        <View style={styles.topRow}>
          <Text style={styles.overline} numberOfLines={1}>
            {tournament.overline}
          </Text>
          <View style={styles.chip}>
            {phase === 'live' ? <View style={styles.liveDot} /> : null}
            <Text style={styles.chipLabel}>{tournament.chip}</Text>
          </View>
        </View>
        <View style={styles.mainRow}>
          <View style={styles.titleGroup}>
            <Text style={styles.name} numberOfLines={1}>
              {tournament.name}
            </Text>
            <View style={styles.courseRow}>
              <MapPin size={13} color={palette.multiRound.timeline.labelActive} />
              <Text style={styles.courseLine} numberOfLines={1}>
                {tournament.courseLine}
              </Text>
            </View>
          </View>
          {tournament.overall ? (
            <View style={styles.overall}>
              <Text style={[styles.overallToPar, tournament.overall.toPar > 0 && styles.overallToParOver]}>{formatToPar(tournament.overall.toPar)}</Text>
              <Text style={styles.overallPlace}>{tournament.overall.place}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.progressRow}>
          {tournament.timeline.map((state, i) => (
            <View key={i} style={[styles.segment, { backgroundColor: SEGMENT_FILL[state] }]} />
          ))}
        </View>
        {action === 'waitingForSetup' ? (
          <View style={styles.waiting}>
            <Hourglass size={15} color={palette.multiRound.timeline.labelActive} />
            <Text style={styles.waitingLabel} numberOfLines={1}>
              Waiting for {tournament.hostFirstName} to set up Round {tournament.round.index}
            </Text>
          </View>
        ) : (
          <Pressable style={[styles.cta, action === 'joinScoring' ? styles.ctaAccent : styles.ctaLight]} onPress={onAction}>
            <Text style={[styles.ctaLabel, action === 'joinScoring' && styles.ctaLabelAccent]}>
              {action === 'beginRound'
                ? `Begin Round ${tournament.round.index}`
                : action === 'joinScoring'
                  ? 'Join scoring'
                  : action === 'viewLeaderboard'
                    ? 'View leaderboard'
                    : 'Open lobby'}
            </Text>
            <ArrowRight size={16} color={action === 'joinScoring' ? palette.white : colors.primary} />
          </Pressable>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
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
  rolePill: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 10,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    overflow: 'hidden',
  },
  rolePillOrganiser: {
    color: colors.primary,
    backgroundColor: colors.surfaceBrandSoft,
    borderColor: palette.multiRound.brandSoftBorder,
  },
  rolePillPlayer: {
    color: colors.textSecondary,
    backgroundColor: colors.surfaceCard,
    borderColor: colors.borderDefault,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  overline: {
    flex: 1,
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: palette.orange[300],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
    backgroundColor: palette.multiRound.hero.tileFill,
    borderRadius: radius.pill,
    paddingHorizontal: spacing[2] + 1,
    paddingVertical: spacing[1],
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  chipLabel: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 11,
    color: palette.orange[300],
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[3],
    marginTop: spacing[2] + 2,
  },
  titleGroup: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 22,
    color: palette.white,
  },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
    marginTop: spacing[1],
  },
  courseLine: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: palette.multiRound.timeline.labelActive,
  },
  overall: {
    alignItems: 'flex-end',
  },
  overallToPar: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 20,
    color: palette.multiRound.timeline.done,
  },
  overallToParOver: {
    color: palette.white,
  },
  overallPlace: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    color: palette.multiRound.hero.label,
    marginTop: 3,
  },
  progressRow: {
    flexDirection: 'row',
    gap: spacing[1] + 1,
    marginTop: spacing[3] + 2,
  },
  segment: {
    flex: 1,
    height: 5,
    borderRadius: radius.pill,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    height: 44,
    marginTop: spacing[3],
    borderRadius: radius.pill,
  },
  ctaLight: {
    backgroundColor: palette.white,
  },
  ctaAccent: {
    backgroundColor: colors.accent,
    ...shadows.accent,
  },
  ctaLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: colors.primary,
  },
  ctaLabelAccent: {
    color: palette.white,
  },
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    height: 44,
    marginTop: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.multiRound.timeline.upcoming,
    backgroundColor: palette.multiRound.hero.tileFill,
  },
  waitingLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: palette.multiRound.timeline.labelActive,
  },
});
