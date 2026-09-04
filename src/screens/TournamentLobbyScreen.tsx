import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Info, Minus, Pencil, Plus, Share2, Trophy } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { BottomSheet } from '../components/BottomSheet';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import type { InRoundTab } from '../components/InRoundTabBar';
import { InRoundTabBar } from '../components/InRoundTabBar';
import { System36NoHandicapCallout } from '../components/System36NoHandicapCallout';
import { System36RuleCards } from '../components/System36RuleCards';
import type { Course as CatalogCourse, TeeColor } from '../data/courses';
import { fetchCourseCatalog, getComboHoles } from '../data/courses';
import { TEE_COLORS, teePresentation } from '../data/tees';
import { computeCourseHandicap, computePlayingHandicap, fetchComboRating } from '../data/handicap';
import { startMatch } from '../data/matches';
import { useFinishRedirect } from '../hooks/useFinishRedirect';
import type { TournamentLobby, TournamentLobbyPlayer, TournamentPlayerSeatPatch } from '../data/tournaments';
import { fetchTournamentLobby, setSkinsParticipant, updateTournamentPlayerSeat } from '../data/tournaments';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../state/AuthContext';
import { colors, getFontFamily, getSolidAvatarColor, palette, radius, screenGutter, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'TournamentLobby'>;


const TIE_RULE_LABEL: Record<string, string> = { carryover: 'Carries over', split_pot: 'Splits immediately', void: "Void — doesn't carry" };

type Rating = { courseRating: number; slopeRating: number };

export function TournamentLobbyScreen({ navigation, route }: Props) {
  const { tournamentId, matchId } = route.params;
  const { session } = useAuth();
  const viewerId = session?.user.id;
  const [lobby, setLobby] = useState<TournamentLobby | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [skinsSheetOpen, setSkinsSheetOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [ratings, setRatings] = useState<Partial<Record<TeeColor, Rating>>>({});
  const [teeSheetPlayerId, setTeeSheetPlayerId] = useState<string | null>(null);
  const [handicapSheetPlayerId, setHandicapSheetPlayerId] = useState<string | null>(null);
  const [seatError, setSeatError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    fetchCourseCatalog()
      .then(setCatalog)
      .catch(() => {});
  }, []);

  const course = catalog.find((c) => c.id === lobby?.courseId);
  const combo = course?.combos.find((c) => c.id === lobby?.comboId);
  const coursePar = useMemo(() => {
    if (!course || !combo) return null;
    return getComboHoles(course, combo.id).reduce((sum, h) => sum + h.par, 0);
  }, [course, combo]);

  useEffect(() => {
    if (!course || !combo) return;
    let cancelled = false;
    Promise.all(TEE_COLORS.map((tee) => fetchComboRating(course.id, combo.id, tee).then((r) => [tee, r] as const)))
      .then((entries) => {
        if (cancelled) return;
        const next: Partial<Record<TeeColor, Rating>> = {};
        entries.forEach(([tee, r]) => {
          if (r) next[tee] = r;
        });
        setRatings(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [course, combo]);

  function autoPlayingHandicap(handicapIndex: number | null, tee: TeeColor): number {
    const rating = ratings[tee];
    if (handicapIndex === null || coursePar === null || !rating || !lobby) return 0;
    const courseHandicap = computeCourseHandicap(handicapIndex, rating.slopeRating, rating.courseRating, coursePar);
    return computePlayingHandicap(courseHandicap, lobby.handicapAllowancePct);
  }

  /** Optimistic seat edit (tee/handicap) — mirrors S4's updatePlayer, riding the same host-can-edit-any-seat / self-row RLS policies. */
  async function updatePlayerSeat(playerId: string, patch: TournamentPlayerSeatPatch) {
    if (!lobby) return;
    const prevLobby = lobby;
    setSeatError(null);
    setLobby({
      ...lobby,
      players: lobby.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              teeColor: patch.teeColor ?? p.teeColor,
              playingHandicap: patch.playingHandicap ?? p.playingHandicap,
              handicapOverride: patch.handicapOverride ?? p.handicapOverride,
            }
          : p,
      ),
    });
    try {
      await updateTournamentPlayerSeat(matchId, playerId, patch);
    } catch {
      setLobby(prevLobby);
      setSeatError("Couldn't save that change — please try again.");
    }
  }

  const load = useCallback(() => {
    return fetchTournamentLobby(tournamentId)
      .then((data) => {
        setLobby(data);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [tournamentId]);

  // Instant refresh whenever this screen regains focus (e.g. navigating back
  // from Tee box) — the realtime channel below is what covers everyone else's
  // out-of-band changes (another player joining/toggling Skins, the host
  // starting the round) while this screen just sits open and never re-focuses.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Realtime: another player joining, editing their tee/handicap/Skins
  // opt-in, or the host starting the round should show up without the
  // viewer having to navigate away and back — same proven pattern as
  // MatchLobbyScreen's own lobby channel / useTournamentRound's in-round one.
  const channelId = useRef(Math.random().toString(36).slice(2)).current;
  useEffect(() => {
    let syncTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleSync = () => {
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        load().catch(() => {});
      }, 250);
    };

    const channel = supabase
      .channel(`tournament-lobby-${matchId}-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, scheduleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_players', filter: `match_id=eq.${matchId}` }, scheduleSync)
      .subscribe();

    // postgres_changes isn't guaranteed delivery — bounds how long any client
    // can stay out of sync without noticing (same fallback useTournamentRound uses).
    // 20s, not 6s — see useLiveRound's identical change for why.
    const pollTimer = setInterval(() => {
      load().catch(() => {});
    }, 20000);

    return () => {
      if (syncTimer) clearTimeout(syncTimer);
      clearInterval(pollTimer);
      supabase.removeChannel(channel);
    };
  }, [matchId, channelId, load]);

  // Previously the host's own "Start scoring" tap navigated THEM straight to
  // S7, but everyone else just sat on the Lobby tab until they noticed the
  // status pill flip to "THRU 0" and tapped "Continue scoring" themselves —
  // the realtime channel above kept their view honest, it just never acted
  // on it. wasLive tracks the edge (not-live -> live) so a joined player
  // sitting here when the host starts gets pulled into the scorecard
  // automatically, while someone who deliberately taps back to the Lobby
  // tab mid-round (already live on mount) is left alone.
  const wasLive = useRef<boolean | null>(null);
  useEffect(() => {
    if (!lobby) return;
    const nowLive = lobby.matchStatus !== 'lobby';
    const justWentLive = wasLive.current === false && nowLive;
    wasLive.current = nowLive;
    if (!justWentLive) return;
    const viewer = lobby.players.find((p) => p.id === viewerId);
    if (viewer?.status !== 'joined') return;
    navigation.navigate('TournamentScorecard', { tournamentId, matchId });
  }, [lobby, viewerId, navigation, tournamentId, matchId]);

  // Same gap, other end of the round: a joined player who's back on the
  // Lobby tab (checking Format & rules, Skins) when the host finishes should
  // land on the recap too, not be left reading "THRU 18" forever.
  useFinishRedirect(
    lobby?.matchStatus ?? 'lobby',
    loading,
    useCallback(() => navigation.navigate('TournamentFinish', { tournamentId, matchId }), [navigation, tournamentId, matchId]),
  );

  async function copyCode() {
    if (!lobby) return;
    await Clipboard.setStringAsync(`GK-${lobby.tournamentCode}`);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1500);
  }

  function handleTabNavigate(tab: InRoundTab) {
    if (tab === 'lobby') return;
    if (tab === 'leaderboard') navigation.navigate('TournamentLeaderboard', { tournamentId, matchId });
    else if (tab === 'finish') navigation.navigate('TournamentFinish', { tournamentId, matchId });
    // Scorecard only makes sense once the round has started (the
    // "Start/Continue scoring" CTA above already covers that) — no-op.
  }

  async function toggleSkinsParticipant(playerId: string) {
    if (!lobby) return;
    const skins = lobby.sideGames.find((g) => g.type === 'skins');
    if (!skins) return;
    const optingIn = !skins.participantIds.includes(playerId);
    const nextParticipantIds = optingIn ? [...skins.participantIds, playerId] : skins.participantIds.filter((id) => id !== playerId);

    const prevLobby = lobby;
    setSeatError(null);
    setLobby({ ...lobby, sideGames: lobby.sideGames.map((g) => (g.type === 'skins' ? { ...g, participantIds: nextParticipantIds } : g)) });
    try {
      await setSkinsParticipant(matchId, playerId, optingIn);
    } catch {
      setLobby(prevLobby); // revert on failure
      setSeatError("Couldn't save that change — please try again.");
    }
  }

  /** Host's first tap flips the match live (startMatch is a generic status
   * flip, no Kaki-specific side effects — see data/matches.ts); a
   * non-host's "Continue scoring" tap just navigates, since only the host
   * has update rights on `matches`. Either way lands on S7 (live scoring),
   * kept deliberately separate from the Kaki Match Play Scorecard/
   * useLiveRound stack — see useTournamentRound's docblock for why. */
  async function handleStartOrContinueScoring() {
    if (starting) return;
    if (isHostViewer && lobby?.matchStatus === 'lobby') {
      setStarting(true);
      setStartError(null);
      try {
        await startMatch(matchId);
      } catch {
        setStarting(false);
        setStartError("Couldn't start the round — please try again.");
        return;
      }
      setStarting(false);
    }
    navigation.navigate('TournamentScorecard', { tournamentId, matchId });
  }

  if (loading) {
    return (
      <View style={styles.page}>
        <SafeAreaView style={styles.centerFill}>
          <Text style={styles.loadingText}>Loading tournament…</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (error || !lobby) {
    return (
      <View style={styles.page}>
        <SafeAreaView style={styles.centerFill}>
          <Text style={styles.loadingText}>Couldn't load this tournament.</Text>
        </SafeAreaView>
      </View>
    );
  }

  const skins = lobby.sideGames.find((g) => g.type === 'skins');
  const isSystem36 = lobby.scoringFormat === 'system_36';
  const isStableford = lobby.scoringFormat === 'stableford';
  const holeCount = course && combo ? getComboHoles(course, combo.id).length : 18;
  const tieBreakLabel = lobby.tieBreakRule === 'countback' ? 'Back-9 countback' : 'Shared place';
  const joinedPlayers = lobby.players.filter((p) => p.status === 'joined');
  const displayCode = `GK-${lobby.tournamentCode}`;
  const isLive = lobby.matchStatus !== 'lobby';
  // The underlying matches UPDATE RLS policy is host-only (mirrors every
  // other round-settings edit in this codebase, e.g. InGameLobbyScreen's
  // MatchupEditor hostOnlyEdit) — a non-host tap would just fail and revert,
  // so gate it in the UI too rather than let it look interactive and fail silently.
  const isHostViewer = viewerId !== undefined && viewerId === lobby.hostId;
  const viewerPlayer = lobby.players.find((p) => p.id === viewerId);
  // Tee/handicap: the host can edit anyone's seat (host-can-update-any-seat
  // policy), and everyone can edit their own (pre-existing self-row policy)
  // — mirrors S4's PlayerRow. Locks the moment the round goes live, same
  // cutoff as Skins participation above.
  const canEditPlayer = (playerId: string) => !isLive && (isHostViewer || playerId === viewerId);
  const teeSheetPlayer = lobby.players.find((p) => p.id === teeSheetPlayerId);
  const handicapSheetPlayer = lobby.players.find((p) => p.id === handicapSheetPlayerId);

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
              <Text style={styles.headerTitle}>{lobby.name}</Text>
              <Text style={styles.headerSubtitle}>
                {isSystem36 ? 'System 36 · Individual' : `${isStableford ? 'Stableford' : 'Stroke play'} · Nett ${lobby.handicapAllowancePct}%`}
              </Text>
            </View>
            <View style={styles.statusPill}>
              {isLive ? <View style={styles.statusDot} /> : null}
              <Text style={styles.statusPillLabel}>{isLive ? `THRU ${lobby.thru}` : 'Ready to start'}</Text>
            </View>
          </View>
          <View style={styles.headerDivider} />
          <View style={styles.codeRow}>
            <View style={styles.codeRowLeft}>
              <Text style={styles.codeRowLabel}>Invite code</Text>
              <Text style={styles.codeRowValue}>{displayCode}</Text>
            </View>
            <View style={styles.codeActions}>
              <Pressable style={styles.codeIconButton} onPress={copyCode}>
                <Copy size={14} color={palette.white} />
              </Pressable>
              <Pressable style={styles.codeIconButton}>
                <Share2 size={14} color={palette.white} />
              </Pressable>
            </View>
          </View>
          {codeCopied ? <Text style={styles.copiedHint}>Copied</Text> : null}
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {isSystem36 ? (
            <>
              <View>
                <Text style={styles.sectionLabel}>Round details</Text>
                <View style={styles.detailCard}>
                  <View style={[styles.detailRow, styles.detailRowLast]}>
                    <Text style={styles.detailKey}>Course</Text>
                    <Text style={styles.detailValue}>
                      {course?.name ?? '…'} · {holeCount} holes
                    </Text>
                  </View>
                </View>
              </View>
              <System36NoHandicapCallout text="No handicaps to enter — each is worked out from the round, 36 minus System 36 points." />
              <Text style={styles.sectionLabel}>How scoring works</Text>
              <System36RuleCards />
            </>
          ) : null}

          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>In the field</Text>
              <Text style={styles.sectionCaption}>{lobby.players.length} players</Text>
            </View>
            <View style={styles.playerList}>
              {lobby.players.map((player, index) => (
                <FieldRow
                  key={player.id}
                  player={player}
                  colorIndex={index}
                  courseId={course?.id ?? null}
                  editable={canEditPlayer(player.id)}
                  showPlayingHandicap={!isSystem36}
                  onOpenTee={() => setTeeSheetPlayerId(player.id)}
                  onOpenHandicap={() => setHandicapSheetPlayerId(player.id)}
                />
              ))}
            </View>
            {seatError ? <Text style={styles.seatErrorText}>{seatError}</Text> : null}
          </View>

          {isSystem36 ? (
            <View>
              <Text style={styles.sectionLabel}>Format &amp; rules</Text>
              <View style={styles.detailCard}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Format</Text>
                  <Text style={styles.detailValue}>System 36 · Stableford</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Winner</Text>
                  <Text style={styles.detailValue}>Most points wins</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Tie-break</Text>
                  <Text style={styles.detailValue}>{tieBreakLabel}</Text>
                </View>
                <View style={[styles.detailRow, styles.detailRowLast]}>
                  <Text style={styles.detailKey}>Scoring</Text>
                  <Text style={styles.detailValue}>All {lobby.players.length} players enter own</Text>
                </View>
              </View>
              <View style={styles.noteCard}>
                <Info size={14} color={colors.primary} style={styles.noteIcon} />
                <Text style={styles.noteText}>Format is locked for this round. Handicaps are derived at the end, then Stableford points are settled.</Text>
              </View>
            </View>
          ) : null}

          {isStableford ? (
            <View>
              <Text style={styles.sectionLabel}>Format &amp; rules</Text>
              <View style={styles.detailCard}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Format</Text>
                  <Text style={styles.detailValue}>Stableford · Nett {lobby.handicapAllowancePct}%</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Winner</Text>
                  <Text style={styles.detailValue}>Most points wins</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Tie-break</Text>
                  <Text style={styles.detailValue}>{tieBreakLabel}</Text>
                </View>
                <View style={[styles.detailRow, styles.detailRowLast]}>
                  <Text style={styles.detailKey}>Scoring</Text>
                  <Text style={styles.detailValue}>All {lobby.players.length} players enter own</Text>
                </View>
              </View>
              <View style={styles.noteCard}>
                <Info size={14} color={colors.primary} style={styles.noteIcon} />
                <Text style={styles.noteText}>Handicaps and format lock once the round starts. Points are scored off each player's nett par.</Text>
              </View>
            </View>
          ) : null}

          {skins ? (
            <View>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>Side game · Skins</Text>
                <View style={styles.standingsLink}>
                  <Trophy size={13} color={colors.primary} />
                  <Text style={styles.standingsLinkLabel}>Standings in Leaderboard</Text>
                </View>
              </View>
              <View style={styles.skinsCard}>
                <View style={styles.skinsRow}>
                  <Text style={styles.skinsRowLabel}>Stake per skin</Text>
                  <Text style={styles.skinsRowValue}>${skins.stakePerHole} / hole</Text>
                </View>
                <View style={styles.skinsRow}>
                  <Text style={styles.skinsRowLabel}>Tied hole</Text>
                  <Text style={styles.skinsRowValue}>{TIE_RULE_LABEL[skins.tiedHoleRule]}</Text>
                </View>
                <Pressable style={[styles.skinsRow, styles.skinsRowLast]} onPress={() => setSkinsSheetOpen(true)}>
                  <Text style={styles.skinsRowLabel}>In the game</Text>
                  <View style={styles.inGameRight}>
                    <View style={styles.avatarStack}>
                      {skins.participantIds.slice(0, 4).map((id, i) => {
                        const p = joinedPlayers.find((pl) => pl.id === id);
                        return (
                          <View key={id} style={[styles.stackAvatar, { backgroundColor: getSolidAvatarColor(i), marginLeft: i === 0 ? 0 : -8 }]}>
                            <Text style={styles.stackAvatarLabel}>{p?.name[0]?.toUpperCase() ?? '?'}</Text>
                          </View>
                        );
                      })}
                    </View>
                    <Text style={styles.inGameCount}>
                      {skins.participantIds.length} of {joinedPlayers.length}
                    </Text>
                    <ChevronRight size={15} color={palette.soon.labelUpcoming} />
                  </View>
                </Pressable>
              </View>
              <View style={styles.noteCard}>
                <Info size={14} color={colors.primary} style={styles.noteIcon} />
                <Text style={styles.noteText}>
                  Settings are locked once the round starts.
                  {skins.tiedHoleRule === 'carryover' ? ' Any carried skins on the 18th are split between the tied players.' : ''}
                </Text>
              </View>
            </View>
          ) : null}
        </ScrollView>

        {viewerPlayer?.status === 'joined' ? (
          <View style={styles.footer}>
            {startError ? <Text style={styles.seatErrorText}>{startError}</Text> : null}
            {isHostViewer || isLive ? (
              <Button
                label={starting ? 'Starting…' : isLive ? 'Continue scoring' : 'Start scoring'}
                variant="accent"
                size="lg"
                block
                disabled={starting}
                onPress={handleStartOrContinueScoring}
              />
            ) : (
              <Button label="Waiting for host to start" variant="ghost" size="lg" block disabled />
            )}
          </View>
        ) : null}

        <InRoundTabBar active="lobby" onNavigate={handleTabNavigate} />
      </SafeAreaView>

      <BottomSheet
        visible={skinsSheetOpen}
        onClose={() => setSkinsSheetOpen(false)}
        title="Skins participation"
        subtitle={isHostViewer ? 'Tap a player to add or remove them from the pot' : "Only the host can change who's in — here's who's playing"}
      >
        {joinedPlayers.map((p, i) => {
          const on = skins?.participantIds.includes(p.id) ?? false;
          return (
            <Pressable
              key={p.id}
              style={styles.whoRow}
              disabled={!isHostViewer}
              onPress={() => toggleSkinsParticipant(p.id)}
            >
              <View style={[styles.whoAvatar, { backgroundColor: getSolidAvatarColor(i) }]}>
                <Text style={styles.whoAvatarLabel}>{p.name[0]?.toUpperCase()}</Text>
              </View>
              <View style={styles.whoBody}>
                <Text style={styles.whoName}>{p.name}</Text>
                <Text style={styles.whoMeta}>Index {p.handicapIndex ?? '—'}</Text>
              </View>
              <View style={[styles.whoStatusTag, on ? styles.whoStatusTagOn : styles.whoStatusTagOff]}>
                <Text style={[styles.whoStatusLabel, on ? styles.whoStatusLabelOn : styles.whoStatusLabelOff]}>{on ? 'Playing' : 'Add to pot'}</Text>
              </View>
            </Pressable>
          );
        })}
        <View style={styles.noteCard}>
          <Info size={14} color={colors.primary} style={styles.noteIcon} />
          <Text style={styles.noteText}>Locks once the round starts — everyone toggled on here antes into every hole.</Text>
        </View>
      </BottomSheet>

      <BottomSheet
        visible={teeSheetPlayer !== undefined}
        onClose={() => setTeeSheetPlayerId(null)}
        title="Tee box"
        subtitle={teeSheetPlayer && course ? `${teeSheetPlayer.name} · ${course.name}` : undefined}
      >
        {teeSheetPlayer
          ? TEE_COLORS.map((tee) => {
              const rating = ratings[tee];
              const yardage = course && combo ? getComboHoles(course, combo.id).reduce((sum, h) => sum + h.yardageM[tee], 0) : null;
              const selected = teeSheetPlayer.teeColor === tee;
              const pres = teePresentation(course?.id, tee);
              return (
                <Pressable
                  key={tee}
                  style={styles.teeRow}
                  onPress={() => {
                    const patch: TournamentPlayerSeatPatch = { teeColor: tee };
                    // System 36 never uses a stored playing handicap (it's
                    // derived from play as 36 − points), so a tee change only
                    // updates the tee — no Play HC to recompute.
                    if (!isSystem36 && !teeSheetPlayer.handicapOverride) patch.playingHandicap = autoPlayingHandicap(teeSheetPlayer.handicapIndex, tee);
                    updatePlayerSeat(teeSheetPlayer.id, patch);
                    setTeeSheetPlayerId(null);
                  }}
                >
                  <View style={[styles.teeRowDot, { backgroundColor: pres.dot }, pres.dotBorder ? styles.teeRowDotBordered : null]} />
                  <View style={styles.teeRowBody}>
                    <Text style={styles.teeRowName}>{pres.label}</Text>
                    <Text style={styles.teeRowMeta}>
                      {pres.description}
                      {rating ? ` · CR ${rating.courseRating.toFixed(1)} · Slope ${rating.slopeRating}` : ''}
                      {yardage ? ` · ${yardage.toLocaleString()} m` : ''}
                    </Text>
                  </View>
                  {selected ? <Check size={19} color={colors.primary} /> : null}
                </Pressable>
              );
            })
          : null}
        <View style={styles.noteCard}>
          <Info size={15} color={colors.primary} style={styles.noteIcon} />
          <Text style={styles.noteText}>
            {isSystem36
              ? 'Each tee has its own yardage. System 36 works out the handicap from play, so changing tee won’t change anyone’s Play HC.'
              : "Each tee has its own course rating & slope — this recalculates the player's Play HC for fair nett scoring."}
          </Text>
        </View>
      </BottomSheet>

      <HandicapEditSheet
        player={handicapSheetPlayer ?? null}
        autoValue={handicapSheetPlayer ? autoPlayingHandicap(handicapSheetPlayer.handicapIndex, handicapSheetPlayer.teeColor) : 0}
        onClose={() => setHandicapSheetPlayerId(null)}
        onSave={(value, override) => {
          if (!handicapSheetPlayer) return;
          updatePlayerSeat(handicapSheetPlayer.id, { playingHandicap: value, handicapOverride: override });
          setHandicapSheetPlayerId(null);
        }}
      />
    </View>
  );
}

function FieldRow({
  player,
  colorIndex,
  courseId,
  editable,
  showPlayingHandicap,
  onOpenTee,
  onOpenHandicap,
}: {
  player: TournamentLobbyPlayer;
  colorIndex: number;
  courseId: string | null;
  editable: boolean;
  /** System 36 derives each handicap from play (36 − points) — there's nothing to set pre-round, so the Play HC tile is hidden entirely (see SY6). */
  showPlayingHandicap: boolean;
  onOpenTee: () => void;
  onOpenHandicap: () => void;
}) {
  const teePres = teePresentation(courseId, player.teeColor);
  const initials = player.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View style={styles.fieldRow}>
      <View style={[styles.avatar, { backgroundColor: getSolidAvatarColor(colorIndex) }]}>
        <Text style={styles.avatarLabel}>{initials}</Text>
      </View>
      <View style={styles.playerInfo}>
        <View style={styles.playerNameRow}>
          <Text style={styles.playerName}>{player.name}</Text>
          {player.isHost ? (
            <View style={styles.hostTag}>
              <Text style={styles.hostTagLabel}>Host</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.playerMeta}>
          Index {player.handicapIndex ?? '—'}
          {player.handicapOverride ? <Text style={styles.overrideText}> · manual override</Text> : ''}
        </Text>
      </View>
      <Pressable style={styles.teeChip} onPress={onOpenTee} disabled={!editable}>
        <View style={[styles.teeChipDot, { backgroundColor: teePres.dot }, teePres.dotBorder ? styles.teeChipDotBordered : null]} />
        <Text style={styles.teeChipLabel}>{teePres.label}</Text>
        {editable ? <ChevronDown size={11} color={palette.soon.labelUpcoming} /> : null}
      </Pressable>
      {showPlayingHandicap ? (
        <Pressable style={[styles.hcTile, player.handicapOverride && styles.hcTileOverridden]} onPress={onOpenHandicap} disabled={!editable}>
          <Text style={[styles.hcTileValue, player.handicapOverride && styles.hcTileValueOverridden]}>{player.playingHandicap}</Text>
          {editable ? <Pencil size={10} color={player.handicapOverride ? colors.statusWarning : colors.primary} style={styles.hcTilePencil} /> : null}
        </Pressable>
      ) : null}
    </View>
  );
}

function HandicapEditSheet({
  player,
  autoValue,
  onClose,
  onSave,
}: {
  player: TournamentLobbyPlayer | null;
  autoValue: number;
  onClose: () => void;
  onSave: (value: number, override: boolean) => void;
}) {
  const [draftValue, setDraftValue] = useState(0);
  // Keeps rendering the last-open player's content while the sheet animates
  // closed — same reasoning as TournamentPlayersScreen's HandicapEditSheet.
  const [displayPlayer, setDisplayPlayer] = useState<TournamentLobbyPlayer | null>(null);

  useEffect(() => {
    if (player) {
      setDraftValue(player.playingHandicap);
      setDisplayPlayer(player);
    }
  }, [player]);

  const overriding = player && displayPlayer ? draftValue !== autoValue : false;
  const initials = displayPlayer
    ? displayPlayer.name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '';

  return (
    <BottomSheet
      visible={player !== null}
      onClose={onClose}
      scrollable={false}
      footer={
        displayPlayer ? (
          <View style={styles.row}>
            <Pressable style={styles.resetButton} onPress={() => setDraftValue(autoValue)}>
              <Text style={styles.resetButtonLabel}>Reset to auto</Text>
            </Pressable>
            <Button label="Save" variant="secondary" size="lg" style={styles.saveButton} onPress={() => onSave(draftValue, overriding)} />
          </View>
        ) : null
      }
    >
      {displayPlayer ? (
        <>
          <View style={styles.handicapSheetHeader}>
            <View style={[styles.avatar, styles.handicapSheetAvatar, { backgroundColor: getSolidAvatarColor(0) }]}>
              <Text style={styles.avatarLabel}>{initials}</Text>
            </View>
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>{displayPlayer.name}</Text>
              <Text style={styles.playerMeta}>
                Index {displayPlayer.handicapIndex ?? '—'} · auto Play HC would be {autoValue}
              </Text>
            </View>
          </View>
          <Text style={styles.fieldLabel}>Playing handicap</Text>
          <View style={styles.stepperRow}>
            <Pressable style={styles.stepperButton} onPress={() => setDraftValue((v) => Math.max(0, v - 1))}>
              <Minus size={18} color={colors.primary} />
            </Pressable>
            <TextInput
              style={[styles.stepperValue, overriding && styles.stepperValueOverridden]}
              value={String(draftValue)}
              onChangeText={(text) => {
                const n = parseInt(text.replace(/[^0-9]/g, ''), 10);
                setDraftValue(Number.isNaN(n) ? 0 : Math.max(0, n));
              }}
              keyboardType="number-pad"
              selectTextOnFocus
              maxLength={3}
            />
            <Pressable style={styles.stepperButton} onPress={() => setDraftValue((v) => v + 1)}>
              <Plus size={18} color={colors.primary} />
            </Pressable>
          </View>
          <View style={[styles.overrideNote, !overriding && styles.overrideNoteHidden]}>
            <Pencil size={15} color={colors.statusWarning} style={styles.noteIcon} />
            <Text style={styles.overrideNoteText}>Manual override active — this player keeps {draftValue} strokes even if their index changes.</Text>
          </View>
        </>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surfacePage },
  safeArea: { flex: 1 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: colors.textDisabled,
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
  headerTitleGroup: { flex: 1, minWidth: 0 },
  headerTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 19,
    color: palette.white,
  },
  headerSubtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.pill,
    paddingVertical: spacing[1] + 2,
    paddingHorizontal: spacing[2] + 2,
    flexShrink: 0,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  statusPillLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    color: '#FFC79E',
  },
  headerDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginTop: spacing[3] + 2,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[3] + 1,
  },
  codeRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  codeRowLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  codeRowValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1.4,
    color: palette.white,
  },
  codeActions: {
    flexDirection: 'row',
    gap: spacing[1] + 3,
  },
  codeIconButton: {
    width: 30,
    height: 30,
    borderRadius: radius.sm + 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copiedHint: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'right',
    marginTop: 4,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: screenGutter, paddingTop: spacing[4], paddingBottom: spacing[6], gap: spacing[4] },
  detailCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.lg - 2,
    paddingHorizontal: spacing[3] + 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2] + 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailKey: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: colors.textSecondary,
    flexShrink: 0,
  },
  detailValue: {
    flex: 1,
    marginLeft: spacing[3],
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.textPrimary,
    textAlign: 'right',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  sectionLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  sectionCaption: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
  },
  standingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
  },
  standingsLinkLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    color: colors.primary,
  },
  playerList: {
    gap: spacing[2],
  },
  fieldRow: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: palette.green[200],
    borderRadius: radius.md,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2] + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 2,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 13,
    color: palette.white,
  },
  playerInfo: { flex: 1, minWidth: 0 },
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
  hostTag: {
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1,
    borderColor: palette.green[200],
    borderRadius: radius.pill,
    paddingHorizontal: spacing[2] - 1,
    paddingVertical: 1,
  },
  hostTagLabel: {
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
  teeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.sm,
    width: 68,
    justifyContent: 'center',
    paddingVertical: spacing[1],
  },
  teeChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  teeChipDotBordered: {
    borderWidth: 1,
    borderColor: palette.tee.whiteBorder,
  },
  teeChipLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 10,
    color: colors.textSecondary,
  },
  hcTile: {
    width: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1,
    borderColor: palette.green[200],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
    paddingVertical: spacing[1] + 2,
  },
  hcTileOverridden: {
    backgroundColor: '#FBEFD0',
    borderColor: '#E5CE8E',
  },
  hcTileValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.primary,
  },
  hcTileValueOverridden: {
    color: '#9A6B12',
  },
  hcTilePencil: {
    opacity: 0.6,
  },
  overrideText: {
    color: palette.score.eagle,
  },
  skinsCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.lg - 2,
    paddingHorizontal: spacing[3] + 2,
  },
  skinsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2] + 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSunken,
  },
  skinsRowLast: {
    borderBottomWidth: 0,
  },
  skinsRowLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: colors.textSecondary,
  },
  skinsRowValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 13,
    color: colors.textPrimary,
  },
  inGameRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackAvatarLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 9,
    color: palette.white,
  },
  inGameCount: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: spacing[2],
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    padding: spacing[2] + 2,
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1,
    borderColor: palette.green[200],
    borderRadius: radius.md,
    marginTop: spacing[2] + 1,
  },
  noteIcon: { marginTop: 1 },
  noteText: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  whoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
    paddingVertical: spacing[2],
  },
  whoAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whoAvatarLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 13,
    color: palette.white,
  },
  whoBody: { flex: 1, minWidth: 0 },
  whoName: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: colors.textPrimary,
  },
  whoMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
  },
  whoStatusTag: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing[2] + 3,
    paddingVertical: spacing[1] + 1,
    borderWidth: 1,
  },
  whoStatusTagOn: {
    backgroundColor: colors.surfaceBrandSoft,
    borderColor: palette.green[200],
  },
  whoStatusTagOff: {
    backgroundColor: colors.surfaceCard,
    borderColor: colors.borderDefault,
  },
  whoStatusLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
  },
  whoStatusLabelOn: {
    color: colors.primary,
  },
  whoStatusLabelOff: {
    color: colors.textDisabled,
  },
  seatErrorText: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: colors.statusDanger,
    marginTop: spacing[2],
  },
  footer: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[3],
    paddingBottom: spacing[2] + 2,
    backgroundColor: colors.surfacePage,
    gap: spacing[2],
  },
  fieldLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing[2] - 1,
  },
  row: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  teeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2] + 2,
  },
  teeRowDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    flexShrink: 0,
  },
  teeRowDotBordered: {
    borderWidth: 1,
    borderColor: palette.tee.whiteBorder,
  },
  teeRowBody: {
    flex: 1,
    minWidth: 0,
  },
  teeRowName: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: colors.textPrimary,
  },
  teeRowMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: 1,
  },
  handicapSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 2,
    marginBottom: spacing[4],
  },
  handicapSheetAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[5] + 2,
    marginBottom: spacing[3] + 2,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1.5,
    borderColor: palette.green[200],
    alignItems: 'center',
    justifyContent: 'center',
    // Without this, the TextInput's browser-default intrinsic width
    // (react-native-web renders it as a real <input>) can demand more room
    // than the row has, and flexbox shrinks these fixed-size buttons down
    // to make space instead — collapsing them under the number.
    flexShrink: 0,
  },
  stepperValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 40,
    color: colors.primary,
    width: 80,
    textAlign: 'center',
    padding: 0,
    margin: 0,
    borderWidth: 0,
  },
  stepperValueOverridden: {
    color: '#9A6B12',
  },
  overrideNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2] + 1,
    padding: spacing[3] - 1,
    backgroundColor: '#FBEFD0',
    borderWidth: 1,
    borderColor: '#E5CE8E',
    borderRadius: radius.md,
    marginBottom: spacing[4],
  },
  overrideNoteHidden: {
    opacity: 0,
  },
  overrideNoteText: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: '#7A5A17',
    lineHeight: 17,
  },
  resetButton: {
    flex: 1,
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1.5,
    borderColor: palette.green[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: colors.textSecondary,
  },
  saveButton: {
    flex: 1,
  },
});
