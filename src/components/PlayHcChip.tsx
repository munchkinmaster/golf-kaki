import { Pencil } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { getFontFamily, palette } from '../theme/tokens';

/**
 * MR8 playing handicap chip — green when the app worked it out from the
 * player's index and tee, orange with a pencil when someone typed it in on the
 * lobby. The pencil is what tells the two apart without colour.
 */
export function PlayHcChip({ value, manual }: { value: number; manual: boolean }) {
  const tone = manual ? palette.multiRound.playHc.manual : palette.multiRound.playHc.auto;
  return (
    <View
      style={[styles.chip, { backgroundColor: tone.fill, borderColor: tone.border }]}
      accessibilityLabel={`Playing handicap ${value}, ${manual ? 'manual override' : 'automatic'}`}
    >
      <Text style={[styles.value, { color: tone.text }]}>{value}</Text>
      {manual ? <Pencil size={9} color={tone.text} /> : null}
    </View>
  );
}

/** The legend swatch for a chip variant — the chip's own fill and border, pencil on manual. */
export function PlayHcSwatch({ manual }: { manual: boolean }) {
  const tone = manual ? palette.multiRound.playHc.manual : palette.multiRound.playHc.auto;
  return (
    <View style={[styles.swatch, { backgroundColor: tone.fill, borderColor: tone.border }]}>
      {manual ? <Pencil size={7} color={tone.text} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 28,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  value: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
