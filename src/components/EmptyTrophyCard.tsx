import { CirclePlus, Trophy } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Card } from './Card';
import { colors, getFontFamily, palette, radius, shadows, spacing } from '../theme/tokens';

type EmptyTrophyCardProps = {
  onStartRound: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Profile's "nothing earned yet" state — replaces the Featured Trophy Card until the viewer's first badge lands. */
export function EmptyTrophyCard({ onStartRound, style }: EmptyTrophyCardProps) {
  return (
    <Card variant="inverse" watermark padding={19} style={[styles.card, style]}>
      <View style={styles.iconRing}>
        <Trophy size={26} color={palette.orange[300]} />
      </View>
      <Text style={styles.headline}>No trophies yet</Text>
      <Text style={styles.description}>
        Finish a round with your kaki to unlock your first badge. Every eagle, streak and milestone lands here.
      </Text>
      <Pressable style={styles.cta} onPress={onStartRound}>
        <CirclePlus size={17} color={palette.white} />
        <Text style={styles.ctaLabel}>Start a round</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
  },
  iconRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  headline: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 18,
    color: palette.white,
    textAlign: 'center',
  },
  description: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: spacing[1] + 1,
    maxWidth: 230,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    height: 42,
    paddingHorizontal: spacing[5] + 2,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    marginTop: spacing[3] + 3,
    ...shadows.accent,
  },
  ctaLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: palette.white,
  },
});
