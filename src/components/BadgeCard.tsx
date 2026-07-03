import { Check, Clock, Lock } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import type { TrophyBadge } from '../data/trophies';
import { TIER_COLOR } from '../data/trophies';
import { colors, getFontFamily, palette, radius, spacing } from '../theme/tokens';

export function BadgeCard({ badge }: { badge: TrophyBadge }) {
  const { name, meta, icon: Icon, tier, state } = badge;
  const locked = state === 'locked';
  const pending = state === 'pending';
  const earned = state === 'earned';
  const tierColor = TIER_COLOR[tier];

  return (
    <View style={[styles.badgeCard, !earned && styles.badgeCardUnearned, locked && styles.badgeCardLocked]}>
      <View
        style={[
          styles.badgeMedal,
          earned && { backgroundColor: tierColor },
          pending && { borderColor: tierColor },
          locked && styles.badgeMedalLocked,
        ]}
      >
        {locked ? (
          <Lock size={22} color={colors.textDisabled} />
        ) : (
          <Icon size={pending ? 24 : 26} color={pending ? tierColor : palette.white} />
        )}
        {pending ? (
          <View style={[styles.badgeStatusDot, styles.badgeStatusDotPending]}>
            <Clock size={10} color={palette.white} />
          </View>
        ) : null}
        {earned ? (
          <View style={[styles.badgeStatusDot, styles.badgeStatusDotEarned]}>
            <Check size={11} color={palette.white} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.badgeName, locked && styles.badgeNameLocked]}>{name}</Text>
      <Text style={[styles.badgeMeta, pending && styles.badgeMetaPending]}>{meta}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeCard: {
    width: '31%',
    alignItems: 'center',
    gap: spacing[2] + 1,
    paddingTop: 15,
    paddingBottom: 13,
    paddingHorizontal: 8,
    borderRadius: radius.lg,
    marginBottom: spacing[3],
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  badgeCardUnearned: {
    backgroundColor: palette.sand[50],
    borderColor: colors.borderSubtle,
  },
  badgeCardLocked: {
    opacity: 0.72,
  },
  badgeMedal: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeMedalLocked: {
    backgroundColor: palette.sand[100],
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.borderDefault,
  },
  badgeStatusDot: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeStatusDotPending: {
    backgroundColor: colors.accent,
  },
  badgeStatusDotEarned: {
    backgroundColor: palette.green[700],
  },
  badgeName: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 12.5,
    lineHeight: 15,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  badgeNameLocked: {
    color: colors.textMuted,
  },
  badgeMeta: {
    fontFamily: getFontFamily('body', '500'),
    fontWeight: '500',
    fontSize: 10.5,
    color: colors.textMuted,
    textAlign: 'center',
  },
  badgeMetaPending: {
    color: colors.accent,
  },
});
