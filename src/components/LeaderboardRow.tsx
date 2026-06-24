import { ChevronDown, ChevronUp, Crown } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Avatar } from './Avatar';
import { borderWidth, colors, getFontFamily, getLetterSpacing, palette, radius, shadows, spacing, tracking } from '../theme/tokens';

type LeaderboardRowProps = {
  rank: number;
  isLeader?: boolean;
  initials: string;
  avatarBackgroundColor?: string;
  avatarColor?: string;
  name: string;
  subLabel: string;
  subColor?: string;
  /** e.g. "3 UP", "AS", "+$18" — the meaning is game-mode specific, the row just renders it. */
  valueLabel: string;
  valueColor?: string;
  expanded?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function LeaderboardRow({
  rank,
  isLeader = false,
  initials,
  avatarBackgroundColor,
  avatarColor,
  name,
  subLabel,
  subColor = colors.textMuted,
  valueLabel,
  valueColor = colors.textPrimary,
  expanded = false,
  onPress,
  style,
}: LeaderboardRowProps) {
  const Chevron = expanded ? ChevronUp : ChevronDown;

  return (
    <Pressable style={[styles.base, style]} onPress={onPress}>
      <View style={styles.rank}>
        {isLeader ? <Crown size={20} color={colors.scoreEagle} /> : <Text style={styles.rankLabel}>{rank}</Text>}
      </View>
      <Avatar initials={initials} size={36} backgroundColor={avatarBackgroundColor} color={avatarColor} />
      <View style={styles.identity}>
        <Text style={styles.name}>{name}</Text>
        <Text style={[styles.sub, { color: subColor }]}>{subLabel}</Text>
      </View>
      <View style={styles.value}>
        <Text style={[styles.valueLabel, { color: valueColor }]}>{valueLabel}</Text>
        {isLeader ? <Text style={styles.leaderCaption}>Leader</Text> : null}
      </View>
      <Chevron size={16} color={palette.ink[300]} style={styles.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.surfaceCard,
    borderWidth: borderWidth.thin,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    ...shadows.xs,
  },
  rank: {
    width: 24,
    alignItems: 'center',
  },
  rankLabel: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.textPrimary,
  },
  sub: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    marginTop: 1,
  },
  value: {
    alignItems: 'flex-end',
  },
  valueLabel: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  leaderCaption: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 9,
    color: colors.scoreEagle,
    textTransform: 'uppercase',
    letterSpacing: getLetterSpacing(9, tracking.wider),
    marginTop: 2,
  },
  chevron: {
    marginLeft: spacing[1],
  },
});
