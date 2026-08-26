import { Sparkles } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { getFontFamily, palette, radius, spacing } from '../theme/tokens';

/**
 * The orange "no handicaps" reminder shown across the System 36 creation flow
 * — the SY4 players step ("set"), the SY6 review step and its in-game
 * read-only lobby echo ("enter"). One shared component so the treatment can't
 * drift between the three surfaces; only the sentence changes per surface.
 */
export function System36NoHandicapCallout({ text }: { text: string }) {
  return (
    <View style={styles.callout}>
      <Sparkles size={16} color={palette.settledTile.value} style={styles.icon} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  callout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
    paddingVertical: spacing[2] + 3,
    paddingHorizontal: spacing[3] - 1,
    backgroundColor: palette.settledTile.fill,
    borderWidth: 1,
    borderColor: palette.settledTile.border,
    borderRadius: radius.md,
  },
  icon: {
    flexShrink: 0,
  },
  text: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: palette.settledTile.label,
    lineHeight: 17,
  },
});
