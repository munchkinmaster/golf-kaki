import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, getFontFamily, radius } from '../theme/tokens';

type ScoreCellProps = {
  /** Strokes taken on the hole — undefined for a not-yet-scored hole, which still draws the handicap-stroke dot(s) so a player can see ahead of time which holes they get a stroke on (just without the score badge's shape/color, since there's no diff-to-par yet). */
  value?: number;
  par: number;
  /** Handicap strokes this player receives on this hole — 0, 1, or 2 (course handicap can exceed 18, but strokesReceivedOnHole caps at 2 for any realistic playing handicap). Drawn as small green dots, top-right of the cell. */
  strokesReceived?: number;
  /** Overall cell footprint — the badge itself is drawn a couple px smaller, leaving room for the corner dots. Defaults to the grid's 27px per the design spec. */
  size?: number;
  style?: StyleProp<ViewStyle>;
};

const BADGE_INSET = 5; // cell size 27 -> 22px badge, per the design spec
const DOT_SIZE = 5;
const BORDER_WIDTH = 1.5;

/**
 * Stroke-play scorecard grid cell — the notation used by the tournament
 * flow's S8 grid and the Past Game Recap: circle for birdie-or-better,
 * plain for par, square for bogey, square for double-bogey-or-worse, plus
 * green handicap-stroke dot(s) at the top-right corner. Distinct from
 * ScoreBadge (the match-play ring badge) — see the `scoreCell` token comment
 * in theme/tokens.ts for why the two don't share a palette.
 */
export function ScoreCell({ value, par, strokesReceived = 0, size = 27, style }: ScoreCellProps) {
  const entered = value !== undefined;
  const diff = entered ? value - par : 0;
  const badgeSize = size - BADGE_INSET;

  let textColor: string = entered ? colors.scoreCellParText : colors.textDisabled;
  let borderColor: string | undefined;
  let shape: 'circle' | 'square' | 'plain' = 'plain';

  if (entered) {
    if (diff <= -1) {
      textColor = colors.scoreCellUnderText;
      borderColor = colors.scoreCellUnderBorder;
      shape = 'circle';
    } else if (diff === 1) {
      textColor = colors.scoreCellBogeyText;
      borderColor = colors.scoreCellBogeyBorder;
      shape = 'square';
    } else if (diff >= 2) {
      textColor = colors.scoreCellDoubleText;
      borderColor = colors.scoreCellDoubleBorder;
      shape = 'square';
    }
  }

  return (
    <View style={[{ width: size, height: size }, styles.container, style]}>
      <View
        style={[
          styles.badge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: shape === 'circle' ? badgeSize / 2 : shape === 'square' ? radius.xs + 2 : 0,
            borderWidth: shape === 'plain' ? 0 : BORDER_WIDTH,
            borderColor,
          },
        ]}
      >
        <Text style={[styles.value, { color: textColor, fontSize: Math.round(badgeSize * 0.5) }]}>{entered ? value : '–'}</Text>
      </View>
      {strokesReceived > 0 ? (
        <View style={styles.dotRow}>
          {Array.from({ length: Math.min(strokesReceived, 2) }).map((_, i) => (
            <View key={i} style={styles.dot} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontFamily: getFontFamily('numeric', '600'),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  dotRow: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    gap: 1,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: colors.scoreCellStrokeDot,
  },
});
