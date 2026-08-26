import { StyleSheet, Text, View } from 'react-native';

import { colors, getFontFamily, radius } from '../theme/tokens';

/**
 * One hole's skin swing in an expanded per-player breakdown (Leaderboard's
 * S9 and the post-game Finish recap both use this) — +N on a hole this
 * player won or shared (N = skins resolved that hole, ≥1 after a carry),
 * -N on a hole someone else resolved, 0 for a hole that WAS played but tied
 * with no swing (still carrying, split, or void), and `undefined` for a hole
 * nobody's reached yet — kept visually distinct from the tied "0" rather
 * than collapsing both into the same digit, since they mean very different
 * things ("nothing's happened here yet" vs "this hole resolved as a wash").
 */
export function SkinsHoleCell({ holeN, delta }: { holeN: number; delta: number | undefined }) {
  const played = delta !== undefined;
  const color = !played ? colors.textDisabled : delta > 0 ? colors.skinsWonText : delta < 0 ? colors.skinsLostText : colors.textSecondary;
  const bg = !played ? 'transparent' : delta > 0 ? colors.skinsWonFill : delta < 0 ? colors.skinsLostFill : colors.surfaceSunken;
  const label = !played ? '–' : delta > 0 ? `+${delta}` : String(delta);
  return (
    <View style={[styles.cell, { backgroundColor: bg }]}>
      <Text style={styles.num}>{holeN}</Text>
      <Text style={[styles.val, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    borderRadius: radius.xs + 2,
    alignItems: 'center',
    paddingVertical: 4,
  },
  num: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 8,
    color: colors.textDisabled,
  },
  val: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 12,
  },
});
