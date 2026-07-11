import { BadgeCheck } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Avatar } from './Avatar';
import { Card } from './Card';
import type { Attester } from '../data/attestations';
import type { BadgeTier } from '../data/trophies';
import { colors, getFontFamily, getPlayerColors, palette, spacing } from '../theme/tokens';

const FEATURED_MEDAL_SIZE = 60;

const TIER_LABEL: Record<BadgeTier, string> = {
  legendary: 'Legendary',
  epic: 'Epic',
  great: 'Great',
};

function formatAttestedBy(attesters: Attester[]): string {
  if (attesters.length === 0) return 'Confirmed';
  if (attesters.length === 1) return `Attested by ${attesters[0]!.name}`;
  if (attesters.length === 2) return `Attested by ${attesters[0]!.name} & ${attesters[1]!.name}`;
  return `Attested by ${attesters[0]!.name} & ${attesters.length - 1} more`;
}

type FeaturedTrophyCardProps = {
  badge: { name: string; icon: LucideIcon; tier: BadgeTier; metaText: string };
  /** Real kaki who vouched for this badge (src/data/attestations.ts's fetchAttesters) — empty means only the grandfathered self-attestation exists, not that nobody's confirmed it. */
  attesters: Attester[];
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
};

export function FeaturedTrophyCard({ badge, attesters, style, onPress }: FeaturedTrophyCardProps) {
  const { name, icon: Icon, tier, metaText } = badge;

  const card = (
    <Card variant="inverse" watermark padding={17} style={style}>
      <View style={styles.topRow}>
        <FeaturedMedal icon={Icon} />
        <View style={styles.info}>
          <Text style={styles.overline}>{TIER_LABEL[tier]}</Text>
          <Text style={styles.title}>{name}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{metaText}</Text>
          </View>
        </View>
      </View>
      <View style={styles.divider}>
        {attesters.length > 0 ? (
          <View style={styles.attesterStack}>
            {attesters.slice(0, 2).map((attester, i) => (
              <Avatar
                key={attester.name}
                initials={attester.initials}
                size={22}
                backgroundColor={getPlayerColors(i).background}
                color={getPlayerColors(i).color}
                style={[styles.attesterAvatar, i > 0 && styles.attesterAvatarOverlap]}
              />
            ))}
          </View>
        ) : null}
        <Text style={styles.attestedByText}>{formatAttestedBy(attesters)}</Text>
        <BadgeCheck size={15} color={palette.orange[300]} style={styles.attestedCheck} />
      </View>
    </Card>
  );

  return onPress ? <Pressable onPress={onPress}>{card}</Pressable> : card;
}

/** Keeps the dc.html's looping shine sweep — an intentional exception to the no-looping-animation rule, matching the Live badge pulse precedent on Home. */
function FeaturedMedal({ icon: Icon }: { icon: LucideIcon }) {
  const shine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shine, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [shine]);

  const translateX = shine.interpolate({
    inputRange: [0, 1],
    outputRange: [-FEATURED_MEDAL_SIZE * 1.2, FEATURED_MEDAL_SIZE * 2.2],
  });

  return (
    <View style={styles.medal}>
      <Animated.View pointerEvents="none" style={[styles.medalShine, { transform: [{ rotate: '8deg' }, { translateX }] }]} />
      <Icon size={32} color={palette.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4] - 1,
  },
  medal: {
    width: FEATURED_MEDAL_SIZE,
    height: FEATURED_MEDAL_SIZE,
    borderRadius: FEATURED_MEDAL_SIZE / 2,
    backgroundColor: colors.scoreEagle,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  medalShine: {
    position: 'absolute',
    top: -14,
    bottom: -14,
    width: 22,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  overline: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 10.5,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
    color: palette.orange[300],
  },
  title: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 21,
    lineHeight: 23,
    color: palette.white,
    marginTop: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
    marginTop: 5,
  },
  metaText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[3] + 1,
    paddingTop: spacing[3] + 1,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
  },
  attesterStack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 2,
  },
  attesterAvatar: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  attesterAvatarOverlap: {
    marginLeft: -7,
  },
  attestedByText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: 'rgba(255,255,255,0.82)',
  },
  attestedCheck: {
    marginLeft: 'auto',
  },
});
