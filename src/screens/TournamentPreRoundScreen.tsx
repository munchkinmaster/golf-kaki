import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from '@react-navigation/native';
import { Check, ChevronLeft, CircleCheckBig, Clock, Copy, Flag, Info, MapPin, Pencil, Settings2, Share2, Trash2, Trophy, UserPlus, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { System36NoHandicapCallout } from '../components/System36NoHandicapCallout';
import { System36RuleCards } from '../components/System36RuleCards';
import type { Course as CatalogCourse } from '../data/courses';
import { fetchCourseCatalog, getComboHoles } from '../data/courses';
import { teePresentation } from '../data/tees';
import { startMatch } from '../data/matches';
import { createTournament, fetchTournamentLobby, removeTournamentPlayer, setSkinsParticipant } from '../data/tournaments';
import type { RootStackParamList, TournamentStackParamList } from '../navigation/types';
import { useAuth } from '../state/AuthContext';
import type { TournamentPlayerDraft } from '../state/TournamentDraftContext';
import { useTournamentDraft } from '../state/TournamentDraftContext';
import { colors, getFontFamily, getSolidAvatarColor, palette, radius, screenGutter, spacing } from '../theme/tokens';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<TournamentStackParamList, 'TournamentPreRound'>;

const TIE_RULE_SUMMARY: Record<string, { label: string; sub: string }> = {
  carryover: { label: 'carryover', sub: "18th-hole tie splits the carried pot" },
  split_pot: { label: 'split pot', sub: 'Ties split immediately — no carry' },
  void: { label: 'no carry', sub: 'Tied holes are void, out of the pot' },
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sat 29 Aug · 7:20 am" — the review's Date row. Built by hand rather than
 * toLocaleString to keep the exact spec format (no comma, lowercase am/pm)
 * stable across platforms/locales. */
function formatRoundDate(d: Date): string {
  let hour = d.getHours();
  const ampm = hour < 12 ? 'am' : 'pm';
  hour = hour % 12 || 12;
  const time = `${hour}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`;
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} · ${time}`;
}

export function TournamentPreRoundScreen({ navigation }: Props) {
  const { session } = useAuth();
  const viewerId = session?.user.id;
  const { draft, update } = useTournamentDraft();

  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchCourseCatalog()
      .then(setCatalog)
      .catch(() => {});
  }, []);

  // The draft is a local, client-only snapshot from when the wizard last
  // touched it — once the real tournament/match row exists (matchId set),
  // other players joining (or joining by code, bypassing this wizard
  // entirely) or toggling Skins from their own device never reaches this
  // screen's state on its own.
  const loadLiveRoster = useCallback(() => {
    if (!draft.matchId || !draft.tournamentId) return Promise.resolve();
    return fetchTournamentLobby(draft.tournamentId)
      .then((lobby) => {
        update({
          players: lobby.players.map((p) => ({
            id: p.id,
            name: p.name,
            handicapIndex: p.handicapIndex,
            isHost: p.isHost,
            status: p.status,
            tee: p.teeColor,
            playingHandicap: p.playingHandicap,
            handicapOverride: p.handicapOverride,
          })),
          sideGames: lobby.sideGames,
        });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- update is stable (Provider-scoped useCallback with [] deps)
  }, [draft.matchId, draft.tournamentId]);

  // Refetch on every focus (backing out and back in)...
  useFocusEffect(
    useCallback(() => {
      loadLiveRoster();
    }, [loadLiveRoster]),
  );

  // ...plus a realtime channel + poll fallback for a host who just STAYS on
  // this review step waiting for people to accept — focus alone never
  // refires for them. Same gap TournamentPlayersScreen had (see its own
  // identical fix) — every other live tournament screen already covers this.
  const channelId = useRef(Math.random().toString(36).slice(2)).current;
  useEffect(() => {
    if (!draft.matchId) return;
    let syncTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleSync = () => {
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        loadLiveRoster();
      }, 250);
    };

    const channel = supabase
      .channel(`tournament-preround-${draft.matchId}-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_players', filter: `match_id=eq.${draft.matchId}` }, scheduleSync)
      .subscribe();

    const pollTimer = setInterval(() => {
      loadLiveRoster();
    }, 20000);

    return () => {
      if (syncTimer) clearTimeout(syncTimer);
      clearInterval(pollTimer);
      supabase.removeChannel(channel);
    };
  }, [draft.matchId, channelId, loadLiveRoster]);

  const course = catalog.find((c) => c.id === draft.courseId);
  const combo = course?.combos.find((c) => c.id === draft.comboId);
  const displayCode = `GK-${draft.code}`;
  const skins = draft.sideGames.find((g) => g.type === 'skins');
  const joinedPlayers = draft.players.filter((p) => p.status === 'joined');
  const invitedPlayers = draft.players.filter((p) => p.status === 'invited');

  const isSystem36 = draft.format === 'system_36';
  const isStableford = draft.format === 'stableford';
  const holeCount = course && combo ? getComboHoles(course, combo.id).length : 18;
  const tieBreakLabel = draft.tieBreakRule === 'countback' ? 'Back-9 countback' : 'Shared place';
  // No scheduled-time field exists on the draft (a round starts the moment
  // the host taps Create & start scoring), so the review's Date row reflects
  // "now" — captured once at mount so it doesn't tick while the screen is open.
  const [roundDateLabel] = useState(() => formatRoundDate(new Date()));

  async function copyCode() {
    await Clipboard.setStringAsync(displayCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1500);
  }

  function shareCode() {
    Share.share({ message: `Join my tournament "${draft.name}" on Golf Kaki — enter code ${displayCode} to sign up.` }).catch(() => {});
  }

  async function removePlayer(id: string) {
    const prevPlayers = draft.players;
    const prevSideGames = draft.sideGames;
    setActionError(null);
    update({
      players: draft.players.filter((p) => p.id !== id),
      sideGames: skins
        ? draft.sideGames.map((g) => (g.type === 'skins' ? { ...g, participantIds: g.participantIds.filter((p) => p !== id) } : g))
        : draft.sideGames,
    });
    if (draft.matchId) {
      try {
        await removeTournamentPlayer(draft.matchId, id);
      } catch {
        update({ players: prevPlayers, sideGames: prevSideGames });
        setActionError('Could not remove that player — please try again.');
      }
    }
  }

  async function toggleSkinsParticipant(id: string) {
    if (!skins) return;
    const prevSideGames = draft.sideGames;
    const optingIn = !skins.participantIds.includes(id);
    const participantIds = optingIn ? [...skins.participantIds, id] : skins.participantIds.filter((p) => p !== id);
    setActionError(null);
    update({ sideGames: draft.sideGames.map((g) => (g.type === 'skins' ? { ...g, participantIds } : g)) });
    if (draft.matchId) {
      try {
        await setSkinsParticipant(draft.matchId, id, optingIn);
      } catch {
        update({ sideGames: prevSideGames });
        setActionError('Could not update Skins — please try again.');
      }
    }
  }

  async function handleCreate() {
    if (creating) return;
    setCreateError(null);
    setCreating(true);
    try {
      let tournamentId = draft.tournamentId;
      let matchId = draft.matchId;

      // Might already exist — the host's first invite on S4 created the real
      // tournament/match row. Only insert when it doesn't yet.
      if (!tournamentId || !matchId) {
        if (!viewerId || !draft.courseId || !draft.comboId) {
          setCreating(false);
          return;
        }
        const created = await createTournament({
          hostId: viewerId,
          tournamentCode: draft.code,
          name: draft.name,
          playAs: draft.playAs,
          roundStructure: draft.roundStructure,
          scoringFormat: draft.format,
          standingsBasis: draft.standingsBasis,
          handicapAllowancePct: draft.handicapAllowancePct,
          tieBreakRule: draft.tieBreakRule,
          courseId: draft.courseId,
          comboId: draft.comboId,
          startHole: draft.startHole,
          players: draft.players.map((p) => ({
            id: p.id,
            isHost: p.isHost,
            status: p.status,
            handicapIndex: p.handicapIndex,
            teeColor: p.tee,
            playingHandicap: p.playingHandicap,
            handicapOverride: p.handicapOverride,
          })),
          sideGames: draft.sideGames,
        });
        tournamentId = created.tournamentId;
        matchId = created.matchId;
        update({ tournamentId, matchId });
      }

      const parent = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
      if (isSystem36) {
        // "Create & start scoring": System 36 has no in-game lobby step, so
        // flip the match live here and go straight to the scorecard (SY7).
        await startMatch(matchId);
        parent?.navigate('TournamentScorecard', { tournamentId, matchId });
      } else {
        // Stroke play still routes through the in-game lobby, where the host
        // taps Start scoring to flip the match live.
        parent?.navigate('TournamentLobby', { tournamentId, matchId });
      }
    } catch {
      setCreateError('Could not create the tournament — please try again.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {isSystem36 ? (
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
                <ChevronLeft size={20} color="rgba(255,255,255,0.8)" />
              </Pressable>
              <View style={styles.headerTitleGroup}>
                <Text style={styles.headerTitle}>{draft.name}</Text>
                <Text style={styles.headerSubtitle}>System 36 · Individual</Text>
              </View>
              <View style={styles.notStartedPill}>
                <Clock size={12} color="rgba(255,255,255,0.85)" />
                <Text style={styles.notStartedLabel}>NOT STARTED</Text>
              </View>
            </View>
            <View style={styles.headerDivider} />
            <View style={styles.headerCodeRow}>
              <View style={styles.headerCodeLeft}>
                <Text style={styles.headerCodeLabel}>Invite code</Text>
                <Text style={styles.headerCodeValue}>{displayCode}</Text>
              </View>
              <View style={styles.codeActions}>
                <Pressable style={styles.headerCodeButton} onPress={copyCode}>
                  {codeCopied ? <CircleCheckBig size={14} color={palette.white} /> : <Copy size={14} color={palette.white} />}
                </Pressable>
                <Pressable style={styles.headerCodeButton} onPress={shareCode}>
                  <Share2 size={14} color={palette.white} />
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
                <X size={20} color="rgba(255,255,255,0.8)" />
              </Pressable>
              <View style={styles.headerTitleGroup}>
                <Text style={styles.headerTitle}>{draft.name}</Text>
                <Text style={styles.headerSubtitle}>
                {isStableford ? 'Stableford' : 'Stroke play'} · Nett {draft.handicapAllowancePct}%
              </Text>
              </View>
              <View style={styles.settingsButton}>
                <Settings2 size={16} color={palette.white} />
              </View>
            </View>
            <View style={styles.headerDivider} />
            <View style={styles.readyPill}>
              <View style={styles.readyDot} />
              <Text style={styles.readyLabel}>Ready to start</Text>
            </View>
          </View>
        )}

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {isSystem36 ? (
            <>
              <View>
                <Text style={styles.sectionLabel}>Round details</Text>
                <View style={styles.detailCard}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Course</Text>
                    <Text style={styles.detailValue}>
                      {course?.name ?? '…'} · {holeCount} holes
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Date</Text>
                    <Text style={styles.detailValue}>{roundDateLabel}</Text>
                  </View>
                  <View style={[styles.detailRow, styles.detailRowLast]}>
                    <Text style={styles.detailKey}>Field</Text>
                    <Text style={styles.detailValue}>
                      {draft.players.length} player{draft.players.length === 1 ? '' : 's'} · 1 flight
                    </Text>
                  </View>
                </View>
              </View>

              <System36NoHandicapCallout text="No handicaps to enter — each is worked out from the round, 36 minus System 36 points." />

              <View>
                <Text style={styles.sectionLabel}>How scoring works</Text>
                <System36RuleCards />
              </View>

              <View>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabel}>Who’s playing</Text>
                  <Text style={styles.sectionCaption}>{draft.players.length} players</Text>
                </View>
                <View style={styles.playerList}>
                  {draft.players.map((player, index) => {
                    const initials = player.name
                      .split(' ')
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();
                    const teePres = teePresentation(draft.courseId, player.tee);
                    return (
                      <View key={player.id} style={styles.reviewRow}>
                        <View style={[styles.avatar, { backgroundColor: getSolidAvatarColor(index) }]}>
                          <Text style={styles.avatarLabel}>{initials}</Text>
                        </View>
                        <View style={styles.playerInfo}>
                          <View style={styles.playerNameRow}>
                            <Text style={styles.playerName}>
                              {player.name}
                              {player.isHost ? ' (you)' : ''}
                            </Text>
                            {player.isHost ? (
                              <View style={styles.hostTag}>
                                <Text style={styles.hostTagLabel}>Host</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.reviewIndex}>Index {player.handicapIndex ?? '—'}</Text>
                        </View>
                        <View style={styles.teeColumn}>
                          <View style={styles.teePillStatic}>
                            <View
                              style={[styles.teeDot, { backgroundColor: teePres.dot }, teePres.dotBorder ? styles.teeDotBordered : null]}
                            />
                            <Text style={styles.teePillLabel}>{teePres.label}</Text>
                          </View>
                          <Text style={styles.teeCaption}>Tee</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

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
                  {/* System 36's own review previously dropped Skins entirely once it
                      diverged from the stroke-play branch below — a host reviewing a
                      System 36 round before starting couldn't see or toggle who's in
                      the side game at all, even though they'd just configured it on S5
                      and the Lobby screen shows it fine once the round exists. Mirrors
                      the stroke-play branch's identical block. */}
                  {skins ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Side game</Text>
                      <View style={styles.rulesRowValueGroup}>
                        <Text style={styles.detailValue}>
                          Skins · ${skins.stakePerHole}/hole · {TIE_RULE_SUMMARY[skins.tiedHoleRule]?.label}
                        </Text>
                        <Text style={styles.rulesRowSub}>{TIE_RULE_SUMMARY[skins.tiedHoleRule]?.sub}</Text>
                      </View>
                    </View>
                  ) : null}
                  {skins ? (
                    <View style={styles.playingSkinsBlock}>
                      <View style={styles.playingSkinsHeader}>
                        <Text style={styles.detailKey}>Playing skins</Text>
                        <Text style={styles.tapToToggle}>tap to toggle</Text>
                      </View>
                      <View style={styles.pillRow}>
                        {joinedPlayers.map((p, i) => {
                          const on = skins.participantIds.includes(p.id);
                          return (
                            <Pressable key={p.id} style={[styles.pill, on ? styles.pillOn : styles.pillOff]} onPress={() => toggleSkinsParticipant(p.id)}>
                              <View style={[styles.pillAvatar, { backgroundColor: on ? getSolidAvatarColor(i) : palette.ink[300] }]}>
                                <Text style={styles.pillAvatarLabel}>{p.name[0]?.toUpperCase()}</Text>
                              </View>
                              <Text style={[styles.pillLabel, on ? styles.pillLabelOn : styles.pillLabelOff]}>{p.name.split(' ')[0]}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      {invitedPlayers.length > 0 ? (
                        <Text style={styles.playingSkinsNote}>
                          {invitedPlayers.map((p) => p.name.split(' ')[0]).join(' and ')} pick{invitedPlayers.length === 1 ? 's' : ''} when they accept.
                          Anyone left out still plays the round.
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                  <View style={[styles.detailRow, styles.detailRowLast]}>
                    <Text style={styles.detailKey}>Scoring</Text>
                    <Text style={styles.detailValue}>All {draft.players.length} players enter own</Text>
                  </View>
                </View>
                <View style={styles.infoCallout}>
                  <Info size={14} color={colors.primary} style={styles.infoIcon} />
                  <Text style={styles.infoText}>
                    Format locks once the round starts. Handicaps are derived at the end, then Stableford points are settled.
                  </Text>
                </View>
              </View>
            </>
          ) : (
          <>
          {!bannerDismissed ? (
            <View style={styles.createdBanner}>
              <View style={styles.createdBannerIcon}>
                <Check size={18} color={palette.white} />
              </View>
              <View style={styles.createdBannerBody}>
                <Text style={styles.createdBannerTitle}>Round ready</Text>
                <Text style={styles.createdBannerSubtitle}>Share the code so your kaki can join</Text>
              </View>
              <Pressable onPress={() => setBannerDismissed(true)}>
                <X size={17} color={colors.textDisabled} />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.courseCard}>
            <View style={styles.courseCardIcon}>
              <MapPin size={18} color={colors.primary} />
            </View>
            <View style={styles.courseCardBody}>
              <Text style={styles.courseCardName}>{course?.name ?? '…'}</Text>
              <Text style={styles.courseCardMeta}>
                {combo?.label ?? ''} · tees set per player{draft.startHole !== 1 ? ` · starts hole ${draft.startHole}` : ''}
              </Text>
            </View>
          </View>

          <View style={styles.codeRow}>
            <View>
              <Text style={styles.codeLabel}>Invite code</Text>
              <Text style={styles.codeValue}>{displayCode}</Text>
            </View>
            <View style={styles.codeActions}>
              <Pressable style={styles.codeButtonOutline} onPress={copyCode}>
                {codeCopied ? <CircleCheckBig size={16} color={colors.primary} /> : <Copy size={16} color={colors.primary} />}
              </Pressable>
              <Pressable style={styles.codeButtonSolid} onPress={shareCode}>
                <Share2 size={16} color={palette.white} />
              </Pressable>
            </View>
          </View>

          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>Players · {draft.players.length}</Text>
              <Text style={styles.sectionCaption}>
                {joinedPlayers.length} confirmed · {invitedPlayers.length} invited
              </Text>
            </View>
            {actionError ? <Text style={styles.actionErrorText}>{actionError}</Text> : null}
            <View style={styles.playerList}>
              {draft.players.map((player, index) => (
                <PlayerRow key={player.id} player={player} colorIndex={index} courseId={draft.courseId} onRemove={player.isHost ? undefined : () => removePlayer(player.id)} />
              ))}
              <Pressable style={styles.inviteMoreButton} onPress={() => navigation.navigate('TournamentPlayers')}>
                <UserPlus size={16} color={colors.textSecondary} />
                <Text style={styles.inviteMoreLabel}>Invite more players</Text>
              </Pressable>
              <Text style={styles.swipeHint}>Swipe a player left to remove them.</Text>
            </View>
          </View>

          <View>
            <Text style={styles.sectionLabel}>Format &amp; rules</Text>
            <View style={styles.rulesCard}>
              <View style={styles.rulesRow}>
                <Text style={styles.rulesRowLabel}>Format</Text>
                <Text style={styles.rulesRowValue}>
                  {isStableford ? 'Stableford' : 'Stroke play'} · Nett {draft.handicapAllowancePct}%
                </Text>
              </View>
              {skins ? (
                <View style={styles.rulesRow}>
                  <Text style={styles.rulesRowLabel}>Side game</Text>
                  <View style={styles.rulesRowValueGroup}>
                    <Text style={styles.rulesRowValue}>
                      Skins · ${skins.stakePerHole}/hole · {TIE_RULE_SUMMARY[skins.tiedHoleRule]?.label}
                    </Text>
                    <Text style={styles.rulesRowSub}>{TIE_RULE_SUMMARY[skins.tiedHoleRule]?.sub}</Text>
                  </View>
                </View>
              ) : null}
              {skins ? (
                <View style={styles.playingSkinsBlock}>
                  <View style={styles.playingSkinsHeader}>
                    <Text style={styles.rulesRowLabel}>Playing skins</Text>
                    <Text style={styles.tapToToggle}>tap to toggle</Text>
                  </View>
                  <View style={styles.pillRow}>
                    {joinedPlayers.map((p, i) => {
                      const on = skins.participantIds.includes(p.id);
                      return (
                        <Pressable key={p.id} style={[styles.pill, on ? styles.pillOn : styles.pillOff]} onPress={() => toggleSkinsParticipant(p.id)}>
                          <View style={[styles.pillAvatar, { backgroundColor: on ? getSolidAvatarColor(i) : palette.ink[300] }]}>
                            <Text style={styles.pillAvatarLabel}>{p.name[0]?.toUpperCase()}</Text>
                          </View>
                          <Text style={[styles.pillLabel, on ? styles.pillLabelOn : styles.pillLabelOff]}>{p.name.split(' ')[0]}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {invitedPlayers.length > 0 ? (
                    <Text style={styles.playingSkinsNote}>
                      {invitedPlayers.map((p) => p.name.split(' ')[0]).join(' and ')} pick{invitedPlayers.length === 1 ? 's' : ''} when they accept. Anyone
                      left out still plays the round.
                    </Text>
                  ) : null}
                </View>
              ) : null}
              <View style={[styles.rulesRow, styles.rulesRowLast]}>
                <Text style={styles.rulesRowLabel}>Scoring</Text>
                <Text style={styles.rulesRowValue}>All {draft.players.length} players enter own</Text>
              </View>
            </View>
          </View>
          </>
          )}
        </ScrollView>

        {isSystem36 ? (
          <View style={styles.footer}>
            {createError ? <Text style={styles.createErrorText}>{createError}</Text> : null}
            <View style={styles.s36FooterRow}>
              <Pressable style={styles.editButton} onPress={() => navigation.goBack()}>
                <Pencil size={20} color={colors.primary} />
              </Pressable>
              <Pressable
                style={[styles.createButton, styles.createButtonFlex, creating && styles.createButtonDisabled]}
                onPress={handleCreate}
                disabled={creating}
              >
                <Flag size={18} color={palette.white} />
                <Text style={styles.createButtonLabel}>{creating ? 'Creating…' : 'Create & start scoring'}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.footer}>
            {createError ? <Text style={styles.createErrorText}>{createError}</Text> : null}
            <Pressable style={[styles.createButton, creating && styles.createButtonDisabled]} onPress={handleCreate} disabled={creating}>
              <Trophy size={18} color={palette.white} />
              <Text style={styles.createButtonLabel}>{creating ? 'Creating…' : 'Create tournament'}</Text>
            </Pressable>
            <Text style={styles.footerCaption}>Everyone here? Tee off and start scoring</Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const REMOVE_WIDTH = 76;

function PlayerRow({ player, colorIndex, courseId, onRemove }: { player: TournamentPlayerDraft; colorIndex: number; courseId: string | null; onRemove?: () => void }) {
  const teePres = teePresentation(courseId, player.tee);
  const translateX = useRef(new Animated.Value(0)).current;
  const dragStart = useRef(0);

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) => onRemove !== undefined && Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderGrant: () => {
        dragStart.current = (translateX as unknown as { __getValue: () => number }).__getValue();
      },
      onPanResponderMove: (_evt, gesture) => {
        const next = Math.min(0, Math.max(-REMOVE_WIDTH, dragStart.current + gesture.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_evt, gesture) => {
        const shouldOpen = gesture.dx < -REMOVE_WIDTH / 2 || gesture.vx < -0.5;
        Animated.spring(translateX, { toValue: shouldOpen ? -REMOVE_WIDTH : 0, useNativeDriver: true, bounciness: 0 }).start();
      },
    }),
  ).current;

  function handleRemove() {
    Animated.timing(translateX, { toValue: 0, duration: 1, useNativeDriver: true }).start();
    onRemove?.();
  }

  const initials = player.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const row = (
    <View style={[styles.playerRow, player.status === 'invited' && styles.playerRowInvited]}>
      <View style={[styles.avatar, { backgroundColor: getSolidAvatarColor(colorIndex) }]}>
        <Text style={styles.avatarLabel}>{initials}</Text>
      </View>
      <View style={styles.playerInfo}>
        <View style={styles.playerNameRow}>
          <Text style={player.status === 'invited' ? styles.playerNameInvited : styles.playerName}>{player.name}</Text>
          {player.isHost ? (
            <View style={styles.hostTag}>
              <Text style={styles.hostTagLabel}>Host</Text>
            </View>
          ) : null}
        </View>
        {player.status === 'joined' ? (
          <View style={styles.playerMetaRow}>
            <Text style={styles.playerMeta}>Play HC {player.playingHandicap}</Text>
            <Text style={styles.playerMetaDot}>·</Text>
            <View style={[styles.metaDot, { backgroundColor: teePres.dot }, teePres.dotBorder ? styles.metaDotBordered : null]} />
            <Text style={styles.playerMeta}>{teePres.label}</Text>
          </View>
        ) : (
          <View style={styles.playerMetaRow}>
            <Text style={styles.playerMetaInvited}>Invited · awaiting reply</Text>
            <Text style={styles.playerMetaDot}>·</Text>
            <View style={[styles.metaDot, { backgroundColor: teePres.dot }, teePres.dotBorder ? styles.metaDotBordered : null]} />
            <Text style={styles.playerMetaInvited}>{teePres.label}</Text>
          </View>
        )}
      </View>
      {player.status === 'joined' ? (
        <CircleCheckBig size={18} color="#1E8A4C" />
      ) : (
        <View style={styles.invitedTag}>
          <Text style={styles.invitedTagLabel}>Invited</Text>
        </View>
      )}
    </View>
  );

  if (!onRemove) return row;

  return (
    <View style={styles.swipeWrap}>
      <View style={styles.swipeRemoveBackdrop}>
        <Pressable style={styles.swipeRemoveButton} onPress={handleRemove}>
          <Trash2 size={18} color={palette.white} />
          <Text style={styles.swipeRemoveLabel}>Remove</Text>
        </Pressable>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...responder.panHandlers}>
        {row}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surfacePage },
  safeArea: { flex: 1 },
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
  settingsButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginTop: spacing[3] + 2,
  },
  readyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.pill,
    paddingVertical: spacing[1] + 2,
    paddingHorizontal: spacing[2] + 3,
    marginTop: spacing[3] + 2,
  },
  readyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7FD173',
  },
  readyLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    color: '#B7E3B0',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: screenGutter, paddingTop: spacing[4], paddingBottom: spacing[6], gap: spacing[3] + 2 },
  createdBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1,
    borderColor: palette.green[200],
    borderRadius: radius.lg - 2,
    padding: spacing[3] - 1,
  },
  createdBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md - 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  createdBannerBody: { flex: 1, minWidth: 0 },
  createdBannerTitle: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: colors.textPrimary,
  },
  createdBannerSubtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  courseCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.lg,
    padding: spacing[3] + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
  },
  courseCardIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md - 1,
    backgroundColor: colors.surfaceBrandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  courseCardBody: { flex: 1, minWidth: 0 },
  courseCardName: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: colors.textPrimary,
  },
  courseCardMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: 1,
  },
  codeRow: {
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1.5,
    borderColor: palette.green[200],
    borderStyle: 'dashed',
    borderRadius: radius.lg - 2,
    paddingVertical: spacing[2] + 3,
    paddingLeft: spacing[4] - 1,
    paddingRight: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  codeValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 20,
    letterSpacing: 2,
    color: colors.primary,
    marginTop: 2,
  },
  codeActions: {
    flexDirection: 'row',
    gap: spacing[1] + 2,
  },
  codeButtonOutline: {
    width: 38,
    height: 38,
    borderRadius: radius.sm + 1,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: palette.green[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeButtonSolid: {
    width: 38,
    height: 38,
    borderRadius: radius.sm + 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: spacing[2],
  },
  sectionCaption: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
  },
  playerList: {
    gap: spacing[2],
  },
  swipeWrap: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  swipeRemoveBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: REMOVE_WIDTH,
    backgroundColor: colors.statusDanger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeRemoveButton: {
    alignItems: 'center',
    gap: 2,
  },
  swipeRemoveLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 10,
    color: palette.white,
  },
  playerRow: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: palette.green[200],
    borderRadius: radius.md,
    paddingVertical: spacing[2] + 1,
    paddingHorizontal: spacing[2] + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 2,
  },
  playerRowInvited: {
    borderColor: colors.borderDefault,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
  playerNameInvited: {
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
  playerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
    marginTop: 2,
  },
  playerMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
  },
  playerMetaInvited: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: palette.soon.labelUpcoming,
  },
  playerMetaDot: {
    fontSize: 11,
    color: colors.borderDefault,
  },
  metaDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metaDotBordered: {
    borderWidth: 1,
    borderColor: palette.tee.whiteBorder,
  },
  invitedTag: {
    backgroundColor: '#FBF3E4',
    borderWidth: 1,
    borderColor: '#EAD6AF',
    borderRadius: radius.pill,
    paddingHorizontal: spacing[2] + 1,
    paddingVertical: 3,
  },
  invitedTagLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 10,
    color: '#B4863A',
  },
  inviteMoreButton: {
    height: 46,
    borderWidth: 1.5,
    borderColor: palette.sand[400],
    borderStyle: 'dashed',
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  inviteMoreLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.textSecondary,
  },
  swipeHint: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    lineHeight: 15,
    paddingHorizontal: 2,
  },
  rulesCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.lg - 2,
    paddingHorizontal: spacing[3] + 2,
  },
  rulesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: spacing[2] + 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSunken,
  },
  rulesRowLast: {
    borderBottomWidth: 0,
  },
  rulesRowLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: colors.textSecondary,
    flexShrink: 0,
  },
  rulesRowValue: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.textPrimary,
    textAlign: 'right',
  },
  rulesRowValueGroup: {
    marginLeft: spacing[3],
    alignItems: 'flex-end',
  },
  rulesRowSub: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: 2,
    textAlign: 'right',
  },
  playingSkinsBlock: {
    paddingVertical: spacing[2] + 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSunken,
  },
  playingSkinsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2] + 1,
  },
  tapToToggle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1] + 3,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
    borderRadius: radius.pill,
    paddingLeft: 3,
    paddingRight: spacing[2] + 3,
    paddingVertical: 3,
    borderWidth: 1,
  },
  pillOn: {
    backgroundColor: '#FFF3E9',
    borderColor: '#F4C79B',
  },
  pillOff: {
    backgroundColor: palette.soon.surface,
    borderColor: colors.borderDefault,
  },
  pillAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillAvatarLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 10,
    color: palette.white,
  },
  pillLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
  },
  pillLabelOn: {
    color: '#9A5A1E',
  },
  pillLabelOff: {
    color: colors.textDisabled,
  },
  playingSkinsNote: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    lineHeight: 15,
    marginTop: spacing[2] + 1,
  },
  footer: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[2] + 2,
    paddingBottom: spacing[4],
    backgroundColor: colors.surfacePage,
    gap: spacing[2] + 1,
  },
  createErrorText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.statusDanger,
    textAlign: 'center',
  },
  actionErrorText: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: colors.statusDanger,
    marginBottom: spacing[2],
  },
  createButton: {
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2] + 1,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 16,
    color: palette.white,
  },
  footerCaption: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.textDisabled,
    textAlign: 'center',
  },
  // ---- System 36 review (SY6) ----
  notStartedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.pill,
    paddingVertical: spacing[1] + 2,
    paddingHorizontal: spacing[2] + 2,
    flexShrink: 0,
  },
  notStartedLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
  },
  headerCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[3] + 1,
  },
  headerCodeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  headerCodeLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  headerCodeValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1.2,
    color: palette.white,
  },
  headerCodeButton: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  reviewRow: {
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
  reviewIndex: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: 2,
  },
  teeColumn: {
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  teePillStatic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.sm,
    width: 68,
    justifyContent: 'center',
    paddingVertical: spacing[1],
  },
  teeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  teeDotBordered: {
    borderWidth: 1,
    borderColor: palette.tee.whiteBorder,
  },
  teePillLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 10,
    color: colors.textSecondary,
  },
  teeCaption: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 8,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textDisabled,
    marginTop: 2,
  },
  infoCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    marginTop: spacing[2] + 1,
    paddingVertical: spacing[2] + 1,
    paddingHorizontal: spacing[3],
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1,
    borderColor: palette.green[200],
    borderRadius: radius.md,
  },
  infoIcon: {
    marginTop: 1,
    flexShrink: 0,
  },
  infoText: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  s36FooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
  },
  editButton: {
    width: 54,
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  createButtonFlex: {
    flex: 1,
  },
});
