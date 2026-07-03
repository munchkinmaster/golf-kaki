import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import type { AcePinAward } from '../data/trophies';
import { TIER_COLOR } from '../data/trophies';
import { colors, getFontFamily, palette } from '../theme/tokens';

const DEFAULT_SIZE = 18;

function AcePin({ award, size = DEFAULT_SIZE }: { award: AcePinAward; size?: number }) {
  const { tier, icon: Icon } = award;
  return (
    <View
      style={[
        styles.pin,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: TIER_COLOR[tier] },
      ]}
    >
      <Icon size={Math.round(size * 0.56)} color={palette.white} />
    </View>
  );
}

type AcePinRowProps = {
  awards: AcePinAward[];
  size?: number;
  max?: number;
  style?: StyleProp<ViewStyle>;
};

/** Up to `max` of a player's most-prized pins, inline — with a "+N" chip covering the rest. */
export function AcePinRow({ awards, size = DEFAULT_SIZE, max = 2, style }: AcePinRowProps) {
  if (awards.length === 0) return null;
  const shown = awards.slice(0, max);
  const overflow = awards.length - shown.length;

  return (
    <View style={[styles.row, style]}>
      {shown.map((award, i) => (
        <AcePin key={i} award={award} size={size} />
      ))}
      {overflow > 0 ? (
        <View style={[styles.overflowChip, { height: size, borderRadius: size / 2 }]}>
          <Text style={styles.overflowLabel}>+{overflow}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pin: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: palette.white,
    shadowColor: '#0E3A28',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  overflowChip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    backgroundColor: palette.sand[200],
  },
  overflowLabel: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 9,
    color: colors.textMuted,
  },
});
