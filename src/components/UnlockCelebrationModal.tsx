import type { LucideIcon } from 'lucide-react-native';
import { Share2, Users } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colors, getFontFamily, motion, palette, radius, shadows, spacing } from '../theme/tokens';

const WATERMARK_SOURCE = require('../assets/golf-kaki-mark-white.png');
const MEDAL_SIZE = 148;

export type UnlockCelebration = {
  icon: LucideIcon;
  headline: string;
  description: string;
  shareMessage: string;
};

type Props = {
  celebration: UnlockCelebration | null;
  onDismiss: () => void;
};

/**
 * Full-screen "trophy unlocked" takeover — fires live from ScorecardScreen the
 * instant a Birdie/Par Streak threshold is crossed, per
 * design/design_handoff_golf_kaki/design-files/Golf Kaki Trophy Cabinet.dc.html's
 * "D · Unlock moment" spec. Nothing is attested yet at this point (that
 * happens later, see src/data/attestations.ts), so this replaces the design's
 * "Attested by …" pill with a prompt to go get one.
 */
export function UnlockCelebrationModal({ celebration, onDismiss }: Props) {
  const open = celebration !== null;
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);
  const [rendered, setRendered] = useState(celebration);

  useEffect(() => {
    if (open) {
      setRendered(celebration);
      setMounted(true);
    }
    const easing = open ? motion.easing.bounce : motion.easing.out;
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: open ? 400 : motion.duration.base,
      easing: Easing.bezier(easing[0], easing[1], easing[2], easing[3]),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, celebration, progress]);

  if (!mounted || !rendered) return null;

  const Icon = rendered.icon;
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  const onShare = () => {
    Share.share({ message: rendered!.shareMessage }).catch(() => {});
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={onDismiss}>
      <Animated.View style={[styles.root, { opacity: progress }]}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <RadialGradient id="unlockGlow" cx="50%" cy="12%" r="70%">
              <Stop offset="0%" stopColor={colors.scoreEagle} stopOpacity={0.42} />
              <Stop offset="100%" stopColor={colors.scoreEagle} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#unlockGlow)" />
        </Svg>
        <Image source={WATERMARK_SOURCE} style={styles.watermark} />

        <SafeAreaView style={styles.safeArea}>
          <View style={styles.center}>
            <Text style={styles.overline}>Trophy unlocked</Text>

            <Animated.View style={[styles.medal, { transform: [{ scale }] }]}>
              <Medal icon={Icon} />
            </Animated.View>

            <Text style={styles.headline}>{rendered.headline}</Text>
            <Text style={styles.description}>{rendered.description}</Text>

            <View style={styles.attestPill}>
              <Users size={14} color={palette.white} />
              <Text style={styles.attestPillLabel}>Ask a kaki to confirm it</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.shareButton} onPress={onShare}>
              <Share2 size={18} color={palette.white} />
              <Text style={styles.shareButtonLabel}>Share the moment</Text>
            </Pressable>
            <Pressable style={styles.continueButton} onPress={onDismiss}>
              <Text style={styles.continueButtonLabel}>Continue</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

/** Looping shine sweep — same intentional exception to the no-looping-animation rule as BragCardScreen's Medal. */
function Medal({ icon: BadgeIcon }: { icon: LucideIcon }) {
  const shine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(shine, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [shine]);

  const translateX = shine.interpolate({ inputRange: [0, 1], outputRange: [-MEDAL_SIZE * 1.2, MEDAL_SIZE * 2.2] });

  return (
    <View style={styles.medalInner}>
      <Animated.View pointerEvents="none" style={[styles.medalShine, { transform: [{ rotate: '8deg' }, { translateX }] }]} />
      <BadgeIcon size={64} color={palette.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  watermark: {
    position: 'absolute',
    left: '50%',
    top: '42%',
    width: 340,
    height: 340,
    marginLeft: -170,
    marginTop: -170,
    opacity: 0.06,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing[6],
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overline: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: palette.orange[300],
    marginBottom: spacing[5] + 2,
  },
  medal: {
    width: MEDAL_SIZE,
    height: MEDAL_SIZE,
    borderRadius: MEDAL_SIZE / 2,
  },
  medalInner: {
    width: MEDAL_SIZE,
    height: MEDAL_SIZE,
    borderRadius: MEDAL_SIZE / 2,
    backgroundColor: colors.scoreEagle,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.xl,
  },
  medalShine: {
    position: 'absolute',
    top: -30,
    bottom: -30,
    width: 46,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  headline: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 36,
    lineHeight: 40,
    color: palette.white,
    textAlign: 'center',
    marginTop: spacing[6],
  },
  description: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'center',
    marginTop: spacing[2] + 2,
    maxWidth: 280,
  },
  attestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3] + 2,
    borderRadius: radius.pill,
    marginTop: spacing[5],
  },
  attestPillLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12.5,
    color: palette.white,
  },
  actions: {
    gap: spacing[2] + 3,
    paddingBottom: spacing[5],
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2] + 2,
    height: 52,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    ...shadows.accent,
  },
  shareButtonLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 16,
    color: palette.white,
  },
  continueButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2],
  },
  continueButtonLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: 'rgba(255,255,255,0.66)',
  },
});
