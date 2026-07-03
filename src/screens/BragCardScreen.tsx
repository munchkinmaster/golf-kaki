import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BadgeCheck, Calendar, ChevronLeft, Download, Flag, MapPin, Share2 } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, Share, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Avatar } from '../components/Avatar';
import { IconButton } from '../components/IconButton';
import { BRAG_CARD } from '../data/trophies';
import type { RootStackParamList } from '../navigation/types';
import { colors, getFontFamily, getPlayerColors, palette, radius, screenGutter, shadows, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'BragCard'>;

const WATERMARK_SOURCE = require('../assets/golf-kaki-mark-white.png');
const MEDAL_SIZE = 128;

const { name, icon: Icon, tagline, player, statValue, statLabel, course, hole, date, year, attestedBy } = BRAG_CARD;

export function BragCardScreen({ navigation }: Props) {
  const onShare = () => {
    Share.share({
      message: `${name} at ${course}! ${tagline} — Golf Kaki: track score · add fun.`,
    }).catch(() => {});
  };

  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <IconButton icon={ChevronLeft} iconSize={20} onPress={() => navigation.goBack()} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.hero}>
              <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
                <Defs>
                  <RadialGradient id="bragGlow" cx="50%" cy="6%" r="65%" gradientTransform="matrix(1.4 0 0 1 -0.2 0)">
                    <Stop offset="0%" stopColor={colors.scoreEagle} stopOpacity={0.4} />
                    <Stop offset="100%" stopColor={colors.scoreEagle} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#bragGlow)" />
              </Svg>
              <Image source={WATERMARK_SOURCE} style={styles.heroWatermark} />

              <View style={styles.heroTopRow}>
                <View style={styles.brandRow}>
                  <Flag size={16} color={palette.white} />
                  <Text style={styles.brandLabel}>Golf Kaki</Text>
                </View>
                <View style={styles.tierPill}>
                  <Text style={styles.tierPillLabel}>Legendary</Text>
                </View>
              </View>

              <View style={styles.medalWrap}>
                <Medal icon={Icon} />
              </View>

              <Text style={styles.badgeName}>{name}</Text>
              <Text style={styles.tagline}>{tagline}</Text>
            </View>

            <View style={styles.body}>
              <View style={styles.playerRow}>
                <View style={styles.playerAvatarRing}>
                  <Avatar initials={player.initials} size={50} bordered />
                </View>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{player.name}</Text>
                  <View style={styles.hcpRow}>
                    <Text style={styles.hcpLabel}>HCP</Text>
                    <Text style={styles.hcpValue}>{player.handicap.toFixed(1)}</Text>
                  </View>
                </View>
                <View style={styles.statBlock}>
                  <Text style={styles.statValue}>{statValue}</Text>
                  <Text style={styles.statLabel}>{statLabel}</Text>
                </View>
              </View>

              <View style={styles.contextRow}>
                <ContextItem icon={MapPin} value={course} label="Course" />
                <View style={styles.contextDivider} />
                <ContextItem icon={Flag} value={hole} label="Hole" numeric />
                <View style={styles.contextDivider} />
                <ContextItem icon={Calendar} value={date} label={year} />
              </View>

              <View style={styles.attestRow}>
                <View style={styles.attesterStack}>
                  <Avatar
                    initials="MK"
                    size={26}
                    backgroundColor={getPlayerColors(0).background}
                    color={getPlayerColors(0).color}
                    style={styles.attesterAvatar}
                  />
                  <Avatar
                    initials="JL"
                    size={26}
                    backgroundColor={getPlayerColors(1).background}
                    color={getPlayerColors(1).color}
                    style={[styles.attesterAvatar, styles.attesterAvatarOverlap]}
                  />
                </View>
                <View style={styles.attestTextWrap}>
                  <Text style={styles.attestedByText}>Attested by {attestedBy}</Text>
                  <Text style={styles.attestSubText}>Your fourball confirmed it</Text>
                </View>
                <BadgeCheck size={20} color={palette.green[700]} />
              </View>

              <Text style={styles.footerTagline}>Golf Kaki · Track score · Add fun</Text>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <Pressable style={styles.shareButton} onPress={onShare}>
              <Share2 size={18} color={palette.white} />
              <Text style={styles.shareButtonLabel}>Share to group chat</Text>
            </Pressable>
            <Pressable style={styles.downloadButton}>
              <Download size={20} color={colors.primary} />
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** Keeps the spec's looping shine sweep — an intentional exception to the no-looping-animation rule, matching the Trophy Cabinet precedent. */
function Medal({ icon: BadgeIcon }: { icon: typeof Icon }) {
  const shine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shine, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [shine]);

  const translateX = shine.interpolate({
    inputRange: [0, 1],
    outputRange: [-MEDAL_SIZE * 1.2, MEDAL_SIZE * 2.2],
  });

  return (
    <View style={styles.medal}>
      <Animated.View pointerEvents="none" style={[styles.medalShine, { transform: [{ rotate: '8deg' }, { translateX }] }]} />
      <BadgeIcon size={56} color={palette.white} />
    </View>
  );
}

function ContextItem({ icon: ItemIcon, value, label, numeric }: { icon: typeof MapPin; value: string; label: string; numeric?: boolean }) {
  return (
    <View style={styles.contextItem}>
      <ItemIcon size={16} color={palette.green[700]} />
      <Text style={[styles.contextValue, numeric && styles.contextValueNumeric]}>{value}</Text>
      <Text style={styles.contextLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.surfacePage,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: screenGutter,
    paddingTop: screenGutter,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[2],
    paddingBottom: spacing[7],
  },
  card: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surfaceCard,
    ...shadows.lg,
  },
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[5] + 2,
    alignItems: 'center',
    overflow: 'hidden',
  },
  heroWatermark: {
    position: 'absolute',
    left: '50%',
    top: '46%',
    width: 240,
    height: 240,
    marginLeft: -120,
    marginTop: -120,
    opacity: 0.06,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
  },
  brandLabel: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: palette.white,
  },
  tierPill: {
    backgroundColor: 'rgba(201,138,35,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(201,138,35,0.4)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  tierPillLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.scoreEagle,
  },
  medalWrap: {
    marginTop: spacing[5] + 2,
    marginBottom: spacing[1],
  },
  medal: {
    width: MEDAL_SIZE,
    height: MEDAL_SIZE,
    borderRadius: MEDAL_SIZE / 2,
    backgroundColor: colors.scoreEagle,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.lg,
  },
  medalShine: {
    position: 'absolute',
    top: -24,
    bottom: -24,
    width: 38,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  badgeName: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 32,
    color: palette.white,
    marginTop: spacing[3] + 2,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'center',
    marginTop: spacing[2],
    maxWidth: 280,
  },
  body: {
    padding: spacing[4] + 2,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3] + 1,
  },
  playerAvatarRing: {
    borderRadius: 27,
    borderWidth: 2,
    borderColor: colors.scoreEagle,
    shadowColor: colors.scoreEagle,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 13,
    elevation: 5,
  },
  playerInfo: {
    flex: 1,
    minWidth: 0,
  },
  playerName: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  hcpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
    marginTop: 2,
  },
  hcpLabel: {
    fontFamily: getFontFamily('body', '500'),
    fontWeight: '500',
    fontSize: 12,
    color: colors.textMuted,
  },
  hcpValue: {
    fontFamily: getFontFamily('numeric', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: colors.textSecondary,
  },
  statBlock: {
    alignItems: 'flex-end',
  },
  statValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.textPrimary,
  },
  statLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textMuted,
  },
  contextRow: {
    flexDirection: 'row',
    backgroundColor: palette.sand[50],
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md + 2,
    paddingVertical: spacing[3] + 1,
    paddingHorizontal: spacing[1],
    marginTop: spacing[4],
  },
  contextItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  contextDivider: {
    width: 1,
    backgroundColor: colors.borderSubtle,
  },
  contextValue: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  contextValueNumeric: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 13,
  },
  contextLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    color: colors.textMuted,
  },
  attestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 2,
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1,
    borderColor: palette.green[200],
    borderRadius: radius.md + 2,
    paddingVertical: spacing[2] + 4,
    paddingHorizontal: spacing[3] + 2,
    marginTop: spacing[3],
  },
  attesterStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attesterAvatar: {
    borderWidth: 2,
    borderColor: colors.surfaceBrandSoft,
  },
  attesterAvatarOverlap: {
    marginLeft: -9,
  },
  attestTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  attestedByText: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 12.5,
    color: colors.primary,
    lineHeight: 17,
  },
  attestSubText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  footerTagline: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing[4] + 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing[2] + 2,
    marginTop: spacing[4],
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2] + 1,
    height: 50,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    ...shadows.accent,
  },
  shareButtonLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 15,
    color: palette.white,
  },
  downloadButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.xs,
  },
});
