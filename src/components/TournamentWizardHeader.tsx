import { ChevronLeft } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, getFontFamily, palette, radius, screenGutter, spacing } from '../theme/tokens';
import { IconButton } from './IconButton';

export type WizardStep = 'format' | 'course' | 'rules' | 'players';

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'format', label: '1 · Format' },
  { key: 'course', label: '2 · Course' },
  { key: 'rules', label: '3 · Rules' },
  { key: 'players', label: '4 · Players' },
];

type TournamentWizardHeaderProps = {
  step: WizardStep;
  onBack: () => void;
};

/**
 * The "Create a tournament" header shared by every S1–S4 wizard screen:
 * back chevron, title, and the 4-segment progress rail. Identical inline
 * markup was repeated per screen in the .dc.html source — built once here
 * since it's byte-for-byte the same across steps, only which step is
 * "current" changes.
 */
export function TournamentWizardHeader({ step, onBack }: TournamentWizardHeaderProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <View style={styles.row}>
      <IconButton icon={ChevronLeft} iconSize={20} onPress={onBack} />
      <View style={styles.titleGroup}>
        <Text style={styles.title}>Create a tournament</Text>
        <View style={styles.progressWrap}>
          <View style={styles.segmentRow}>
            {STEPS.map((s, i) => (
              <View key={s.key} style={[styles.segment, i <= currentIndex && styles.segmentDone]} />
            ))}
          </View>
          <View style={styles.labelRow}>
            {STEPS.map((s, i) => (
              <Text
                key={s.key}
                style={[
                  styles.label,
                  i === currentIndex ? styles.labelCurrent : i < currentIndex ? styles.labelDone : styles.labelUpcoming,
                ]}
              >
                {s.label}
              </Text>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: screenGutter,
    paddingTop: screenGutter,
    paddingBottom: spacing[2] + 2,
  },
  titleGroup: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  progressWrap: {
    marginTop: spacing[2],
  },
  segmentRow: {
    flexDirection: 'row',
    gap: spacing[1] + 1,
  },
  segment: {
    flex: 1,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.borderDefault,
  },
  segmentDone: {
    backgroundColor: colors.primary,
  },
  labelRow: {
    flexDirection: 'row',
    gap: spacing[1] + 1,
    marginTop: spacing[1] + 2,
  },
  label: {
    flex: 1,
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 10,
  },
  labelCurrent: {
    color: colors.primary,
  },
  labelDone: {
    color: palette.soon.labelDone,
  },
  labelUpcoming: {
    color: palette.soon.labelUpcoming,
  },
});
