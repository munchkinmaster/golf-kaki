import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';

import { colors, motion, palette, radius } from '../theme/tokens';

const TRACK_WIDTH = 46;
const TRACK_HEIGHT = 28;
const THUMB = 22;
const INSET = (TRACK_HEIGHT - THUMB) / 2;

/**
 * On/off switch — fairway-green track, white thumb (MR11 "Who's playing").
 * Hand-rolled rather than RN's Switch so it looks the same on every
 * platform: react-native-web ignores thumbColor and paints its own teal.
 * The 44px tap target comes from the hit slop around the 28px track.
 */
export function Toggle({ value, onValueChange, accessibilityLabel }: { value: boolean; onValueChange: (value: boolean) => void; accessibilityLabel: string }) {
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: motion.duration.base,
      easing: Easing.bezier(...motion.easing.out),
      useNativeDriver: false,
    }).start();
  }, [value, progress]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [INSET, TRACK_WIDTH - THUMB - INSET] });
  const backgroundColor = progress.interpolate({ inputRange: [0, 1], outputRange: [colors.borderDefault, colors.primary] });

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[styles.track, { backgroundColor }]}>
        <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: palette.white,
    shadowColor: '#0E3A28',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
  },
});
