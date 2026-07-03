import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import {
  ChevronLeft,
  CircleCheckBig,
  Coffee,
  Copy,
  Lightbulb,
  List,
  Minus,
  Plus,
  Trophy,
  Users,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { HOLES, PLAYERS, VIEWER_KEY, buildViewerDeal, viewerStrokeAgainst } from '../data/round';
import type { PlayerKey, StrokeMode } from '../data/round';
import type { RootStackParamList } from '../navigation/types';
import { useRound } from '../state/RoundContext';
import { colors, getFontFamily, palette, radius, screenGutter, shadows, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'InGameLobby'>;

const MATCH_ID = 'GK-7Q4D';

const HOST_KEY: PlayerKey = VIEWER_KEY;
const ORDERED_PLAYERS = [PLAYERS.find((p) => p.key === HOST_KEY)!, ...PLAYERS.filter((p) => p.key !== HOST_KEY)];
const OPPONENTS = PLAYERS.filter((p) => p.key !== VIEWER_KEY);

type StrokeSetting = {
  key: PlayerKey;
  name: string;
  handicap: number;
  avatarBg: string;
  avatarFg: string;
  strokes: number;
  mode: StrokeMode;
};

export function InGameLobbyScreen({ navigation, route }: Props) {
  const { matchName, courseName, gameModeName } = route.params;
  const { frontNineDeals, setFrontNineDeals, stakePerHole, setStakePerHole } = useRound();

  const [matchIdCopied, setMatchIdCopied] = useState(false);
  const [strokeSettings, setStrokeSettings] = useState<StrokeSetting[]>(() =>
    OPPONENTS.map((p) => {
      const { strokes, mode } = viewerStrokeAgainst(p.key, frontNineDeals);
      return { key: p.key, name: p.name, handicap: p.handicap, avatarBg: p.avatarBg, avatarFg: p.avatarFg, strokes, mode };
    }),
  );
  const [stakeInput, setStakeInput] = useState(String(stakePerHole));

  useEffect(() => {
    setFrontNineDeals(strokeSettings.map((s) => buildViewerDeal(s.key, s.strokes, s.mode)));
  }, [strokeSettings, setFrontNineDeals]);

  async function copyMatchId() {
    await Clipboard.setStringAsync(MATCH_ID);
    setMatchIdCopied(true);
    setTimeout(() => setMatchIdCopied(false), 1500);
  }

  function adjustStrokes(key: PlayerKey, delta: number) {
    setStrokeSettings((prev) => prev.map((s) => (s.key === key ? { ...s, strokes: Math.max(0, s.strokes + delta) } : s)));
  }

  function setStrokeMode(key: PlayerKey, mode: StrokeMode) {
    setStrokeSettings((prev) => prev.map((s) => (s.key === key ? { ...s, mode } : s)));
  }

  function setStake(value: number) {
    const clamped = Math.max(0, value);
    setStakePerHole(clamped);
    setStakeInput(String(clamped));
  }

  function onStakeInputChange(text: string) {
    const cleaned = text.replace(/[^0-9]/g, '');
    setStakeInput(cleaned);
    if (cleaned !== '') setStakePerHole(parseInt(cleaned, 10));
  }

  function onStakeInputBlur() {
    if (stakeInput === '') setStake(0);
  }

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <Pressable style={styles.backButton} onPress={() => navigation.navigate('Home')}>
              <ChevronLeft size={20} color="rgba(255,255,255,0.8)" />
            </Pressable>
            <View style={styles.headerTitleGroup}>
              <Text style={styles.headerTitle}>{matchName}</Text>
              <Text style={styles.headerSubtitle}>
                {courseName} · {HOLES.length} holes · {gameModeName}
              </Text>
            </View>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveLabel}>LIVE</Text>
            </View>
          </View>

          <View style={styles.matchIdRow}>
            <View>
              <Text style={styles.matchIdLabel}>Match ID</Text>
              <Text style={styles.matchIdValue}>{MATCH_ID}</Text>
            </View>
            <Pressable style={styles.copyInviteButton} onPress={copyMatchId}>
              {matchIdCopied ? <CircleCheckBig size={14} color={palette.white} /> : <Copy size={14} color={palette.white} />}
              <Text style={styles.copyInviteLabel}>{matchIdCopied ? 'Copied' : 'Copy invite'}</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.playersHeaderRow}>
            <Text style={styles.sectionLabel}>Players · {ORDERED_PLAYERS.length}</Text>
            <View style={styles.allInRow}>
              <View style={styles.allInDot} />
              <Text style={styles.allInText}>All in</Text>
            </View>
          </View>

          <View style={styles.playerList}>
            {ORDERED_PLAYERS.map((player) => {
              const isHost = player.key === HOST_KEY;
              const isViewer = player.key === VIEWER_KEY;
              return (
                <View key={player.key} style={[styles.playerRow, isViewer ? styles.playerRowViewer : styles.playerRowDefault]}>
                  <View style={[styles.playerAvatar, { backgroundColor: player.avatarBg }]}>
                    <Text style={[styles.playerAvatarLabel, { color: player.avatarFg }]}>{player.name.charAt(0)}</Text>
                  </View>
                  <View style={styles.playerInfo}>
                    <View style={styles.playerNameRow}>
                      <Text style={styles.playerName}>{player.name}</Text>
                      {isViewer ? (
                        <View style={styles.youBadge}>
                          <Text style={styles.youBadgeLabel}>YOU</Text>
                        </View>
                      ) : isHost ? (
                        <View style={styles.hostBadge}>
                          <Text style={styles.hostBadgeLabel}>HOST</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.playerMeta}>HCP {player.handicap} · joined</Text>
                  </View>
                  <CircleCheckBig size={20} color={palette.green[600]} />
                </View>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Handicaps &amp; strokes</Text>
          <View style={styles.tipCard}>
            <Lightbulb size={16} color={colors.scoreEagle} />
            <Text style={styles.tipText}>
              <Text style={styles.tipGet}>Get</Text> — You get strokes from your opponent on the hardest holes{'\n'}
              <Text style={styles.tipGive}>Give</Text> — You spot strokes to your opponent on the hardest holes
            </Text>
          </View>

          <View style={styles.strokeSettingsCard}>
            {strokeSettings.map((player, index) => (
              <View
                key={player.key}
                style={[styles.strokeSettingRow, index < strokeSettings.length - 1 && styles.strokeSettingRowDivider]}
              >
                <View style={styles.strokeSettingTopRow}>
                  <View style={[styles.strokeAvatar, { backgroundColor: player.avatarBg }]}>
                    <Text style={[styles.strokeAvatarLabel, { color: player.avatarFg }]}>{player.name.charAt(0)}</Text>
                  </View>
                  <View style={styles.playerInfo}>
                    <Text style={styles.playerName}>{player.name}</Text>
                    <Text style={styles.playerMeta}>HCP {player.handicap}</Text>
                  </View>
                  <View style={styles.stepperRow}>
                    <Pressable style={styles.stepperButton} onPress={() => adjustStrokes(player.key, -1)}>
                      <Minus size={15} color={colors.textDisabled} />
                    </Pressable>
                    <Text style={styles.stepperValue}>{player.strokes}</Text>
                    <Pressable style={[styles.stepperButton, styles.stepperButtonAccent]} onPress={() => adjustStrokes(player.key, 1)}>
                      <Plus size={15} color={colors.primary} />
                    </Pressable>
                  </View>
                </View>
                <View style={styles.strokeModeRow}>
                  <Text style={styles.strokeModeLabel}>I</Text>
                  <View style={styles.strokeModeTrack}>
                    <Pressable
                      style={[styles.strokeModeOption, player.mode === 'get' && styles.strokeModeOptionActive]}
                      onPress={() => setStrokeMode(player.key, 'get')}
                    >
                      <Text style={[styles.strokeModeOptionLabel, player.mode === 'get' && styles.strokeModeOptionLabelGet]}>get</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.strokeModeOption, player.mode === 'give' && styles.strokeModeOptionActive]}
                      onPress={() => setStrokeMode(player.key, 'give')}
                    >
                      <Text style={[styles.strokeModeOptionLabel, player.mode === 'give' && styles.strokeModeOptionLabelGive]}>give</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.strokeModeLabel}>{player.mode === 'get' ? `from ${player.name}` : `to ${player.name}`}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Stakes</Text>
          <View style={styles.stakesCard}>
            <View style={styles.stakesLeft}>
              <Coffee size={18} color={palette.orange[700]} />
              <Text style={styles.stakesLabel}>Per hole</Text>
            </View>
            <View style={styles.stakesStepper}>
              <Pressable style={styles.stakesStepperButton} onPress={() => setStake(stakePerHole - 1)}>
                <Minus size={16} color={palette.orange[600]} />
              </Pressable>
              <View style={styles.stakesInputRow}>
                <Text style={styles.stakesValue}>$</Text>
                <TextInput
                  value={stakeInput}
                  onChangeText={onStakeInputChange}
                  onBlur={onStakeInputBlur}
                  keyboardType="number-pad"
                  maxLength={4}
                  selectTextOnFocus
                  style={styles.stakesInput}
                />
              </View>
              <Pressable style={styles.stakesStepperButton} onPress={() => setStake(stakePerHole + 1)}>
                <Plus size={16} color={palette.orange[600]} />
              </Pressable>
            </View>
          </View>
        </ScrollView>

        <View style={styles.inRoundNav}>
          <Pressable
            style={styles.inRoundTab}
            onPress={() => navigation.navigate('Scorecard', { matchName, courseName, gameModeName, isHost: true })}
          >
            <List size={21} color={palette.sand[400]} />
            <Text style={styles.inRoundTabLabel}>Scorecard</Text>
          </Pressable>
          <Pressable
            style={styles.inRoundTab}
            onPress={() => navigation.navigate('Leaderboard', { matchName, courseName, gameModeName })}
          >
            <Trophy size={21} color={palette.sand[400]} />
            <Text style={styles.inRoundTabLabel}>Leaderboard</Text>
          </Pressable>
          <View style={styles.inRoundTab}>
            <Users size={21} color={colors.primary} />
            <Text style={[styles.inRoundTabLabel, styles.inRoundTabLabelActive]}>Lobby</Text>
          </View>
          <Pressable
            style={styles.inRoundTab}
            onPress={() => navigation.navigate('Finish', { matchName, courseName, gameModeName })}
          >
            <CircleCheckBig size={21} color={palette.sand[400]} />
            <Text style={styles.inRoundTabLabel}>Finish</Text>
          </Pressable>
        </View>
      </SafeAreaView>
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
    backgroundColor: colors.primary,
    paddingHorizontal: screenGutter,
    paddingTop: screenGutter,
    paddingBottom: spacing[4],
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
  },
  backButton: {
    width: 28,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 17,
    color: palette.white,
  },
  headerSubtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.pill,
    paddingVertical: spacing[1] + 1,
    paddingHorizontal: spacing[2] + 1,
    flexShrink: 0,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  liveLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    color: palette.orange[300],
  },
  matchIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    paddingVertical: spacing[2] + 3,
    paddingHorizontal: spacing[3] + 2,
    marginTop: spacing[3] + 2,
  },
  matchIdLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 10,
    letterSpacing: 1.6,
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
  },
  matchIdValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 19,
    letterSpacing: 1.9,
    color: palette.white,
    marginTop: 2,
  },
  copyInviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3] + 2,
    ...shadows.accent,
  },
  copyInviteLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: palette.white,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
  },
  sectionLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 1.1,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing[2] + 1,
  },
  playersHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2] + 1,
  },
  allInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
  },
  allInDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.statusSuccess,
  },
  allInText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.statusSuccess,
  },
  playerList: {
    gap: spacing[2] + 1,
    marginBottom: spacing[5] + 2,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing[3] - 1,
    ...shadows.xs,
  },
  playerRowViewer: {
    borderWidth: 1.5,
    borderColor: palette.green[200],
  },
  playerRowDefault: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  playerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  playerAvatarLabel: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 15,
  },
  playerInfo: {
    flex: 1,
    minWidth: 0,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
  },
  playerName: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: colors.textPrimary,
  },
  youBadge: {
    backgroundColor: colors.surfaceBrandSoft,
    borderRadius: radius.xs + 2,
    paddingVertical: 1,
    paddingHorizontal: spacing[1] + 2,
  },
  youBadgeLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 10,
    color: colors.primary,
  },
  hostBadge: {
    backgroundColor: palette.orange[100],
    borderRadius: radius.xs + 2,
    paddingVertical: 1,
    paddingHorizontal: spacing[1] + 2,
  },
  hostBadgeLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 10,
    color: palette.orange[700],
  },
  playerMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: 1,
  },
  tipCard: {
    flexDirection: 'row',
    gap: spacing[2] + 2,
    backgroundColor: '#FFF9EC',
    borderWidth: 1,
    borderColor: '#F0E0B0',
    borderRadius: radius.md,
    padding: spacing[3] - 1,
    marginBottom: spacing[3],
  },
  tipText: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: '#7A6320',
    lineHeight: 17,
  },
  tipGet: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    color: palette.green[600],
  },
  tipGive: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    color: palette.orange[600],
  },
  strokeSettingsCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[3] + 1,
    marginBottom: spacing[3] + 2,
    ...shadows.xs,
  },
  strokeSettingRow: {
    paddingVertical: spacing[3] - 1,
  },
  strokeSettingRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSunken,
  },
  strokeSettingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
  },
  strokeAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  strokeAvatarLabel: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 13,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] - 1,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.pill,
    padding: 3,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonAccent: {
    backgroundColor: colors.surfaceBrandSoft,
  },
  stepperValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.textPrimary,
    minWidth: 20,
    textAlign: 'center',
  },
  strokeModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
    marginTop: spacing[2] + 1,
    paddingLeft: 34 + (spacing[2] + 3),
  },
  strokeModeLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
  },
  strokeModeTrack: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.pill,
    padding: 3,
  },
  strokeModeOption: {
    paddingVertical: spacing[1] + 1,
    paddingHorizontal: spacing[3] - 1,
    borderRadius: radius.pill,
  },
  strokeModeOptionActive: {
    backgroundColor: colors.surfaceCard,
    ...shadows.xs,
  },
  strokeModeOptionLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    color: colors.textDisabled,
  },
  strokeModeOptionLabelGet: {
    color: palette.green[600],
  },
  strokeModeOptionLabelGive: {
    color: palette.orange[600],
  },
  stakesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.orange[100],
    borderWidth: 1,
    borderColor: palette.orange[200],
    borderRadius: radius.lg,
    paddingVertical: spacing[3] + 1,
    paddingHorizontal: spacing[4] - 1,
  },
  stakesLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
  },
  stakesLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: colors.textSecondary,
  },
  stakesStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: palette.orange[200],
    borderRadius: radius.pill,
    paddingVertical: spacing[1] + 1,
    paddingHorizontal: spacing[2],
  },
  stakesStepperButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stakesValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 16,
    color: colors.textPrimary,
  },
  stakesInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stakesInput: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 16,
    color: colors.textPrimary,
    width: 46,
    flexGrow: 0,
    flexShrink: 0,
    padding: 0,
    textAlign: 'left',
  },
  inRoundNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
    backgroundColor: colors.surfaceCard,
    paddingTop: spacing[2],
    paddingBottom: spacing[3] + 2,
  },
  inRoundTab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  inRoundTabLabel: {
    fontFamily: getFontFamily('body', '500'),
    fontWeight: '500',
    fontSize: 10,
    color: palette.sand[400],
  },
  inRoundTabLabelActive: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    color: colors.primary,
  },
});
