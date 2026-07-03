import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clipboard as ClipboardIcon,
  Coins,
  Flag,
  Hash,
  Info,
  Lock,
  Users,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { IconButton } from '../components/IconButton';
import type { RootStackParamList } from '../navigation/types';
import { colors, getFontFamily, palette, radius, screenGutter, shadows, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'JoinGame'>;

const CODE_LENGTH = 4;
const JOIN_DELAY_MS = 700;

// Matches the demo match ID used throughout the in-game screens (MatchLobby's
// and InGameLobby's `MATCH_ID = 'GK-7Q4D'`, Home's game-invite notification) —
// this app only has live round data for the one Sat Fourball demo match.
const KNOWN_CODE = '7Q4D';
const KNOWN_CODE_MATCH = { matchName: 'Sat Fourball', courseName: 'Sentosa Golf Club', gameModeName: 'Kaki Match Play' };

type LiveGame = {
  id: string;
  name: string;
  initial: string;
  avatarBg: string;
  avatarFg: string;
  courseLabel: string;
  courseName: string;
  gameModeName: string;
  players: string;
  thru: string;
  stakes: string;
};

const LIVE_GAMES: LiveGame[] = [
  {
    id: 'g1',
    name: "Marcus's Fourball",
    initial: 'M',
    avatarBg: palette.green[100],
    avatarFg: colors.primary,
    courseLabel: 'Sentosa · Serapong',
    courseName: 'Sentosa Golf Club',
    gameModeName: 'Kaki Match Play',
    players: '3 / 4',
    thru: '4',
    stakes: 'Skins · $5',
  },
  {
    id: 'g2',
    name: 'Sunday Stableford',
    initial: 'D',
    avatarBg: '#DDEAF3',
    avatarFg: '#3E6480',
    courseLabel: 'Tanah Merah · Garden',
    courseName: 'Tanah Merah Country Club',
    gameModeName: 'Stableford',
    players: '2 / 4',
    thru: '7',
    stakes: 'Teh tarik',
  },
  {
    id: 'g3',
    name: "Jia Hui's Skins",
    initial: 'J',
    avatarBg: palette.orange[200],
    avatarFg: palette.orange[700],
    courseLabel: 'Laguna · Classic',
    courseName: 'Laguna National G&CC',
    gameModeName: 'Skins',
    players: '3 / 4',
    thru: '2',
    stakes: 'Skins · $10',
  },
];

export function JoinGameScreen({ navigation }: Props) {
  const [code, setCode] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const caretOpacity = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(caretOpacity, { toValue: 0, duration: 0, delay: 500, useNativeDriver: true }),
        Animated.timing(caretOpacity, { toValue: 1, duration: 0, delay: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [caretOpacity]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const selectedGame = LIVE_GAMES.find((g) => g.id === selectedGameId) ?? null;
  const full = code.length === CODE_LENGTH;
  const matched = full && code === KNOWN_CODE;
  const ready = full || selectedGameId !== null;

  function onCodeChange(text: string) {
    const cleaned = text
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, CODE_LENGTH);
    setCode(cleaned);
    setSelectedGameId(null);
  }

  function selectGame(id: string) {
    setSelectedGameId(id);
    setCode('');
    inputRef.current?.blur();
  }

  async function onPaste() {
    const text = await Clipboard.getStringAsync();
    onCodeChange(text.replace(/^GK-?/i, ''));
  }

  function handleJoin() {
    if (!ready || joining) return;
    setJoining(true);
    setTimeout(() => {
      setJoining(false);
      const target = selectedGame
        ? { matchName: selectedGame.name, courseName: selectedGame.courseName, gameModeName: selectedGame.gameModeName }
        : KNOWN_CODE_MATCH;
      navigation.navigate('InGameLobby', target);
    }, JOIN_DELAY_MS);
  }

  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <IconButton icon={ChevronLeft} iconSize={20} onPress={() => navigation.goBack()} />
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Join a game</Text>
            <Text style={styles.headerSubtitle}>Got a code from your kaki? Punch it in.</Text>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionLabel}>Enter game code</Text>
          <Pressable
            style={[styles.codeCard, matched ? styles.codeCardMatched : inputFocused ? styles.codeCardFocused : null]}
            onPress={() => inputRef.current?.focus()}
          >
            <View style={styles.codeRow} pointerEvents="none">
              <Text style={styles.codePrefix}>GK</Text>
              <Text style={styles.codeDash}>-</Text>
              <View style={styles.codeSlots}>
                {Array.from({ length: CODE_LENGTH }).map((_, i) => {
                  const char = code[i];
                  const isCaret = i === code.length && inputFocused && !selectedGameId;
                  return (
                    <View key={i} style={[styles.codeSlot, char ? styles.codeSlotActive : null, isCaret && styles.codeSlotCaret]}>
                      {char ? (
                        <Text style={styles.codeSlotChar}>{char}</Text>
                      ) : isCaret ? (
                        <Animated.View style={[styles.caret, { opacity: caretOpacity }]} />
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={onCodeChange}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              maxLength={CODE_LENGTH}
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
              caretHidden
              style={styles.hiddenInput}
            />
          </Pressable>

          <View style={styles.hintRow}>
            <View style={styles.hintLeft}>
              {matched ? <Check size={14} color={palette.green[600]} /> : <Hash size={14} color={palette.sand[500]} />}
              <Text style={[styles.hintText, matched && styles.hintTextOk]}>
                {matched ? "Code found — Marcus's game" : `${CODE_LENGTH} characters after GK-`}
              </Text>
            </View>
            <Pressable style={styles.pasteButton} onPress={onPaste}>
              <ClipboardIcon size={13} color={colors.primary} />
              <Text style={styles.pasteLabel}>Paste</Text>
            </Pressable>
          </View>

          {matched ? (
            <View style={styles.matchedCard}>
              <View style={styles.matchedIconChip}>
                <Flag size={19} color={colors.primary} />
              </View>
              <View style={styles.matchedBody}>
                <Text style={styles.matchedTitle}>Sat Fourball</Text>
                <Text style={styles.matchedSubtitle}>Marcus's game · Sentosa · Serapong</Text>
              </View>
              <CheckCircle2 size={22} color={palette.green[600]} />
            </View>
          ) : null}

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>or join a live one</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.liveHeaderRow}>
            <Text style={styles.sectionLabel}>Kaki playing now</Text>
            <View style={styles.liveCountRow}>
              <Animated.View style={[styles.liveDot, { opacity: pulse }]} />
              <Text style={styles.liveCountLabel}>{LIVE_GAMES.length} live</Text>
            </View>
          </View>

          <View style={styles.liveList}>
            {LIVE_GAMES.map((game) => {
              const selected = game.id === selectedGameId;
              return (
                <Pressable
                  key={game.id}
                  style={[styles.liveCard, selected ? styles.liveCardSelected : styles.liveCardDefault]}
                  onPress={() => selectGame(game.id)}
                >
                  <View style={[styles.liveAvatar, { backgroundColor: game.avatarBg }]}>
                    <Text style={[styles.liveAvatarLabel, { color: game.avatarFg }]}>{game.initial}</Text>
                  </View>
                  <View style={styles.liveBody}>
                    <View style={styles.liveNameRow}>
                      <Text style={styles.liveName} numberOfLines={1}>
                        {game.name}
                      </Text>
                      <View style={styles.livePill}>
                        <View style={styles.livePillDot} />
                        <Text style={styles.livePillLabel}>Live</Text>
                      </View>
                    </View>
                    <Text style={styles.liveCourse} numberOfLines={1}>
                      {game.courseLabel}
                    </Text>
                    <View style={styles.liveMetaRow}>
                      <View style={styles.liveMetaItem}>
                        <Users size={13} color={colors.textDisabled} />
                        <Text style={styles.liveMetaText}>{game.players}</Text>
                      </View>
                      <View style={styles.liveMetaItem}>
                        <Flag size={13} color={colors.textDisabled} />
                        <Text style={styles.liveMetaText}>Thru {game.thru}</Text>
                      </View>
                      <View style={styles.liveMetaItem}>
                        <Coins size={13} color={colors.textDisabled} />
                        <Text style={styles.liveMetaText}>{game.stakes}</Text>
                      </View>
                    </View>
                  </View>
                  {selected ? (
                    <CheckCircle2 size={22} color={palette.green[600]} />
                  ) : (
                    <ChevronRight size={19} color={palette.sand[400]} />
                  )}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.footerNoteRow}>
            <Info size={14} color={palette.sand[500]} />
            <Text style={styles.footerNoteText}>Only friends who let you see their games appear here.</Text>
          </View>
        </ScrollView>

        {joining ? (
          <View style={styles.toastWrap} pointerEvents="none">
            <View style={styles.toast}>
              <ActivityIndicator size="small" color={palette.white} />
              <Text style={styles.toastText}>Joining the lobby…</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Pressable
            style={[styles.cta, ready ? styles.ctaReady : styles.ctaDisabled]}
            onPress={handleJoin}
            disabled={!ready || joining}
          >
            {ready ? <ArrowRight size={19} color={palette.white} /> : <Lock size={19} color={palette.sand[500]} />}
            <Text style={[styles.ctaLabel, ready ? styles.ctaLabelReady : styles.ctaLabelDisabled]}>
              {ready ? 'Join game' : 'Enter a code to join'}
            </Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: screenGutter,
    paddingTop: screenGutter,
    paddingBottom: spacing[1],
  },
  headerTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    marginTop: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[4],
    paddingBottom: spacing[9],
  },
  sectionLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 1.1,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing[2] + 2,
  },
  codeCard: {
    position: 'relative',
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.lg,
    padding: spacing[4],
    ...shadows.xs,
  },
  codeCardFocused: {
    borderColor: colors.primary,
  },
  codeCardMatched: {
    borderColor: palette.green[200],
    ...shadows.sm,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
  },
  codePrefix: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 26,
    color: colors.primary,
  },
  codeDash: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 26,
    color: palette.sand[400],
  },
  codeSlots: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing[2] - 1,
  },
  codeSlot: {
    flex: 1,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfacePage,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeSlotActive: {
    backgroundColor: colors.surfaceBrandSoft,
    borderColor: palette.green[200],
  },
  codeSlotCaret: {
    borderColor: colors.primary,
  },
  codeSlotChar: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 24,
    color: colors.primary,
  },
  caret: {
    width: 2,
    height: 26,
    backgroundColor: colors.primary,
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    fontSize: 16,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[2] + 1,
  },
  hintLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
    flexShrink: 1,
  },
  hintText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: palette.sand[500],
  },
  hintTextOk: {
    color: palette.green[600],
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
  },
  pasteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1,
    borderColor: palette.green[200],
    borderRadius: radius.pill,
    paddingVertical: spacing[1] + 2,
    paddingHorizontal: spacing[3] - 1,
  },
  pasteLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: colors.primary,
  },
  matchedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: palette.green[200],
    borderRadius: radius.lg,
    padding: spacing[3] + 1,
    marginTop: spacing[3],
    ...shadows.sm,
  },
  matchedIconChip: {
    width: 42,
    height: 42,
    borderRadius: radius.md - 1,
    backgroundColor: palette.green[100],
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  matchedBody: {
    flex: 1,
    minWidth: 0,
  },
  matchedTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.textPrimary,
  },
  matchedSubtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    marginTop: 1,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing[6] - 2,
    marginBottom: spacing[4] - 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderDefault,
  },
  dividerLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 0.9,
    color: palette.sand[500],
    textTransform: 'uppercase',
  },
  liveHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2] + 3,
  },
  liveCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.statusSuccess,
  },
  liveCountLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    color: palette.green[600],
  },
  liveList: {
    gap: spacing[2] + 2,
  },
  liveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderRadius: radius.lg,
    padding: spacing[3] + 2,
  },
  liveCardDefault: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    ...shadows.xs,
  },
  liveCardSelected: {
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1.5,
    borderColor: colors.primary,
    ...shadows.sm,
  },
  liveAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  liveAvatarLabel: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 16,
  },
  liveBody: {
    flex: 1,
    minWidth: 0,
  },
  liveNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 3,
  },
  liveName: {
    flexShrink: 1,
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.textPrimary,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1,
    borderColor: palette.green[200],
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingHorizontal: spacing[2] - 1,
    flexShrink: 0,
  },
  livePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.statusSuccess,
  },
  livePillLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: palette.green[600],
  },
  liveCourse: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    marginTop: 2,
  },
  liveMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3] - 1,
    marginTop: spacing[2] - 1,
  },
  liveMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
  },
  liveMetaText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textSecondary,
  },
  footerNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    marginTop: spacing[4],
  },
  footerNoteText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: palette.sand[500],
    textAlign: 'center',
  },
  toastWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 96,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.textPrimary,
    borderRadius: radius.pill,
    paddingVertical: spacing[2] + 2,
    paddingHorizontal: spacing[4] - 2,
    ...shadows.lg,
  },
  toastText: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: palette.white,
  },
  footer: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[3],
    paddingBottom: spacing[5],
    backgroundColor: colors.surfacePage,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2] + 2,
    height: 56,
    borderRadius: radius.pill,
  },
  ctaReady: {
    backgroundColor: colors.accent,
    ...shadows.accent,
  },
  ctaDisabled: {
    backgroundColor: colors.surfaceSunken,
  },
  ctaLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 17,
  },
  ctaLabelReady: {
    color: palette.white,
  },
  ctaLabelDisabled: {
    color: palette.sand[500],
  },
});
