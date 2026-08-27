import { Calculator, ShieldCheck } from 'lucide-react-native';
import { StyleSheet, Text } from 'react-native';

import { RuleCard, STABLEFORD_POINT_CHIPS } from './System36RuleCards';
import { colors, getFontFamily } from '../theme/tokens';

/**
 * The Stableford "points per hole vs nett par" reference card — SB1's format
 * screen (once Stableford is selected) and SB3's rules screen both show this
 * verbatim, per design_handoff_stableford_flow/README.md. Reuses the exact
 * same 6-value points curve and RuleCard shell as System 36's second
 * reference card (its "Stableford points per hole" card is this identical
 * table, just with System-36-specific surrounding copy) — see
 * System36RuleCards.tsx's export comments for why they're shared.
 */
export function StablefordPointsCard() {
  return (
    <RuleCard
      icon={Calculator}
      title="Points per hole vs nett par"
      chips={STABLEFORD_POINT_CHIPS}
      footerIcon={ShieldCheck}
      footer={
        <Text style={styles.footerText}>
          Strokes are applied first, then points scored against nett par.{' '}
          <Text style={styles.footerEmphasis}>One blow-up hole never wrecks your card.</Text>
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
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
