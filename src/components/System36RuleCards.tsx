import { Calculator, Flag, Target, Trophy } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, getFontFamily, palette, radius, shadows, spacing } from '../theme/tokens';

/**
 * The two System 36 "how points work" reference cards, shown verbatim on the
 * SY1 format screen (once System 36 is picked) and the SY6 lobby — one shared
 * component so the two can't drift, per design_handoff_system36/README.md's
 * SY3 note. Purely explanatory: no state, no interaction.
 *
 * Card 1 (System 36 points per hole) is the 2/1/0 gross table that DERIVES
 * the handicap; card 2 (Stableford points per hole) is the nett table that
 * DECIDES the win. The two totals do different jobs and the copy keeps them
 * distinct — see the README's "The UI must never conflate them."
 */

type Chip = { value: string; label: string; chip: (typeof palette.scoreChip)[keyof typeof palette.scoreChip] };

const S36_POINT_CHIPS: Chip[] = [
  { value: '2', label: 'Par or better', chip: palette.scoreChip.par },
  { value: '1', label: 'Bogey', chip: palette.scoreChip.bogey },
  { value: '0', label: 'Double+', chip: palette.scoreChip.double },
];

const STABLEFORD_POINT_CHIPS: Chip[] = [
  { value: '5', label: 'Albatross', chip: palette.scoreChip.albatross },
  { value: '4', label: 'Eagle', chip: palette.scoreChip.eagle },
  { value: '3', label: 'Birdie', chip: palette.scoreChip.birdie },
  { value: '2', label: 'Par', chip: palette.scoreChip.par },
  { value: '1', label: 'Bogey', chip: palette.scoreChip.bogey },
  { value: '0', label: 'Double+', chip: palette.scoreChip.double },
];

export function System36RuleCards() {
  return (
    <View style={styles.stack}>
      <RuleCard
        icon={Calculator}
        title="System 36 points per hole"
        chips={S36_POINT_CHIPS}
        footerIcon={Target}
        footer={
          <Text style={styles.footerText}>
            Add up your points, then <Text style={styles.footerEmphasis}>handicap = 36 − points</Text> — your handicap for the round.
          </Text>
        }
      />
      <RuleCard
        icon={Flag}
        title="Stableford points per hole"
        chips={STABLEFORD_POINT_CHIPS}
        footerIcon={Trophy}
        footer={
          <Text style={styles.footerText}>
            Scored on your <Text style={styles.footerEmphasis}>nett</Text> per hole once your handicap is set. Most points wins.
          </Text>
        }
      />
    </View>
  );
}

function RuleCard({
  icon: Icon,
  title,
  chips,
  footerIcon: FooterIcon,
  footer,
}: {
  icon: typeof Calculator;
  title: string;
  chips: Chip[];
  footerIcon: typeof Target;
  footer: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Icon size={15} color={colors.primary} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <View style={styles.chipGrid}>
        {chips.map((c) => (
          <View key={c.label} style={[styles.chip, { backgroundColor: c.chip.fill, borderColor: c.chip.border }]}>
            <Text style={[styles.chipValue, { color: c.chip.text }]}>{c.value}</Text>
            <Text style={styles.chipLabel}>{c.label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.footerRow}>
        <FooterIcon size={14} color={palette.scoreCell.strokeDot} style={styles.footerIcon} />
        {footer}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing[3],
  },
  card: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.lg,
    padding: spacing[3] + 1,
    ...shadows.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] - 1,
    marginBottom: spacing[3] - 1,
  },
  cardTitle: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.7,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2] - 1,
  },
  chip: {
    // Three per row: (100% − 2 gaps) / 3. gap is spacing[2]-1 = 7px.
    flexBasis: '31%',
    flexGrow: 1,
    borderWidth: 1.5,
    borderRadius: radius.md - 1,
    paddingVertical: spacing[2] + 2,
    alignItems: 'center',
  },
  chipValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 22,
    lineHeight: 24,
  },
  chipLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 3,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2] - 1,
    marginTop: spacing[3] - 1,
    paddingTop: spacing[3] - 1,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  footerIcon: {
    marginTop: 1,
  },
  footerText: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  footerEmphasis: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    color: colors.primary,
  },
});
