import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { borderWidth, colors, radius, shadows, spacing } from '../theme/tokens';

export type CardVariant = 'surface' | 'inverse';

type CardProps = {
  children: ReactNode;
  variant?: CardVariant;
  padding?: number;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, variant = 'surface', padding = spacing[4], style }: CardProps) {
  return <View style={[styles.base, VARIANT_STYLE[variant], { padding }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
  },
});

const VARIANT_STYLE: Record<CardVariant, ViewStyle> = {
  surface: {
    backgroundColor: colors.surfaceCard,
    borderWidth: borderWidth.thin,
    borderColor: colors.borderSubtle,
    ...shadows.xs,
  },
  inverse: {
    backgroundColor: colors.surfaceInverse,
    ...shadows.md,
  },
};
