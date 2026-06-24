import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, getFontFamily, spacing } from '../theme/tokens';

export type StatRowSize = 'sm' | 'lg';

type StatRowProps = {
  value: string | number;
  label: string;
  valueColor?: string;
  size?: StatRowSize;
  style?: StyleProp<ViewStyle>;
};

const VALUE_FONT_SIZE: Record<StatRowSize, number> = {
  sm: 16,
  lg: 22,
};

/**
 * A single stat cell (value above, label below) — lay several side by side
 * in a row (Profile's Rounds/Best/Wins, Recap's Out/In/Total) via flexbox.
 */
export function StatRow({ value, label, valueColor = colors.textPrimary, size = 'lg', style }: StatRowProps) {
  return (
    <View style={[styles.base, style]}>
      <Text style={[styles.value, { fontSize: VALUE_FONT_SIZE[size], color: valueColor }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    alignItems: 'center',
  },
  value: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing[1],
  },
});
