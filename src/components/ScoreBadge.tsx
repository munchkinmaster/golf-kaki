import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, getFontFamily } from '../theme/tokens';

type ScoreBadgeProps = {
  /** Strokes taken on the hole. */
  value: number;
  par: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

// Classic scorecard notation: circle = birdie, doubled ring = eagle or
// better. Par, bogey, and worse get no ring.
const RING_WIDTH = 1.5;
const RING_GROWTH = 6; // outer ring's size delta for the doubled (eagle) case

export function ScoreBadge({ value, par, size = 32, style }: ScoreBadgeProps) {
  const diff = value - par;
  const eagleOrBetter = diff <= -2;
  const birdie = diff === -1;

  let color: string | undefined;
  if (eagleOrBetter) color = colors.scoreEagle;
  else if (birdie) color = colors.scoreBirdie;

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {color && eagleOrBetter ? <Ring size={size + RING_GROWTH} color={color} /> : null}
      {color ? <Ring size={size} color={color} /> : null}
      <Text style={[styles.value, { fontSize: Math.round(size * 0.5), color: color ?? colors.textPrimary }]}>
        {value}
      </Text>
    </View>
  );
}

function Ring({ size, color }: { size: number; color: string }) {
  return <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderColor: color }]} />;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: RING_WIDTH,
  },
  value: {
    fontFamily: getFontFamily('numeric', '600'),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
