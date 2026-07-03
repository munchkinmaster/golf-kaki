import { BadgeCheck, MapPin } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Avatar } from './Avatar';
import { Card } from './Card';
import { colors, getFontFamily, getPlayerColors, palette, spacing } from '../theme/tokens';

const FEATURED_MEDAL_SIZE = 60;

type FeaturedTrophyCardProps = {
  badge: { name: string; icon: LucideIcon; location: string; attestedBy: string };
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
};

export function FeaturedTrophyCard({ badge, style, onPress }: FeaturedTrophyCardProps) {
  const { name, icon: Icon, location, attestedBy } = badge;

  const card = (
    <Card variant="inverse" watermark padding={17} style={style}>
      <View style={styles.topRow}>
        <FeaturedMedal icon={Icon} />
        <View style={styles.info}>
          <Text style={styles.overline}>Legendary · latest</Text>
          <Text style={styles.title}>{name}</Text>
          <View style={styles.metaRow}>
            <MapPin size={12} color="rgba(255,255,255,0.7)" />
            <Text style={styles.metaText}>{location}</Text>
          </View>
        </View>
      </View>
      <View style={styles.divider}>
        <View style={styles.attesterStack}>
          <Avatar
            initials="MK"
            size={22}
            backgroundColor={getPlayerColors(0).background}
            color={getPlayerColors(0).color}
            style={styles.attesterAvatar}
          />
          <Avatar
            initials="JL"
            size={22}
            backgroundColor={getPlayerColors(1).background}
            color={getPlayerColors(1).color}
            style={[styles.attesterAvatar, styles.attesterAvatarOverlap]}
          />
        </View>
        <Text style={styles.attestedByText}>Attested by {attestedBy}</Text>
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
