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

// Classic scorecard notation: circle = under par, square = over par,
// doubled ring = 2-or-more strokes off par. Par itself gets no ring.
const RING_WIDTH = 1.5;
const RING_GROWTH = 6; // outer ring's size delta for the doubled (eagle/double+) case
const SQUARE_RADIUS = 4;
const SQUARE_RADIUS_OUTER = 6;

export function ScoreBadge({ value, par, size = 32, style }: ScoreBadgeProps) {
  const diff = value - par;
  const under = diff < 0;
  const doubled = Math.abs(diff) >= 2;

  let color: string | undefined;
  if (diff <= -2) color = colors.scoreEagle;
  else if (diff === -1) color = colors.scoreBirdie;
  else if (diff === 1) color = colors.scoreBogey;
  else if (diff >= 2) color = colors.scoreDouble;

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {color && doubled ? (
        <Ring size={size + RING_GROWTH} color={color} round={under} radius={SQUARE_RADIUS_OUTER} />
      ) : null}
      {color ? <Ring size={size} color={color} round={under} radius={SQUARE_RADIUS} /> : null}
      <Text style={[styles.value, { fontSize: Math.round(size * 0.5), color: color ?? colors.textPrimary }]}>
        {value}
      </Text>
    </View>
  );
}

function Ring({ size, color, round, radius }: { size: number; color: string; round: boolean; radius: number }) {
  return (
    <View
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: round ? size / 2 : radius, borderColor: color },
      ]}
    />
  );
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
