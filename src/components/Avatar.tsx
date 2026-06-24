import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, getFontFamily, shadows } from '../theme/tokens';

type AvatarProps = {
  initials: string;
  size?: number;
  backgroundColor?: string;
  color?: string;
  /** White ring + soft shadow, for avatars sitting directly on a colored surface (header, profile). */
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Avatar({
  initials,
  size = 44,
  backgroundColor = colors.surfaceBrandSoft,
  color = colors.primary,
  bordered = false,
  style,
}: AvatarProps) {
  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
        },
        bordered && { borderWidth: 2, borderColor: colors.surfaceCard, ...shadows.sm },
        style,
      ]}
    >
      <Text style={[styles.initials, { fontSize: Math.round(size * 0.37), color }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
  },
});
