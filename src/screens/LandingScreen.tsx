import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Flag } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';

import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../state/AuthContext';
import {
  colors,
  getFontFamily,
  getLetterSpacing,
  motion,
  palette,
  radius,
  screenGutter,
  spacing,
  tracking,
} from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Landing'>;

const WATERMARK_SOURCE = require('../assets/golf-kaki-mark-white.png');
const WATERMARK_SIZE = 330;

export function LandingScreen({ navigation }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const { signInWithGoogle, signingIn } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const animateTo = (value: number) => {
    Animated.timing(scale, {
      toValue: value,
      duration: motion.duration.fast,
      easing: Easing.bezier(...motion.easing.out),
      useNativeDriver: true,
    }).start();
  };

  async function handleContinue() {
    setError(null);
    try {
      const success = await signInWithGoogle();
      if (success) navigation.replace('Home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again.');
    }
  }

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          {/* Approximates the spec's radial-gradient(120% 80% at 50% 0%, ...) — SVG's
              radialGradient is circular, so an anisotropic gradientTransform stretches
              it to the same wide, top-anchored ellipse. */}
          <RadialGradient id="landingGlow" cx="50%" cy="0%" r="65%" gradientTransform="matrix(1.5 0 0 1 -0.25 0)">
            <Stop offset="0%" stopColor={palette.green[400]} stopOpacity={0.35} />
            <Stop offset="100%" stopColor={palette.green[400]} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#landingGlow)" />
      </Svg>
      <Image
        source={WATERMARK_SOURCE}
        style={[
          styles.watermark,
          { width: WATERMARK_SIZE, height: WATERMARK_SIZE, marginLeft: -WATERMARK_SIZE / 2, marginTop: -WATERMARK_SIZE / 2 },
        ]}
      />
      <View style={[styles.decorCircle, { width: 420, height: 420, right: -70, top: 120 }]} />
      <View style={[styles.decorCircle, { width: 340, height: 340, left: -90, bottom: 60 }]} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.iconTile}>
            <Flag size={46} color={colors.accent} strokeWidth={2} />
          </View>
          <Text style={styles.overline}>Track score · Add fun</Text>
          <Text style={styles.headline}>Golf Kaki</Text>
          <Text style={styles.subhead}>
            Keep score, hand out strokes, and settle the teh tarik — all in one weekend round.
          </Text>
        </View>

        <View style={styles.footer}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Animated.View style={{ transform: [{ scale }] }}>
            <Pressable
              onPress={handleContinue}
              onPressIn={() => animateTo(motion.pressScale)}
              onPressOut={() => animateTo(1)}
              disabled={signingIn}
              style={[styles.googleButton, signingIn && styles.googleButtonDisabled]}
            >
              {signingIn ? (
                <ActivityIndicator size="small" color={colors.textPrimary} />
              ) : (
                <View style={styles.googleBadge}>
                  <Text style={styles.googleG}>G</Text>
                </View>
              )}
              <Text style={styles.googleLabel}>{signingIn ? 'Signing in…' : 'Continue with Google'}</Text>
            </Pressable>
          </Animated.View>
          <Text style={styles.legal}>
            By continuing you agree to the{'\n'}Terms &amp; Privacy Policy
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.primary,
    overflow: 'hidden',
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  watermark: {
    position: 'absolute',
    left: '50%',
    top: '45%',
    opacity: 0.05,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[7],
  },
  iconTile: {
    width: 96,
    height: 96,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[7],
  },
  overline: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: getLetterSpacing(11, tracking.widest),
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
    marginBottom: spacing[4] - 2,
  },
  headline: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 42,
    lineHeight: 44,
    color: palette.white,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subhead: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    maxWidth: 250,
    marginTop: spacing[4],
  },
  footer: {
    paddingHorizontal: screenGutter + 10,
    paddingBottom: spacing[9],
  },
  errorText: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: palette.orange[300],
    textAlign: 'center',
    marginBottom: spacing[3],
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    height: 54,
    backgroundColor: palette.white,
    borderRadius: radius.pill,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 6,
  },
  googleButtonDisabled: {
    opacity: 0.7,
  },
  googleBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleG: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: '#4285F4',
  },
  googleLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 16,
    color: colors.textPrimary,
  },
  legal: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing[5] - 2,
  },
});
