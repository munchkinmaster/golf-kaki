import { useRef } from 'react';
import type { ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, getFontFamily, layout, motion, radius, shadows, spacing } from '../theme/tokens';

export type ButtonVariant = 'accent' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  block?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const HEIGHT: Record<ButtonSize, number> = {
  sm: layout.controlSm,
  md: layout.controlMd,
  lg: layout.controlLg,
};

const PADDING_HORIZONTAL: Record<ButtonSize, number> = {
  sm: spacing[3],
  md: spacing[4],
  lg: spacing[5],
};

const FONT_SIZE: Record<ButtonSize, number> = {
  sm: 14,
  md: 16,
  lg: 18,
};

// "accent" is the one orange CTA per view; "secondary" is the standard fairway-green
// action; "ghost" is the soft brand-tint treatment the spec calls for on minor actions.
const VARIANT_STYLE: Record<ButtonVariant, { container: ViewStyle; text: { color: string } }> = {
  accent: {
    container: { backgroundColor: colors.accent, ...shadows.accent },
    text: { color: colors.textOnAccent },
  },
  secondary: {
    container: { backgroundColor: colors.primary },
    text: { color: colors.textInverse },
  },
  ghost: {
    container: { backgroundColor: colors.surfaceBrandSoft },
    text: { color: colors.textBrand },
  },
};

export function Button({
  label,
  onPress,
  variant = 'secondary',
  size = 'md',
  icon,
  iconPosition = 'left',
  block = false,
  disabled = false,
  style,
}: ButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.timing(scale, {
      toValue: value,
      duration: motion.duration.fast,
      easing: Easing.bezier(...motion.easing.out),
      useNativeDriver: true,
    }).start();
  };

  const variantStyle = VARIANT_STYLE[variant];

  return (
    <Animated.View style={[block && styles.block, { transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => animateTo(motion.pressScale)}
        onPressOut={() => animateTo(1)}
        style={[
          styles.base,
          { height: HEIGHT[size], paddingHorizontal: PADDING_HORIZONTAL[size] },
          variantStyle.container,
          disabled && styles.disabled,
          style,
        ]}
      >
        {icon && iconPosition === 'left' ? <View>{icon}</View> : null}
        {/* trailing icon adds width on one side only, pulling the label off true center —
            an identical hidden mirror on the other side balances it */}
        {icon && iconPosition === 'right' ? <View style={styles.hidden}>{icon}</View> : null}
        <Text
          style={[
            styles.label,
            { fontSize: FONT_SIZE[size], color: variantStyle.text.color },
          ]}
        >
          {label}
        </Text>
        {icon && iconPosition === 'right' ? <View>{icon}</View> : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: {
    width: '100%',
  },
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderRadius: radius.pill,
  },
  label: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  hidden: {
    opacity: 0,
  },
});
