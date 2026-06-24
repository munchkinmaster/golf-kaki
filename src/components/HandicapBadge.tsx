import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, getFontFamily, getLetterSpacing, radius, shadows, spacing, tracking } from '../theme/tokens';

export type HandicapBadgeVariant = 'green' | 'orange';
export type HandicapBadgeSize = 'sm' | 'lg';

type HandicapBadgeProps = {
  value: number;
  label?: string;
  variant?: HandicapBadgeVariant;
  size?: HandicapBadgeSize;
  style?: StyleProp<ViewStyle>;
};

const VARIANT_STYLE: Record<HandicapBadgeVariant, { background: string; border: string; accent: string }> = {
  green: { background: colors.surfaceBrandSoft, border: colors.borderFocus, accent: colors.primary },
  orange: { background: colors.surfaceAccentSoft, border: colors.accentHover, accent: colors.textAccent },
};

const SIZE_CONFIG = {
  sm: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    gap: spacing[2],
    labelFontSize: 12,
    valueFontSize: 12,
    valueWeight: '600' as const,
    uppercaseLabel: false,
  },
  lg: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    gap: spacing[2],
    labelFontSize: 11,
    valueFontSize: 17,
    valueWeight: '700' as const,
    uppercaseLabel: true,
  },
};

export function HandicapBadge({ value, label = 'HCP', variant = 'green', size = 'sm', style }: HandicapBadgeProps) {
  const { background, border, accent } = VARIANT_STYLE[variant];
  const config = SIZE_CONFIG[size];

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: background,
          borderColor: border,
          paddingVertical: config.paddingVertical,
          paddingHorizontal: config.paddingHorizontal,
          gap: config.gap,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            fontSize: config.labelFontSize,
            textTransform: config.uppercaseLabel ? 'uppercase' : 'none',
            letterSpacing: config.uppercaseLabel ? getLetterSpacing(config.labelFontSize, tracking.wide) : 0,
          },
        ]}
      >
        {label}
      </Text>
      <Text style={[styles.value, { fontSize: config.valueFontSize, fontWeight: config.valueWeight, color: accent }]}>
        {value.toFixed(1)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
    ...shadows.xs,
  },
  label: {
    fontFamily: getFontFamily('body', '500'),
    fontWeight: '500',
    color: colors.textDisabled,
  },
  value: {
    fontFamily: getFontFamily('numeric', '600'),
    fontVariant: ['tabular-nums'],
  },
});
