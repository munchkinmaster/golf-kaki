import type { ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { borderWidth, colors, radius, shadows, spacing } from '../theme/tokens';

export type CardVariant = 'surface' | 'inverse';

type CardProps = {
  children: ReactNode;
  variant?: CardVariant;
  padding?: number;
  /** Large, low-opacity brand emblem in the top-right corner — only meaningful on `inverse`. */
  watermark?: boolean;
  watermarkSize?: number;
  style?: StyleProp<ViewStyle>;
};

const WATERMARK_SOURCE = require('../assets/golf-kaki-mark-white.png');

export function Card({
  children,
  variant = 'surface',
  padding = spacing[4],
  watermark = false,
  watermarkSize = 150,
  style,
}: CardProps) {
  return (
    <View style={[styles.base, VARIANT_STYLE[variant], { padding }, style]}>
      {watermark ? (
        // Clipped on its own absolutely-positioned layer, not on `base` —
        // overflow:hidden on the same view as a shadow clips the shadow on iOS.
        <View style={styles.watermarkLayer} pointerEvents="none">
          <Image
            source={WATERMARK_SOURCE}
            style={{
              position: 'absolute',
              width: watermarkSize,
              height: watermarkSize,
              top: -watermarkSize * 0.19,
              right: -watermarkSize * 0.2,
              opacity: 0.1,
            }}
          />
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
  },
  watermarkLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.lg,
    overflow: 'hidden',
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
