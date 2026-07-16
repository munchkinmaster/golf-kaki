import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import {
  ChevronLeft,
  CircleCheckBig,
  Coffee,
  Copy,
  Flag,
  Lightbulb,
  Minus,
  Plus,
  RefreshCw,
  UserPlus,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Button } from '../components/Button';
import { MatchupEditor } from '../components/MatchupEditor';
import type { PairSetting } from '../components/MatchupEditor';
import { fetchLedgerStrokesForGroup } from '../data/kaki';
import { buildAllPairs, pairKey } from '../data/round';
import type { MatchPlayer, MatchupPair, StrokeMode } from '../data/matches';
import { fetchMatchLobby, fetchMatchups, startMatch, updateMatchSettings, upsertMatchup } from '../data/matches';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../state/AuthContext';
import { colors, getFontFamily, getPlayerColors, palette, radius, screenGutter, shadows, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'MatchLobby'>;

/** Seeds a pair from an existing persisted matchup if there is one, else the accepted kaki ledger (0 if none). */
function seedPair(playerAId: string, playerBId: string, existing: MatchupPair | undefined, ledgerNet18: number): PairSetting {
  if (existing) {
    return { playerAId, playerBId, strokes: Math.abs(existing.frontNineStrokes), aGives: existing.frontNineStrokes > 0 };
  }
  return { playerAId, playerBId, strokes: Math.round(Math.abs(ledgerNet18) / 2), aGives: ledgerNet18 > 0 };
}

export function MatchLobbyScreen({ navigation, route }: Props) {
  const { matchId, matchCode, matchName, courseName, summaryLine, gameModeName, holesToPlay } = route.params;
  const holesPart = summaryLine.split(' · ')[0];
  const displayCode = `GK-${matchCode}`;
  // holes_to_play = 9 forces strokes_basis = 9 at the DB level (matches table's check constraint).
  const canUse18Basis = holesToPlay === 18;

  const { session } = useAuth();
  const viewerId = session?.user.id;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [matchIdCopied, setMatchIdCopied] = useState(false);
  const [hostId, setHostId] = useState<string | null>(null);
  const [players, setPlayers] = useState<MatchPlayer[]>([]);
  const [golferCount, setGolferCount] = useState<number | null>(null);
  const [strokesBasis, setStrokesBasis] = useState<9 | 18>(9);
  const [pairSettings, setPairSettings] = useState<PairSetting[]>([]);
  // Pairs the viewer has locally edited (stepper tap / get-give toggle) since
  // mount, not yet confirmed persisted. Only these should keep their in-flight
  // local value across a reload — an untouched pair should keep re-seeding
  // from the ledger on every load, so a carry-forward that lands *after* this
  // screen's first load (a real race — see finishRound/syncLedger) still
  // self-corrects instead of freezing on a stale seed forever.
  const touchedPairsRef = useRef<Set<string>>(new Set());
  const [stakePerHole, setStakePerHole] = useState(2);
  const [stakeInput, setStakeInput] = useState('2');
  const [starting, setStarting] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;

  const openSlots = golferCount !== null ? Math.max(0, golferCount - players.length) : 0;
  // Stake/strokes-basis (whole-match settings) stay host-only. Individual pair
  // strokes below are different — MatchupEditor scopes those per-pair.
  const isHostViewer = hostId !== null && hostId === viewerId;
  const settingsSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const lobby = await fetchMatchLobby(matchId);
    // The host already leaves this screen via handleStartRound the moment they
    // start it; a non-host who refreshes (or gets a realtime nudge after the
    // host already started) needs this to notice and follow them into the round.
    if (lobby.status === 'live') {
      navigation.navigate('Scorecard', { matchId, matchName, courseName, gameModeName, isHost: lobby.hostId === viewerId });
      return;
    }

    setPlayers(lobby.players);
    setHostId(lobby.hostId);
    setGolferCount(lobby.golferCount);
    setStrokesBasis(lobby.strokesBasis);
    setStakePerHole(lobby.stakePerHole);
    setStakeInput(String(lobby.stakePerHole));

    const playerIds = lobby.players.map((p) => p.playerId);
    const allPairs = buildAllPairs(playerIds);
    const [existingMatchups, ledger] = await Promise.all([
      fetchMatchups(matchId),
      fetchLedgerStrokesForGroup(playerIds),
    ]);
    const existingByPair = new Map(existingMatchups.map((m) => [pairKey(m.playerAId, m.playerBId), m]));

    // A persisted matchup row is authoritative — anyone (including another
    // client over realtime) may have changed it since our last load, so it
    // always wins over whatever we're currently showing. A pair the viewer
    // has locally touched (but not yet confirmed persisted) falls back to the
    // in-flight local value; an untouched pair keeps re-seeding from the
    // ledger every load, since the ledger can still be catching up to a
    // just-finished round's carry-forward (see finishRound/syncLedger).
    //
    // Exception: front_nine_strokes' sign is how get/give is encoded (positive =
    // a gives b), which can't represent a direction at 0 strokes — 0 and -0 are
    // the same row. Reloading would otherwise always read a 0-stroke pair back
    // as "get" and stomp on a "give" tap made right before bumping the stepper
    // off zero. Keep the pair's own last-known aGives in that case instead.
    setPairSettings((prev) =>
      allPairs.map(([a, b]) => {
        const key = pairKey(a, b);
        const existing = existingByPair.get(key);
        const prevPair = prev.find((p) => p.playerAId === a && p.playerBId === b);
        if (existing) {
          if (existing.frontNineStrokes === 0 && prevPair) return { ...prevPair, strokes: 0 };
          return seedPair(a, b, existing, 0);
        }
        if (touchedPairsRef.current.has(key) && prevPair) return prevPair;
        return seedPair(a, b, undefined, ledger[key] ?? 0);
      }),
    );
  }, [matchId, viewerId, navigation, matchName, courseName, gameModeName]);

  useEffect(() => {
    load()
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Couldn't load the lobby."))
      .finally(() => setLoading(false));
  }, [load]);

  // Other players joining, the host adjusting stakes/strokes-basis, or
  // anyone's pairwise strokes changing should show up without the viewer
  // having to tap refresh.
  useEffect(() => {
    let syncTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleSync = () => {
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        load().catch(() => {});
      }, 250);
    };

    const channel = supabase
      .channel(`match-lobby-${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, scheduleSync)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_players', filter: `match_id=eq.${matchId}` },
        scheduleSync,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_matchups', filter: `match_id=eq.${matchId}` },
        scheduleSync,
      )
      .subscribe();

    return () => {
      if (syncTimer) clearTimeout(syncTimer);
      supabase.removeChannel(channel);
    };
  }, [matchId, load]);

  // Locks strokes_basis back to 9 if holes_to_play (9) makes 18 invalid.
  useEffect(() => {
    if (!canUse18Basis && strokesBasis === 18) setStrokesBasis(9);
  }, [canUse18Basis, strokesBasis]);

  function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    spin.setValue(0);
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 700, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    load()
      .then(() => setLoadError(null))
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Couldn't refresh the lobby."))
      .finally(() => {
        loop.stop();
        spin.setValue(0);
        setRefreshing(false);
      });
  }

  // Persists a whole-match setting change immediately (debounced) instead of
  // holding it as a host-only local draft until Start — otherwise other
  // participants never see the host's toggle/stake change at all, since it
  // never actually reaches the DB until they hit Start.
  function persistSettings(nextBasis: 9 | 18, nextStake: number) {
    if (!isHostViewer) return;
    if (settingsSyncTimer.current) clearTimeout(settingsSyncTimer.current);
    settingsSyncTimer.current = setTimeout(() => {
      updateMatchSettings(matchId, { strokesBasis: nextBasis, stakePerHole: nextStake }).catch(() => {
        setLoadError("Couldn't save that setting — try again.");
        load().catch(() => {});
      });
    }, 400);
  }

  async function copyMatchId() {
    await Clipboard.setStringAsync(displayCode);
    setMatchIdCopied(true);
    setTimeout(() => setMatchIdCopied(false), 1500);
  }

  // Pair edits save immediately, unlike stake/strokes-basis below — non-host
  // participants have no "Start Round" action to batch their own edits into.
  function persistPair(pair: PairSetting) {
    const mode: StrokeMode = pair.aGives ? 'give' : 'get';
    upsertMatchup(matchId, pair.playerAId, pair.playerBId, pair.strokes, mode).catch(() => {
      setLoadError("Couldn't save that stroke change — try again.");
      load().catch(() => {});
    });
  }

  function updatePair(a: string, b: string, updater: (p: PairSetting) => PairSetting) {
    const current = pairSettings.find((p) => p.playerAId === a && p.playerBId === b);
    if (!current) return;
    const updated = updater(current);
    touchedPairsRef.current.add(pairKey(a, b));
    setPairSettings((prev) => prev.map((p) => (p.playerAId === a && p.playerBId === b ? updated : p)));
    persistPair(updated);
  }

  function adjustPairStrokes(a: string, b: string, delta: number) {
    updatePair(a, b, (p) => ({ ...p, strokes: Math.max(0, p.strokes + delta) }));
  }

  /** `aGivesNext` is always in canonical a/b terms — callers from the UI translate from whatever side they're looking at first. */
  function setPairAGives(a: string, b: string, aGivesNext: boolean) {
    updatePair(a, b, (p) => ({ ...p, aGives: aGivesNext }));
  }

  function setStrokesBasisAndPersist(next: 9 | 18) {
    setStrokesBasis(next);
    persistSettings(next, stakePerHole);
  }

  function setStake(value: number) {
    const clamped = Math.max(0, value);
    setStakePerHole(clamped);
    setStakeInput(String(clamped));
    persistSettings(strokesBasis, clamped);
  }

  function onStakeInputChange(text: string) {
    const cleaned = text.replace(/[^0-9]/g, '');
    setStakeInput(cleaned);
    if (cleaned !== '') {
      const value = parseInt(cleaned, 10);
      setStakePerHole(value);
      persistSettings(strokesBasis, value);
    }
  }

  function onStakeInputBlur() {
    if (stakeInput === '') setStake(0);
  }

  async function handleStartRound() {
    if (!viewerId || !isHostViewer || starting) return;
    setStarting(true);
    setLoadError(null);
    if (settingsSyncTimer.current) clearTimeout(settingsSyncTimer.current);
    try {
      // Flushes the settings write unconditionally (rather than relying on the
      // debounce above having already fired) so a toggle right before Start
      // is never lost.
      await updateMatchSettings(matchId, { strokesBasis, stakePerHole });
      await startMatch(matchId);
      navigation.navigate('Scorecard', {
        matchId,
        matchName,
        courseName,
        gameModeName,
        isHost: hostId === viewerId,
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not start the round — try again.');
    } finally {
      setStarting(false);
    }
  }

  const spinRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
              <ChevronLeft size={20} color="rgba(255,255,255,0.8)" />
            </Pressable>
            <View style={styles.headerTitleGroup}>
              <Text style={styles.headerTitle}>{matchName}</Text>
              <Text style={styles.headerSubtitle}>
                {courseName} · {holesPart} · {gameModeName}
              </Text>
            </View>
            <Pressable style={styles.refreshButton} onPress={refresh}>
              <Animated.View style={{ transform: [{ rotate: spinRotate }] }}>
                <RefreshCw size={16} color={refreshing ? colors.accent : 'rgba(255,255,255,0.85)'} />
              </Animated.View>
            </Pressable>
          </View>

          <View style={styles.matchIdRow}>
            <View>
              <Text style={styles.matchIdLabel}>Match ID</Text>
              <Text style={styles.matchIdValue}>{displayCode}</Text>
            </View>
            <Pressable style={styles.copyInviteButton} onPress={copyMatchId}>
              {matchIdCopied ? <CircleCheckBig size={14} color={palette.white} /> : <Copy size={14} color={palette.white} />}
              <Text style={styles.copyInviteLabel}>{matchIdCopied ? 'Copied' : 'Copy invite'}</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {loadError ? <Text style={styles.loadErrorText}>{loadError}</Text> : null}

          <View style={styles.playersHeaderRow}>
            <Text style={styles.sectionLabel}>
              Players · {players.length}{golferCount !== null ? ` of ${golferCount}` : ''}
            </Text>
            {openSlots > 0 ? (
              <View style={styles.waitingRow}>
                <View style={styles.waitingDot} />
                <Text style={styles.waitingText}>Waiting for {openSlots} more</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.playerList}>
            {loading ? <Text style={styles.loadingText}>Loading players…</Text> : null}
            {players.map((player, index) => {
              const playerColor = getPlayerColors(index);
              return (
                <View
                  key={player.playerId}
                  style={[styles.playerRow, player.isHost ? styles.playerRowHost : styles.playerRowDefault]}
                >
                  <View style={[styles.playerAvatar, { backgroundColor: playerColor.background }]}>
                    <Text style={[styles.playerAvatarLabel, { color: playerColor.color }]}>{player.name.charAt(0)}</Text>
                  </View>
                  <View style={styles.playerInfo}>
                    <View style={styles.playerNameRow}>
                      <Text style={styles.playerName}>{player.name}</Text>
                      {player.isHost ? (
                        <View style={styles.hostBadge}>
                          <Text style={styles.hostBadgeLabel}>HOST</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.playerMeta}>{player.handicap !== null ? `HCP ${player.handicap}` : 'No handicap yet'} · joined</Text>
                  </View>
                  <CircleCheckBig size={20} color={palette.green[600]} />
                </View>
              );
            })}
            {openSlots > 0
              ? Array.from({ length: openSlots }).map((_, index) => (
                  <Pressable key={`open-${index}`} style={styles.openSlotRow} onPress={copyMatchId}>
                    <View style={styles.openSlotAvatar}>
                      <UserPlus size={18} color={palette.sand[500]} />
                    </View>
                    <Text style={styles.openSlotText}>Waiting for player to join…</Text>
                    <Text style={styles.openSlotInvite}>{matchIdCopied ? 'Copied' : 'Invite'}</Text>
                  </Pressable>
                ))
              : null}
          </View>

          <Text style={styles.sectionLabel}>Handicaps &amp; strokes</Text>
          <View style={styles.tipCard}>
            <Lightbulb size={16} color={colors.scoreEagle} />
            <Text style={styles.tipText}>
              <Text style={styles.tipGet}>Get</Text> — You get strokes from them on the hardest holes{'\n'}
              <Text style={styles.tipGive}>Give</Text> — You give strokes to them on the hardest holes
            </Text>
          </View>

          <View style={styles.strokesBasisField}>
            <Text style={styles.fieldLabel}>Strokes set for</Text>
            <View style={styles.strokesBasisRow}>
              <Pressable
                style={[
                  styles.strokesBasisToggle,
                  strokesBasis === 9 && styles.strokesBasisToggleActive,
                  !isHostViewer && styles.strokesBasisToggleDisabled,
                ]}
                disabled={!isHostViewer}
                onPress={() => setStrokesBasisAndPersist(9)}
              >
                <Text style={[styles.strokesBasisLabel, strokesBasis === 9 && styles.strokesBasisLabelActive]}>9 holes</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.strokesBasisToggle,
                  strokesBasis === 18 && styles.strokesBasisToggleActive,
                  (!canUse18Basis || !isHostViewer) && styles.strokesBasisToggleDisabled,
                ]}
                disabled={!canUse18Basis || !isHostViewer}
                onPress={() => setStrokesBasisAndPersist(18)}
              >
                <Text style={[styles.strokesBasisLabel, strokesBasis === 18 && styles.strokesBasisLabelActive]}>18 holes</Text>
              </Pressable>
            </View>
            <Text style={styles.strokesBasisHint}>
              {canUse18Basis
                ? 'Strokes will be auto-adjusted after 9 holes, 1 stroke adjustment for every 2 holes win'
                : "This match is 9 holes, so strokes are set for the round — there's no turn to re-strike at."}
            </Text>
          </View>

          <MatchupEditor
            players={players}
            viewerId={viewerId}
            hostId={hostId}
            pairSettings={pairSettings}
            onAdjustStrokes={adjustPairStrokes}
            onSetAGives={setPairAGives}
          />

          <Text style={styles.sectionLabel}>Stakes</Text>
          <View style={styles.stakesCard}>
            <View style={styles.stakesLeft}>
              <Coffee size={18} color={palette.orange[700]} />
              <Text style={styles.stakesLabel}>Per hole</Text>
            </View>
            <View style={styles.stakesStepper}>
              <Pressable style={styles.stakesStepperButton} disabled={!isHostViewer} onPress={() => setStake(stakePerHole - 1)}>
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
                  editable={isHostViewer}
                  style={styles.stakesInput}
                />
              </View>
              <Pressable style={styles.stakesStepperButton} disabled={!isHostViewer} onPress={() => setStake(stakePerHole + 1)}>
                <Plus size={16} color={palette.orange[600]} />
              </Pressable>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={starting ? 'Starting…' : isHostViewer ? 'Start round' : 'Waiting for host to start'}
            variant="accent"
            size="lg"
            block
            disabled={starting || loading || !isHostViewer}
            onPress={handleStartRound}
            icon={<Flag size={19} color={colors.textOnAccent} />}
          />
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
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
  loadErrorText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.statusDanger,
    marginBottom: spacing[3],
  },
  loadingText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
  },
  playersHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2] + 1,
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
  },
  waitingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  waitingText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: palette.orange[700],
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
  playerRowHost: {
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
  hostBadge: {
    backgroundColor: palette.green[100],
    borderRadius: radius.xs + 2,
    paddingVertical: 1,
    paddingHorizontal: spacing[1] + 2,
  },
  hostBadgeLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 10,
    color: colors.primary,
  },
  playerMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: 1,
  },
  openSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
    borderWidth: 1.5,
    borderColor: palette.sand[400],
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    padding: spacing[3] - 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  openSlotAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  openSlotText: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: palette.sand[500],
  },
  openSlotInvite: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: colors.primary,
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
  strokesBasisField: {
    marginBottom: spacing[3] + 2,
  },
  fieldLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing[2] - 1,
  },
  strokesBasisRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  strokesBasisToggle: {
    flex: 1,
    height: 46,
    borderRadius: radius.md - 1,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strokesBasisToggleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadows.sm,
  },
  strokesBasisToggleDisabled: {
    opacity: 0.5,
  },
  strokesBasisLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: colors.textDisabled,
  },
  strokesBasisLabelActive: {
    color: colors.textInverse,
  },
  strokesBasisHint: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: spacing[2] - 1,
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
  footer: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[3],
    paddingBottom: spacing[5],
    backgroundColor: colors.surfacePage,
  },
});
