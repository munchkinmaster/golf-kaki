import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronRight, SlidersHorizontal } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { BottomNav } from '../components/BottomNav';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { IconButton } from '../components/IconButton';
import type { RootStackParamList } from '../navigation/types';
import { colors, getFontFamily, getPlayerColors, palette, radius, screenGutter, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Rounds'>;

type RoundsTab = 'live' | 'past';

type LiveRound = {
  id: string;
  name: string;
  format: string;
  sub: string;
  score: string;
  scoreUnit: string;
  players: string[];
  /** Canonical course name, for resuming into the Scorecard. */
  course: string;
};

type PastRound = {
  id: string;
  name: string;
  club: string;
  date: string;
  gross: number;
  money: number;
  players: string[];
  /** Canonical course name, for opening the Recap. */
  course: string;
};

const LIVE_ROUNDS: LiveRound[] = [
  {
    id: 'sat-fourball',
    name: 'Sat Fourball',
    format: 'Match play',
    sub: 'Sentosa GC · Serapong · Thru 4',
    score: '4',
    scoreUnit: 'up',
    players: ['M', 'W', 'D', 'J'],
    course: 'Sentosa Golf Club',
  },
  {
    id: 'kaki-cup-r2',
    name: 'Kaki Cup',
    format: 'Tournament',
    sub: 'Round 2 of 3 · Tanah Merah · Thru 11',
    score: 'T2',
    scoreUnit: 'of 12',
    players: ['M', 'W', 'D', 'A', 'P'],
    course: 'Tanah Merah Country Club',
  },
];

const PAST_ROUNDS: PastRound[] = [
  { id: 'friday-skins', name: 'Friday Skins', club: 'Tanah Merah GC · Garden', date: '14 Jun', gross: 88, money: 18, players: ['W', 'M', 'D', 'J'], course: 'Tanah Merah Country Club' },
  { id: 'sat-fourball-past', name: 'Sat Fourball', club: 'Sentosa GC · Serapong', date: '7 Jun', gross: 82, money: 6, players: ['W', 'M', 'D', 'A'], course: 'Sentosa Golf Club' },
  { id: 'sunday-stroke', name: 'Sunday Stroke', club: 'Sentosa GC · New Tanjong', date: '25 May', gross: 78, money: 0, players: ['W', 'M', 'P'], course: 'Sentosa Golf Club' },
  { id: 'teh-tarik-match', name: 'Teh Tarik Match', club: 'Marina Bay GC', date: '11 May', gross: 90, money: -8, players: ['W', 'D'], course: 'Marina Bay Golf Course' },
  { id: 'kaki-cup-r1', name: 'Kaki Cup · R1', club: 'Laguna National · Classic', date: '3 May', gross: 85, money: -2, players: ['W', 'M', 'D', 'A', 'P'], course: 'Laguna National G&CC' },
];

export function RoundsScreen({ navigation, route }: Props) {
  const [tab, setTab] = useState<RoundsTab>(route.params?.initialTab ?? 'live');

  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Rounds</Text>
          <IconButton icon={SlidersHorizontal} iconSize={17} />
        </View>

        <View style={styles.segmentWrap}>
          <SegmentedControl tab={tab} liveCount={LIVE_ROUNDS.length} onChange={setTab} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {tab === 'live' ? (
            <View style={styles.liveList}>
              {LIVE_ROUNDS.map((round) => (
                <LiveRoundCard
                  key={round.id}
                  round={round}
                  onResume={() =>
                    navigation.navigate('Scorecard', {
                      matchName: round.name,
                      courseName: round.course,
                      gameModeName: round.format,
                      isHost: true,
                    })
                  }
                />
              ))}
            </View>
          ) : (
            <View style={styles.pastList}>
              {PAST_ROUNDS.map((round) => (
                <PastRoundRow
                  key={round.id}
                  round={round}
                  onPress={() =>
                    navigation.navigate('Recap', {
                      matchName: round.name,
                      courseName: round.course,
                      gameModeName: 'Kaki Match Play',
                    })
                  }
                />
              ))}
            </View>
          )}
        </ScrollView>

        <BottomNav
          active="rounds"
          onNavigate={(navTab) => {
            if (navTab === 'home') navigation.navigate('Home');
            if (navTab === 'kaki') navigation.navigate('Kaki');
            if (navTab === 'profile') navigation.navigate('Profile');
          }}
          onStart={() => navigation.navigate('SelectCourse')}
        />
      </SafeAreaView>
    </View>
  );
}

function PulseDot({ color, size = 7 }: { color: string; size?: number }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.45, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View style={[styles.pulseDot, { width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: pulse }]} />
  );
}

function SegmentedControl({
  tab,
  liveCount,
  onChange,
}: {
  tab: RoundsTab;
  liveCount: number;
  onChange: (tab: RoundsTab) => void;
}) {
  return (
    <View style={styles.segmentTrack}>
      <Pressable style={[styles.segment, tab === 'live' && styles.segmentActive]} onPress={() => onChange('live')}>
        <PulseDot color={tab === 'live' ? colors.accent : palette.sand[400]} />
        <Text style={[styles.segmentLabel, tab === 'live' && styles.segmentLabelActive]}>Live</Text>
        <View style={[styles.segmentCount, tab === 'live' ? styles.segmentCountActive : styles.segmentCountInactive]}>
          <Text style={[styles.segmentCountLabel, tab === 'live' ? styles.segmentCountLabelActive : styles.segmentCountLabelInactive]}>
            {liveCount}
          </Text>
        </View>
      </Pressable>
      <Pressable style={[styles.segment, tab === 'past' && styles.segmentActive]} onPress={() => onChange('past')}>
        <Text style={[styles.segmentLabel, tab === 'past' && styles.segmentLabelActive]}>Past</Text>
      </Pressable>
    </View>
  );
}

function PlayerAvatarStack({ players, onGreen }: { players: string[]; onGreen: boolean }) {
  return (
    <View style={styles.avatarStack}>
      {players.map((initial, index) => {
        const playerColor = getPlayerColors(index);
        return (
          <View
            key={`${initial}-${index}`}
            style={[
              styles.stackedAvatar,
              index > 0 && styles.stackedAvatarOverlap,
              { backgroundColor: playerColor.background, borderColor: onGreen ? colors.primary : colors.surfaceCard },
            ]}
          >
            <Text style={[styles.stackedAvatarLabel, { color: playerColor.color }]}>{initial}</Text>
          </View>
        );
      })}
    </View>
  );
}

function LiveRoundCard({ round, onResume }: { round: LiveRound; onResume: () => void }) {
  return (
    <Card variant="inverse" watermark>
      <View style={styles.liveCardTop}>
        <View style={styles.liveCardInfo}>
          <View style={styles.liveOverlineRow}>
            <PulseDot color={colors.accent} size={7} />
            <Text style={styles.liveOverline}>
              Live · {round.format}
            </Text>
          </View>
          <Text style={styles.liveTitle}>{round.name}</Text>
          <Text style={styles.liveSubtitle}>{round.sub}</Text>
        </View>
        <View style={styles.liveScoreWrap}>
          <Text style={styles.liveScoreValue}>{round.score}</Text>
          <Text style={styles.liveScoreUnit}>{round.scoreUnit}</Text>
        </View>
      </View>
      <View style={styles.liveCardBottom}>
        <PlayerAvatarStack players={round.players} onGreen />
        <Button
          label="Resume"
          variant="accent"
          size="sm"
          icon={<ChevronRight size={16} color={colors.textOnAccent} />}
          iconPosition="right"
          onPress={onResume}
        />
      </View>
    </Card>
  );
}

function getMoneyInfo(money: number) {
  if (money > 0) return { text: `+$${money}`, color: colors.statusSuccess };
  if (money < 0) return { text: `−$${Math.abs(money)}`, color: colors.statusDanger };
  return { text: 'Even', color: colors.textDisabled };
}

function PastRoundRow({ round, onPress }: { round: PastRound; onPress: () => void }) {
  const money = getMoneyInfo(round.money);

  return (
    <Pressable onPress={onPress}>
    <Card>
      <View style={styles.pastTopRow}>
        <View style={styles.pastInfo}>
          <Text style={styles.pastName} numberOfLines={1}>
            {round.name}
          </Text>
          <Text style={styles.pastMeta} numberOfLines={1}>
            {round.club} · {round.date}
          </Text>
        </View>
        <View style={styles.pastScoreWrap}>
          <Text style={styles.pastGross}>{round.gross}</Text>
          <Text style={styles.pastGrossLabel}>gross</Text>
          <Text style={[styles.pastMoney, { color: money.color }]}>{money.text}</Text>
        </View>
      </View>
      <PlayerAvatarStack players={round.players} onGreen={false} />
    </Card>
    </Pressable>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenGutter,
    paddingTop: screenGutter,
  },
  headerTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 22,
    color: colors.textPrimary,
  },
  segmentWrap: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[3] + 2,
    paddingBottom: spacing[2],
  },
  segmentTrack: {
    flexDirection: 'row',
    gap: 3,
    backgroundColor: palette.sand[300],
    borderRadius: radius.pill,
    padding: 3,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1] + 3,
    paddingVertical: spacing[2] + 1,
    borderRadius: radius.pill,
  },
  segmentActive: {
    backgroundColor: colors.surfaceCard,
    shadowColor: '#0E3A28',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.textDisabled,
  },
  segmentLabelActive: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    color: colors.primary,
  },
  segmentCount: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: spacing[1] + 1,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentCountActive: {
    backgroundColor: palette.orange[100],
  },
  segmentCountInactive: {
    backgroundColor: palette.sand[300],
  },
  segmentCountLabel: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 11,
  },
  segmentCountLabelActive: {
    color: palette.orange[600],
  },
  segmentCountLabelInactive: {
    color: colors.textDisabled,
  },
  pulseDot: {
    flexShrink: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingBottom: spacing[7],
  },
  liveList: {
    gap: spacing[3] + 2,
  },
  liveCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  liveCardInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing[2] + 2,
  },
  liveOverlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 3,
    marginBottom: spacing[1] + 3,
  },
  liveOverline: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 1.4,
    color: palette.orange[300],
    textTransform: 'uppercase',
  },
  liveTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 20,
    color: palette.white,
  },
  liveSubtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 4,
  },
  liveScoreWrap: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  liveScoreValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 28,
    lineHeight: 28,
    color: palette.green[300],
  },
  liveScoreUnit: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  liveCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[4],
  },
  avatarStack: {
    flexDirection: 'row',
  },
  stackedAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackedAvatarOverlap: {
    marginLeft: -9,
  },
  stackedAvatarLabel: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 11,
  },
  pastList: {
    gap: spacing[2] + 2,
  },
  pastTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  pastInfo: {
    flex: 1,
    minWidth: 0,
  },
  pastName: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 16,
    color: colors.textPrimary,
  },
  pastMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    marginTop: 2,
  },
  pastScoreWrap: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  pastGross: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 22,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  pastGrossLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  pastMoney: {
    fontFamily: getFontFamily('numeric', '600'),
    fontWeight: '600',
    fontSize: 12,
    marginTop: 3,
  },
});
