import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { borderWidth, colors, radius, shadows } from '../theme/tokens';

type IconButtonProps = {
  icon: LucideIcon;
  size?: number;
  iconSize?: number;
  color?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** The circular back/settings/close button repeated in nearly every screen header. */
export function IconButton({
  icon: Icon,
  size = 40,
  iconSize = 18,
  color = colors.textSecondary,
  onPress,
  style,
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.base, { width: size, height: size, borderRadius: size / 2 }, style]}
    >
      <Icon size={iconSize} color={color} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceCard,
    borderWidth: borderWidth.thin,
    borderColor: colors.borderDefault,
    ...shadows.xs,
  },
});
