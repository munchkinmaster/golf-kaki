import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LucideIcon } from 'lucide-react-native';
import {
  ArrowRight,
  ChevronLeft,
  Flag,
  Gauge,
  Info,
  ListChecks,
  Pencil,
  Search,
  Spade,
  Swords,
  Trophy,
  Users,
  X,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { IconButton } from '../components/IconButton';
import { fetchKakiOverview } from '../data/kaki';
import { createMatch, generateMatchCodePreview } from '../data/matches';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../state/AuthContext';
import { useProfile } from '../state/ProfileContext';
import { colors, getFontFamily, getPlayerColors, motion, palette, radius, screenGutter, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateGame'>;

const GOLFER_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6];
const GAME_MODE_ID = 'kaki_match_play';

type InviteFriend = {
  id: string;
  name: string;
  handicap: number | null;
  status: 'added' | 'invite';
};

type GameMode = {
  id: string;
  name: string;
  icon: LucideIcon;
  available: boolean;
  description: string;
};

const GAME_MODES: GameMode[] = [
  {
    id: 'kaki-match-play',
    name: 'Kaki Match Play',
    icon: Swords,
    available: true,
    description:
      "Each kaki plays head-to-head against every other player, with strokes agreed in the lobby. Every hole is judged on its own — lowest nett score takes it — and your 'up' total tracks how you're doing across all those matchups.",
  },
  {
    id: 'stableford',
    name: 'Stableford',
    icon: ListChecks,
    available: false,
    description: 'Score points per hole against par — birdie 3, par 2, bogey 1. Highest points wins, and one bad hole never wrecks your round.',
  },
  {
    id: 'team',
    name: 'Team',
    icon: Users,
    available: false,
    description: 'Pair up and combine scores — best ball or aggregate. Play as a side against the other kaki.',
  },
  {
    id: 'tournament',
    name: 'Tournament',
    icon: Trophy,
    available: false,
    description: 'Multi-group stroke play with a shared leaderboard. Everyone plays their own ball; lowest total wins.',
  },
  {
    id: 'baccarat',
    name: 'Baccarat',
    icon: Spade,
    available: false,
    description: 'Popular Asian betting game — points banked per hole with running side stakes between players.',
  },
  {
    id: 'system-36',
    name: 'System 36 Stableford',
    icon: Gauge,
    available: false,
    description: 'Auto-handicap format: build your handicap as you play, then score Stableford points. Great for mixed-ability groups.',
  },
];

export function CreateGameScreen({ navigation, route }: Props) {
  const { courseId, comboId, holesToPlay, courseName, summaryLine } = route.params;
  const { session } = useAuth();
  const { profile } = useProfile();
  const viewerId = session?.user.id;

  const [matchName, setMatchName] = useState('Sat Fourball');
  const [golferCount, setGolferCount] = useState(4);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteFriends, setInviteFriends] = useState<InviteFriend[]>([]);
  const [friendsError, setFriendsError] = useState(false);
  const [modeInfoOpen, setModeInfoOpen] = useState(false);
  const [matchCode] = useState(() => generateMatchCodePreview());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!viewerId) return;
    fetchKakiOverview(viewerId)
      .then((overview) =>
        setInviteFriends(
          overview.friends.map((f) => ({ id: f.id, name: f.name, handicap: f.handicap, status: 'invite' as const })),
        ),
      )
      .catch(() => setFriendsError(true));
  }, [viewerId]);

  const q = inviteQuery.trim().toLowerCase();
  const filteredFriends = inviteFriends.filter((f) => !q || f.name.toLowerCase().includes(q));

  function toggleInvite(id: string) {
    setInviteFriends((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: f.status === 'added' ? 'invite' : 'added' } : f)),
    );
  }

  async function handleCreate() {
    if (!viewerId || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const invited = inviteFriends.filter((f) => f.status === 'added');
      const { id: matchId, matchCode: finalMatchCode } = await createMatch({
        matchCode,
        hostId: viewerId,
        courseId,
        comboId,
        holesToPlay,
        matchName,
        gameMode: GAME_MODE_ID,
        golferCount,
        players: [{ id: viewerId, handicap: profile?.handicap ?? null }, ...invited.map((f) => ({ id: f.id, handicap: f.handicap }))],
      });
      navigation.navigate('MatchLobby', {
        matchId,
        matchCode: finalMatchCode,
        matchName,
        courseName,
        summaryLine,
        gameModeName: GAME_MODES[0].name,
        holesToPlay,
      });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create the match — try again.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <IconButton icon={ChevronLeft} iconSize={20} onPress={() => navigation.goBack()} />
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Create a game</Text>
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressSegment, styles.progressSegmentDone]} />
                <View style={[styles.progressSegment, styles.progressSegmentDone]} />
              </View>
              <Text style={styles.progressLabel}>Match details</Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Card variant="inverse" watermark style={styles.courseCard}>
            <View style={styles.courseCardIcon}>
              <Flag size={19} color={colors.accent} />
            </View>
            <View style={styles.courseCardInfo}>
              <Text style={styles.courseCardName} numberOfLines={1}>
                {courseName}
              </Text>
              <Text style={styles.courseCardMeta} numberOfLines={1}>
                {summaryLine}
              </Text>
            </View>
            <Pressable style={styles.changeButton} onPress={() => navigation.goBack()}>
              <Pencil size={13} color={palette.orange[300]} />
              <Text style={styles.changeButtonLabel}>Change</Text>
            </Pressable>
          </Card>

          <View>
            <Text style={styles.fieldLabel}>Match name</Text>
            <View style={styles.inputRow}>
              <TextInput value={matchName} onChangeText={setMatchName} style={styles.input} />
            </View>
          </View>

          <View>
            <Text style={styles.fieldLabel}>
              Match ID <Text style={styles.fieldLabelMuted}>· ready once you create the game</Text>
            </Text>
            <View style={[styles.matchIdRow, styles.matchIdRowPending]}>
              <Text style={[styles.matchIdValue, styles.matchIdValuePending]}>GK-{matchCode}</Text>
              <View style={styles.matchIdPendingTag}>
                <Text style={styles.matchIdPendingTagLabel}>PREVIEW</Text>
              </View>
            </View>
          </View>

          <View>
            <Text style={styles.fieldLabel}>Number of golfers</Text>
            <View style={styles.golferCountRow}>
              {GOLFER_COUNT_OPTIONS.map((count) => (
                <Pressable
                  key={count}
                  style={[styles.golferCountCell, count === golferCount && styles.golferCountCellActive]}
                  onPress={() => setGolferCount(count)}
                >
                  <Text style={[styles.golferCountLabel, count === golferCount && styles.golferCountLabelActive]}>{count}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View>
            <View style={styles.inviteHeaderRow}>
              <Text style={styles.fieldLabel}>Invite friends</Text>
              <Text style={styles.inviteHint}>or share Match ID</Text>
            </View>
            <View style={styles.inviteSearchBar}>
              <Search size={16} color={colors.textDisabled} />
              <TextInput
                value={inviteQuery}
                onChangeText={setInviteQuery}
                placeholder="Search friends by name or @handle"
                placeholderTextColor={colors.textDisabled}
                style={styles.inviteSearchInput}
              />
            </View>
            <View style={styles.inviteList}>
              {friendsError ? (
                <Text style={styles.inviteEmptyText}>Couldn't load your kaki — check your connection and try again.</Text>
              ) : filteredFriends.length === 0 ? (
                <Text style={styles.inviteEmptyText}>{q ? 'No kaki match that search.' : 'Add some kaki first to invite them here.'}</Text>
              ) : (
                filteredFriends.map((friend, index) => (
                  <InviteFriendRow key={friend.id} friend={friend} colorIndex={index} onToggle={() => toggleInvite(friend.id)} />
                ))
              )}
            </View>
          </View>

          <View>
            <View style={styles.gameModeHeaderRow}>
              <Text style={styles.fieldLabel}>Game mode</Text>
              <Pressable onPress={() => setModeInfoOpen(true)}>
                <Info size={14} color={colors.primary} />
              </Pressable>
            </View>
            <View style={styles.gameModeSelectedRow}>
              <Text style={styles.gameModeSelectedLabel}>{GAME_MODES[0].name}</Text>
              <CircleCheckIcon />
            </View>
            <View style={styles.gameModeSoonGrid}>
              {GAME_MODES.slice(1).map((mode) => (
                <View key={mode.id} style={styles.gameModeSoonCell}>
                  <Text style={styles.gameModeSoonLabel}>{mode.name}</Text>
                  <View style={styles.gameModeSoonTag}>
                    <Text style={styles.gameModeSoonTagLabel}>SOON</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {createError ? <Text style={styles.createErrorText}>{createError}</Text> : null}
          <Button
            label={creating ? 'Creating…' : 'Create & open lobby'}
            variant="accent"
            size="lg"
            block
            disabled={creating}
            onPress={handleCreate}
            icon={<ArrowRight size={19} color={colors.textOnAccent} />}
          />
        </View>
      </SafeAreaView>

      <GameModeInfoSheet open={modeInfoOpen} onClose={() => setModeInfoOpen(false)} />
    </View>
  );
}

function CircleCheckIcon() {
  return (
    <View style={styles.circleCheckWrap}>
      <View style={styles.circleCheckDot} />
    </View>
  );
}

function InviteFriendRow({
  friend,
  colorIndex,
  onToggle,
}: {
  friend: InviteFriend;
  colorIndex: number;
  onToggle: () => void;
}) {
  const playerColor = getPlayerColors(colorIndex);
  const added = friend.status === 'added';

  return (
    <View style={[styles.inviteRow, added ? styles.inviteRowAdded : styles.inviteRowDefault]}>
      <View style={[styles.inviteAvatar, { backgroundColor: playerColor.background }]}>
        <Text style={[styles.inviteAvatarLabel, { color: playerColor.color }]}>{friend.name.charAt(0)}</Text>
      </View>
      <View style={styles.inviteInfo}>
        <Text style={styles.inviteName}>{friend.name}</Text>
        <Text style={styles.inviteMeta}>{friend.handicap !== null ? `HCP ${friend.handicap}` : 'No handicap yet'}</Text>
      </View>
      <Pressable style={[styles.inviteButton, added ? styles.inviteButtonAdded : styles.inviteButtonInvite]} onPress={onToggle}>
        <Text style={[styles.inviteButtonLabel, added ? styles.inviteButtonLabelAdded : styles.inviteButtonLabelInvite]}>
          {added ? 'Added' : 'Invite'}
        </Text>
      </Pressable>
    </View>
  );
}

const SHEET_OFFSCREEN_Y = 700;

function GameModeInfoSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: motion.duration.slow,
      easing: Easing.bezier(...motion.easing.out),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, progress]);

  if (!mounted) return null;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [SHEET_OFFSCREEN_Y, 0] });

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.scrim, { opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + spacing[5], transform: [{ translateY }] }]}>
          <View style={styles.sheetHandleWrap}>
            <View style={styles.sheetHandle} />
          </View>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Game modes explained</Text>
            <Pressable style={styles.sheetCloseButton} onPress={onClose}>
              <X size={17} color={colors.textMuted} />
            </Pressable>
          </View>
          <Text style={styles.sheetSubtitle}>How each format scores your round.</Text>
          <ScrollView style={styles.sheetList} contentContainerStyle={styles.sheetListContent}>
            {GAME_MODES.map((mode) => (
              <GameModeInfoRow key={mode.id} mode={mode} />
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function GameModeInfoRow({ mode }: { mode: GameMode }) {
  const Icon = mode.icon;

  return (
    <View style={styles.modeInfoRow}>
      <View style={[styles.modeInfoIcon, mode.available && styles.modeInfoIconAvailable]}>
        <Icon size={18} color={mode.available ? colors.primary : palette.sand[500]} />
      </View>
      <View style={styles.modeInfoBody}>
        <View style={styles.modeInfoTitleRow}>
          <Text style={styles.modeInfoName}>{mode.name}</Text>
          <View style={[styles.modeInfoTag, mode.available ? styles.modeInfoTagAvailable : styles.modeInfoTagSoon]}>
            <Text style={[styles.modeInfoTagLabel, mode.available ? styles.modeInfoTagLabelAvailable : styles.modeInfoTagLabelSoon]}>
              {mode.available ? 'Available' : 'Soon'}
            </Text>
          </View>
        </View>
        <Text style={styles.modeInfoDesc}>{mode.description}</Text>
      </View>
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
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
    marginTop: spacing[2],
  },
  progressTrack: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing[1] + 1,
  },
  progressSegment: {
    flex: 1,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.borderDefault,
  },
  progressSegmentDone: {
    backgroundColor: colors.primary,
  },
  progressLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    color: colors.primary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[2],
    paddingBottom: spacing[6],
    gap: spacing[4],
  },
  courseCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  courseCardIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md - 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  courseCardInfo: {
    flex: 1,
    minWidth: 0,
  },
  courseCardName: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: palette.white,
    lineHeight: 19,
  },
  courseCardMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 3,
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.pill,
    paddingVertical: spacing[1] + 2,
    paddingHorizontal: spacing[2] + 3,
    flexShrink: 0,
  },
  changeButtonLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: palette.orange[300],
  },
  fieldLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing[2] - 1,
  },
  fieldLabelMuted: {
    fontFamily: getFontFamily('body', '400'),
    fontWeight: '400',
    color: colors.textDisabled,
  },
  inputRow: {
    height: 50,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3] + 3,
    justifyContent: 'center',
  },
  input: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 15,
    color: colors.textPrimary,
  },
  matchIdRow: {
    height: 50,
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1.5,
    borderColor: palette.green[200],
    borderStyle: 'dashed',
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing[3] + 3,
    paddingRight: spacing[1] + 2,
  },
  matchIdValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 20,
    letterSpacing: 2.4,
    color: colors.primary,
  },
  matchIdRowPending: {
    opacity: 0.6,
  },
  matchIdValuePending: {
    color: palette.sand[500],
  },
  matchIdPendingTag: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xs + 2,
    paddingVertical: 3,
    paddingHorizontal: spacing[2] - 1,
  },
  matchIdPendingTagLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 9,
    letterSpacing: 0.5,
    color: palette.sand[500],
  },
  golferCountRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  golferCountCell: {
    flex: 1,
    height: 46,
    borderRadius: radius.md - 1,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  golferCountCellActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  golferCountLabel: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 16,
    color: colors.textDisabled,
  },
  golferCountLabelActive: {
    color: colors.textInverse,
  },
  inviteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inviteHint: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
  },
  inviteSearchBar: {
    height: 44,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
    paddingHorizontal: spacing[3] + 1,
    marginTop: spacing[2] - 1,
    marginBottom: spacing[2],
  },
  inviteSearchInput: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 14,
    color: colors.textPrimary,
  },
  inviteList: {
    gap: spacing[2],
  },
  inviteEmptyText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    paddingVertical: spacing[2],
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 2,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2] + 2,
  },
  inviteRowAdded: {
    borderColor: palette.green[200],
  },
  inviteRowDefault: {
    borderColor: colors.borderDefault,
  },
  inviteAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  inviteAvatarLabel: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 14,
  },
  inviteInfo: {
    flex: 1,
    minWidth: 0,
  },
  inviteName: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: colors.textPrimary,
  },
  inviteMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: 1,
  },
  inviteButton: {
    paddingVertical: spacing[1] + 2,
    paddingHorizontal: spacing[3] - 1,
    borderRadius: radius.pill,
  },
  inviteButtonAdded: {
    backgroundColor: colors.primary,
  },
  inviteButtonInvite: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: palette.green[200],
  },
  inviteButtonLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
  },
  inviteButtonLabelAdded: {
    color: palette.white,
  },
  inviteButtonLabelInvite: {
    color: colors.primary,
  },
  gameModeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
  },
  gameModeSelectedRow: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1.5,
    borderColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3] + 3,
    marginTop: spacing[2] - 1,
    marginBottom: spacing[2],
  },
  gameModeSelectedLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 15,
    color: colors.primary,
  },
  circleCheckWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleCheckDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.white,
  },
  gameModeSoonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  gameModeSoonCell: {
    flexBasis: '47%',
    flexGrow: 1,
    height: 44,
    borderRadius: radius.md - 1,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1] + 2,
  },
  gameModeSoonLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: colors.textDisabled,
  },
  gameModeSoonTag: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.xs + 2,
    paddingVertical: 2,
    paddingHorizontal: spacing[1] + 2,
  },
  gameModeSoonTagLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 9,
    letterSpacing: 0.4,
    color: colors.textDisabled,
  },
  footer: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[3],
    paddingBottom: spacing[5],
    backgroundColor: colors.surfacePage,
  },
  createErrorText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.statusDanger,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  modalRoot: {
    flex: 1,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlayScrim,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '85%',
    backgroundColor: colors.surfaceCard,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: screenGutter,
    shadowColor: '#0E3A28',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 16,
  },
  sheetHandleWrap: {
    alignItems: 'center',
    paddingVertical: spacing[2] + 2,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderDefault,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 18,
    color: colors.textPrimary,
  },
  sheetCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSubtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    marginTop: spacing[2] + 1,
    marginBottom: spacing[2] + 2,
  },
  sheetList: {
    flexGrow: 0,
  },
  sheetListContent: {
    gap: spacing[3] + 1,
    paddingBottom: spacing[3],
  },
  modeInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2] + 3,
  },
  modeInfoIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md - 1,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  modeInfoIconAvailable: {
    backgroundColor: colors.surfaceBrandSoft,
  },
  modeInfoBody: {
    flex: 1,
    minWidth: 0,
  },
  modeInfoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 3,
  },
  modeInfoName: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: colors.textPrimary,
  },
  modeInfoTag: {
    paddingVertical: 2,
    paddingHorizontal: spacing[1] + 3,
    borderRadius: radius.xs + 2,
  },
  modeInfoTagAvailable: {
    backgroundColor: palette.green[100],
  },
  modeInfoTagSoon: {
    backgroundColor: colors.surfaceSunken,
  },
  modeInfoTagLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 9,
  },
  modeInfoTagLabelAvailable: {
    color: colors.primary,
  },
  modeInfoTagLabelSoon: {
    color: colors.textDisabled,
  },
  modeInfoDesc: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
});
