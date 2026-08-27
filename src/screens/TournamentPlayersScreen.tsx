import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowRight, Check, ChevronDown, CircleCheckBig, Copy, Info, Minus, Pencil, Plus, Search, Share2, Trophy, User, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { System36NoHandicapCallout } from '../components/System36NoHandicapCallout';
import { TournamentWizardHeader } from '../components/TournamentWizardHeader';
import type { Course as CatalogCourse, TeeColor } from '../data/courses';
import { fetchCourseCatalog, getComboHoles } from '../data/courses';
import { TEE_COLORS, teePresentation } from '../data/tees';
import { computeCourseHandicap, computePlayingHandicap, fetchComboRating } from '../data/handicap';
import { fetchKakiOverview } from '../data/kaki';
import { createTournament, fetchTournamentLobby, inviteTournamentPlayer, removeTournamentPlayer, updateTournamentPlayerSeat } from '../data/tournaments';
import type { TournamentStackParamList } from '../navigation/types';
import { useAuth } from '../state/AuthContext';
import { useProfile } from '../state/ProfileContext';
import type { TournamentPlayerDraft } from '../state/TournamentDraftContext';
import { useTournamentDraft } from '../state/TournamentDraftContext';
import { colors, getFontFamily, getSolidAvatarColor, palette, radius, screenGutter, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<TournamentStackParamList, 'TournamentPlayers'>;


type Rating = { courseRating: number; slopeRating: number };

export function TournamentPlayersScreen({ navigation }: Props) {
  const { session } = useAuth();
  const { profile } = useProfile();
  const viewerId = session?.user.id;
  const { draft, update } = useTournamentDraft();

  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [ratings, setRatings] = useState<Partial<Record<TeeColor, Rating>>>({});
  const [friendsQuery, setFriendsQuery] = useState('');
  const [friends, setFriends] = useState<{ id: string; name: string; handle: string; handicap: number | null }[]>([]);
  const [friendsError, setFriendsError] = useState(false);
  const [teeSheetPlayerId, setTeeSheetPlayerId] = useState<string | null>(null);
  const [handicapSheetPlayerId, setHandicapSheetPlayerId] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    fetchCourseCatalog()
      .then(setCatalog)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!viewerId) return;
    fetchKakiOverview(viewerId)
      .then((overview) => {
        setFriends(overview.friends.map((f) => ({ id: f.id, name: f.name, handle: f.handle, handicap: f.handicap })));
        setFriendsError(false);
      })
      .catch(() => setFriendsError(true));
  }, [viewerId]);

  // Same reasoning as TournamentPreRoundScreen's identical effect: once the
  // first invite has created the real tournament/match row, an invitee
  // accepting on their own device never reaches this screen's local draft
  // state on its own. Refetch live join status on every focus so a host who
  // stays on this step (or backs out and back in) sees who's actually
  // joined rather than the stale 'invited' snapshot from whenever they were
  // added.
  useFocusEffect(
    useCallback(() => {
      if (!draft.matchId || !draft.tournamentId) return;
      fetchTournamentLobby(draft.tournamentId)
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
    }, [draft.matchId, draft.tournamentId]),
  );

  const course = catalog.find((c) => c.id === draft.courseId);
  const combo = course?.combos.find((c) => c.id === draft.comboId);
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
    if (handicapIndex === null || coursePar === null || !rating) return 0;
    const courseHandicap = computeCourseHandicap(handicapIndex, rating.slopeRating, rating.courseRating, coursePar);
    return computePlayingHandicap(courseHandicap, draft.handicapAllowancePct);
  }

  // Seat the host the moment we know who they are — everyone else joins via search-to-add below.
  useEffect(() => {
    if (draft.players.length > 0 || !viewerId || !profile || !draft.defaultTee) return;
    const tee = draft.defaultTee;
    const host: TournamentPlayerDraft = {
      id: viewerId,
      name: profile.displayName,
      handicapIndex: profile.handicap,
      isHost: true,
      status: 'joined',
      tee,
      playingHandicap: autoPlayingHandicap(profile.handicap, tee),
      handicapOverride: false,
    };
    update({ players: [host] });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only seed once, when we first have the pieces to
  }, [viewerId, profile, draft.defaultTee, draft.players.length]);

  // Recompute every non-overridden joined player's Play HC as rating data / allowance settle in —
  // mirrors the tee sheet's promise that changing tee (or the round's own rules) recalculates it live.
  useEffect(() => {
    if (Object.keys(ratings).length === 0 || coursePar === null || draft.players.length === 0) return;
    const next = draft.players.map((p) =>
      p.handicapOverride || p.status !== 'joined' ? p : { ...p, playingHandicap: autoPlayingHandicap(p.handicapIndex, p.tee) },
    );
    const changed = next.some((p, i) => p.playingHandicap !== draft.players[i]!.playingHandicap);
    if (changed) update({ players: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ratings/coursePar/allowance are the real deps; draft.players is read, not a trigger
  }, [ratings, coursePar, draft.handicapAllowancePct]);

  function updatePlayer(id: string, patch: Partial<TournamentPlayerDraft>) {
    update({ players: draft.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
    // Once the shell exists this player might already be visible to someone
    // else (the host themself, or the invitee once they've joined) — push
    // the edit live too. Best-effort: the host's own view above already
    // reflects their intent regardless of whether this succeeds.
    if (draft.matchId) {
      updateTournamentPlayerSeat(draft.matchId, id, {
        teeColor: patch.tee,
        playingHandicap: patch.playingHandicap,
        handicapOverride: patch.handicapOverride,
      }).catch(() => {});
    }
  }

  // "@handle" (per the search placeholder) is stored with its leading @ (see
  // fromProfileRow in data/kaki.ts) — strip a leading @ off the typed query
  // too, so "@cyc" and "cyc" both match the same way "name" search would.
  const q = friendsQuery.trim().toLowerCase().replace(/^@/, '');
  const addedIds = new Set(draft.players.map((p) => p.id));
  // The whole kaki list is pre-listed below the search bar (same as
  // CreateGameScreen's invite picker) — the query just filters it live,
  // rather than showing nothing until you type.
  const searchResults = friends.filter(
    (f) => !addedIds.has(f.id) && (!q || f.name.toLowerCase().includes(q) || f.handle.toLowerCase().replace(/^@/, '').includes(q)),
  );

  // The FIRST friend added creates the real tournament + match + host row
  // right here — Format/Course/Rules are already locked in by S3, so
  // there's enough to create for real, and the invitee can see and accept
  // immediately instead of waiting for the host to finish S5/S6b. Every
  // invite after that is a live insert against the tournament that already
  // exists. A host who never invites anyone never hits this at all — they
  // still get the single-shot create at S6b.
  async function addFriend(friend: { id: string; name: string; handicap: number | null }) {
    const tee = draft.defaultTee ?? 'white';
    const invited: TournamentPlayerDraft = {
      id: friend.id,
      name: friend.name,
      handicapIndex: friend.handicap,
      isHost: false,
      status: 'invited',
      tee,
      playingHandicap: autoPlayingHandicap(friend.handicap, tee),
      handicapOverride: false,
    };
    const nextPlayers = [...draft.players, invited];
    setFriendsQuery('');
    setInviteError(null);
    setInviteBusyId(friend.id);

    try {
      if (!draft.tournamentId || !draft.matchId) {
        if (!viewerId || !draft.courseId || !draft.comboId) throw new Error('missing setup');
        const { tournamentId, matchId } = await createTournament({
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
          players: nextPlayers.map((p) => ({
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
        update({ players: nextPlayers, tournamentId, matchId });
      } else {
        await inviteTournamentPlayer(draft.matchId, {
          id: invited.id,
          isHost: false,
          status: 'invited',
          handicapIndex: invited.handicapIndex,
          teeColor: invited.tee,
          playingHandicap: invited.playingHandicap,
          handicapOverride: invited.handicapOverride,
        });
        update({ players: nextPlayers });
      }
    } catch {
      setInviteError('Could not invite — please try again.');
    } finally {
      setInviteBusyId(null);
    }
  }

  // Tapping an already-added (non-host) player again cancels their invite —
  // also drops them from any side-game participant list, in case the host
  // came back here after configuring Skins on S5. Live delete once the
  // shell exists, matching addFriend above.
  async function removeFriend(id: string) {
    const prevPlayers = draft.players;
    const prevSideGames = draft.sideGames;
    setInviteError(null);
    setInviteBusyId(id);
    update({
      players: draft.players.filter((p) => p.id !== id),
      sideGames: draft.sideGames.map((g) => (g.type === 'skins' ? { ...g, participantIds: g.participantIds.filter((p) => p !== id) } : g)),
    });
    if (draft.matchId) {
      try {
        await removeTournamentPlayer(draft.matchId, id);
      } catch {
        update({ players: prevPlayers, sideGames: prevSideGames });
        setInviteError('Could not cancel the invite — please try again.');
      }
    }
    setInviteBusyId(null);
  }

  const displayCode = `GK-${draft.code}`;

  async function copyCode() {
    await Clipboard.setStringAsync(displayCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1500);
  }

  function shareCode() {
    Share.share({ message: `Join my tournament "${draft.name}" on Golf Kaki — enter code ${displayCode} to sign up.` }).catch(() => {});
  }

  const isSystem36 = draft.format === 'system_36';
  const playAsLabel = draft.playAs === 'individual' ? 'Individual' : 'Team';
  // System 36 derives every handicap from the round, so its summary drops the
  // Nett% allowance the stroke-play line carries (there's no allowance to show).
  const summaryLine = isSystem36
    ? `System 36 · ${playAsLabel} · ${course?.name ?? '…'}`
    : `Stroke play · ${playAsLabel} · Nett ${draft.handicapAllowancePct}% · ${course?.name ?? '…'}`;
  const joinedCount = draft.players.filter((p) => p.status === 'joined').length;
  const teeSheetPlayer = draft.players.find((p) => p.id === teeSheetPlayerId);
  const handicapSheetPlayer = draft.players.find((p) => p.id === handicapSheetPlayerId);
  const canContinue = draft.players.some((p) => p.isHost);

  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <TournamentWizardHeader step="players" onBack={() => navigation.goBack()} />

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <Trophy size={19} color={colors.accent} />
            </View>
            <View style={styles.heroBody}>
              <Text style={styles.heroTitle}>{draft.name}</Text>
              <Text style={styles.heroSubtitle}>{summaryLine}</Text>
            </View>
          </View>

          <View>
            <Text style={styles.fieldLabel}>
              Tournament code <Text style={styles.fieldLabelMuted}>· share to invite</Text>
            </Text>
            <View style={styles.codeRow}>
              <Text style={styles.codeText}>{displayCode}</Text>
              <View style={styles.codeActions}>
                <Pressable style={styles.codeButtonOutline} onPress={copyCode}>
                  {codeCopied ? <CircleCheckBig size={16} color={colors.primary} /> : <Copy size={16} color={colors.primary} />}
                </Pressable>
                <Pressable style={styles.codeButtonSolid} onPress={shareCode}>
                  <Share2 size={16} color={palette.white} />
                </Pressable>
              </View>
            </View>
          </View>

          {isSystem36 ? (
            <System36NoHandicapCallout text="No handicaps to set — System 36 works each player's handicap out from the round." />
          ) : null}

          <View>
            <View style={styles.fieldHeaderRow}>
              <Text style={styles.fieldLabel}>Field</Text>
              {isSystem36 ? (
                <Text style={styles.fieldCount}>
                  <Text style={styles.fieldCountActive}>{joinedCount}</Text> of {draft.players.length}
                </Text>
              ) : (
                <Text style={styles.fieldCount}>{draft.players.length} players</Text>
              )}
            </View>
            <View style={styles.searchBar}>
              <Search size={16} color={colors.textDisabled} />
              <TextInput
                value={friendsQuery}
                onChangeText={setFriendsQuery}
                placeholder="Search friends by name or @handle"
                placeholderTextColor={palette.soon.labelUpcoming}
                style={styles.searchInput}
              />
            </View>
            {friendsError ? (
              <Text style={styles.searchHintText}>Couldn't load your kaki — check your connection and try again.</Text>
            ) : searchResults.length > 0 ? (
              <View style={styles.searchResults}>
                {searchResults.map((f, index) => (
                  <SearchResultRow key={f.id} friend={f} colorIndex={index} busy={inviteBusyId === f.id} onPress={() => addFriend(f)} />
                ))}
              </View>
            ) : q ? (
              <Text style={styles.searchHintText}>No kaki match "{friendsQuery.trim()}".</Text>
            ) : friends.length === 0 ? (
              <Text style={styles.searchHintText}>Add some kaki first to invite them here.</Text>
            ) : (
              <Text style={styles.searchHintText}>Everyone in your kaki list is already in the field.</Text>
            )}
            {inviteError ? <Text style={styles.inviteErrorText}>{inviteError}</Text> : null}

            <View style={styles.playerList}>
              {draft.players.map((player, index) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  colorIndex={index}
                  courseId={draft.courseId}
                  busy={inviteBusyId === player.id}
                  isSystem36={isSystem36}
                  onOpenTee={() => setTeeSheetPlayerId(player.id)}
                  onOpenHandicap={() => setHandicapSheetPlayerId(player.id)}
                  onRemove={player.isHost ? undefined : () => removeFriend(player.id)}
                />
              ))}
            </View>
          </View>

          {isSystem36 ? null : (
            <View>
              <View style={styles.fieldHeaderRow}>
                <Text style={styles.fieldLabel}>Handicap</Text>
                <Text style={styles.fieldCount}>{course?.name ?? '…'} · tee set per player</Text>
              </View>
              <View style={styles.noteCard}>
                <Info size={15} color={colors.primary} style={styles.noteIcon} />
                <Text style={styles.noteText}>
                  Index → course handicap (slope), then <Text style={styles.noteTextBold}>{draft.handicapAllowancePct}% allowance</Text> gives the Play HC
                  above. Tap a player's Play HC to override manually.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label="Continue"
            variant="accent"
            size="lg"
            block
            disabled={!canContinue}
            onPress={() => navigation.navigate('TournamentSideGames')}
            icon={<ArrowRight size={19} color={colors.textOnAccent} />}
            iconPosition="right"
          />
        </View>
      </SafeAreaView>

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
              const selected = teeSheetPlayer.tee === tee;
              const pres = teePresentation(course?.id, tee);
              return (
                <Pressable
                  key={tee}
                  style={styles.teeRow}
                  onPress={() => {
                    const patch: Partial<TournamentPlayerDraft> = { tee };
                    if (!teeSheetPlayer.handicapOverride) patch.playingHandicap = autoPlayingHandicap(teeSheetPlayer.handicapIndex, tee);
                    updatePlayer(teeSheetPlayer.id, patch);
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
          <Text style={styles.noteText}>Each tee has its own course rating &amp; slope — this recalculates the player's Play HC for fair nett scoring.</Text>
        </View>
      </BottomSheet>

      <HandicapEditSheet
        player={handicapSheetPlayer ?? null}
        autoValue={handicapSheetPlayer ? autoPlayingHandicap(handicapSheetPlayer.handicapIndex, handicapSheetPlayer.tee) : 0}
        onClose={() => setHandicapSheetPlayerId(null)}
        onSave={(value, override) => {
          if (!handicapSheetPlayer) return;
          updatePlayer(handicapSheetPlayer.id, { playingHandicap: value, handicapOverride: override });
          setHandicapSheetPlayerId(null);
        }}
      />
    </View>
  );
}

function SearchResultRow({
  friend,
  colorIndex,
  busy,
  onPress,
}: {
  friend: { id: string; name: string; handle: string; handicap: number | null };
  colorIndex: number;
  busy: boolean;
  onPress: () => void;
}) {
  const initials = friend.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Pressable style={[styles.searchResultRow, busy && styles.rowBusy]} onPress={onPress} disabled={busy}>
      <View style={[styles.searchResultAvatar, { backgroundColor: getSolidAvatarColor(colorIndex) }]}>
        <Text style={styles.searchResultAvatarLabel}>{initials}</Text>
      </View>
      <View style={styles.searchResultInfo}>
        <Text style={styles.searchResultName}>{friend.name}</Text>
        <Text style={styles.searchResultMeta}>{friend.handicap !== null ? `HCP ${friend.handicap}` : 'No handicap yet'}</Text>
      </View>
      <View style={styles.searchResultAddPill}>
        <Text style={styles.searchResultAdd}>{busy ? 'Adding…' : 'Add'}</Text>
      </View>
    </Pressable>
  );
}

function PlayerRow({
  player,
  colorIndex,
  courseId,
  busy,
  isSystem36,
  onOpenTee,
  onOpenHandicap,
  onRemove,
}: {
  player: TournamentPlayerDraft;
  colorIndex: number;
  courseId: string | null;
  busy: boolean;
  isSystem36: boolean;
  onOpenTee: () => void;
  onOpenHandicap: () => void;
  onRemove?: () => void;
}) {
  const teePres = teePresentation(courseId, player.tee);
  const initials = player.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (player.status === 'invited') {
    return (
      <Pressable style={[styles.invitedRow, busy && styles.rowBusy]} onPress={onRemove} disabled={!onRemove || busy}>
        <View style={styles.invitedAvatar}>
          <User size={17} color={palette.soon.labelUpcoming} />
        </View>
        <View style={styles.playerInfo}>
          <View style={styles.playerNameRow}>
            <Text style={styles.invitedName}>{player.name}</Text>
            <View style={styles.invitedTag}>
              <Text style={styles.invitedTagLabel}>Invited</Text>
            </View>
          </View>
          <Text style={styles.invitedMeta}>
            {busy ? 'Cancelling…' : isSystem36 ? 'Waiting to join · tee set when they accept' : 'Waiting to join · tap to cancel invite'}
          </Text>
        </View>
        {isSystem36 ? null : (
          <View style={styles.pendingTile}>
            <X size={16} color={palette.sand[400]} />
          </View>
        )}
      </Pressable>
    );
  }

  // System 36 takes no entered handicap, so the row shows the player's status
  // (Host / Joined) in place of the Index·override meta and drops the Play HC
  // tile entirely — only the tee (which drives SI allocation, not handicap)
  // is still per-player. The tee chip carries a small "TEE" caption to match.
  return (
    <View style={styles.playerRow}>
      <View style={[styles.avatar, { backgroundColor: getSolidAvatarColor(colorIndex) }]}>
        <Text style={styles.avatarLabel}>{initials}</Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>
          {player.name}
          {player.isHost ? ' (you)' : ''}
        </Text>
        {isSystem36 ? (
          <Text style={styles.playerMeta}>{player.isHost ? 'Host' : 'Joined'}</Text>
        ) : (
          <Text style={styles.playerMeta}>
            Index {player.handicapIndex ?? '—'}
            {player.isHost ? ' · host' : player.handicapOverride ? <Text style={styles.overrideText}> · manual override</Text> : ''}
          </Text>
        )}
      </View>
      <View style={styles.teeColumn}>
        <Pressable style={styles.teeChip} onPress={onOpenTee}>
          <View style={[styles.teeChipDot, { backgroundColor: teePres.dot }, teePres.dotBorder ? styles.teeChipDotBordered : null]} />
          <Text style={styles.teeChipLabel}>{teePres.label}</Text>
          <ChevronDown size={11} color={palette.soon.labelUpcoming} />
        </Pressable>
        {isSystem36 ? <Text style={styles.teeCaption}>Tee</Text> : null}
      </View>
      {isSystem36 ? null : (
        <Pressable style={[styles.hcTile, player.handicapOverride && styles.hcTileOverridden]} onPress={onOpenHandicap}>
          <Text style={[styles.hcTileValue, player.handicapOverride && styles.hcTileValueOverridden]}>{player.playingHandicap}</Text>
          <Pencil size={10} color={player.handicapOverride ? colors.statusWarning : colors.primary} style={styles.hcTilePencil} />
        </Pressable>
      )}
    </View>
  );
}

function HandicapEditSheet({
  player,
  autoValue,
  onClose,
  onSave,
}: {
  player: TournamentPlayerDraft | null;
  autoValue: number;
  onClose: () => void;
  onSave: (value: number, override: boolean) => void;
}) {
  const [draftValue, setDraftValue] = useState(0);
  // Keeps rendering the last-open player's content while the sheet animates
  // closed — `player` itself goes null the instant onClose fires (the parent
  // clears handicapSheetPlayerId immediately), but BottomSheet stays mounted
  // for its ~300ms slide-down, and the single <BottomSheet> below (never
  // conditionally swapped, matching every other sheet in this file) needs
  // something to show for that window instead of flashing empty.
  const [displayPlayer, setDisplayPlayer] = useState<TournamentPlayerDraft | null>(null);

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
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: screenGutter, paddingTop: spacing[1], paddingBottom: spacing[6], gap: spacing[4] },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg - 2,
    padding: spacing[3] + 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md - 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBody: { flex: 1, minWidth: 0 },
  heroTitle: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: palette.white,
  },
  heroSubtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 3,
    lineHeight: 17,
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
  codeRow: {
    height: 50,
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1.5,
    borderColor: palette.green[200],
    borderStyle: 'dashed',
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing[4] - 1,
    paddingRight: spacing[1] + 3,
  },
  codeText: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 20,
    letterSpacing: 2,
    color: colors.primary,
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
  fieldHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2] - 1,
  },
  fieldCount: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
  },
  fieldCountActive: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    color: colors.primary,
  },
  searchBar: {
    height: 44,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
    paddingHorizontal: spacing[3] + 2,
    marginBottom: spacing[2],
  },
  searchInput: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 14,
    color: colors.textPrimary,
  },
  searchHintText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    marginBottom: spacing[2],
  },
  inviteErrorText: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: colors.statusDanger,
    marginBottom: spacing[2],
  },
  rowBusy: {
    opacity: 0.55,
  },
  searchResults: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing[2],
    overflow: 'hidden',
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 2,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2] + 1,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSunken,
  },
  searchResultAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  searchResultAvatarLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 12,
    color: palette.white,
  },
  searchResultInfo: {
    flex: 1,
    minWidth: 0,
  },
  searchResultName: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.textPrimary,
  },
  searchResultMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: 1,
  },
  searchResultAddPill: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing[2] + 3,
    paddingVertical: spacing[1] + 1,
    flexShrink: 0,
  },
  searchResultAdd: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 12,
    color: colors.primary,
  },
  playerList: {
    gap: spacing[2],
  },
  playerRow: {
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
  playerInfo: {
    flex: 1,
    minWidth: 0,
  },
  playerName: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: colors.textPrimary,
  },
  playerMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: 1,
  },
  overrideText: {
    color: palette.score.eagle,
  },
  teeColumn: {
    alignItems: 'center',
    alignSelf: 'flex-end',
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
    alignSelf: 'flex-end',
  },
  teeCaption: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 8,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textDisabled,
    marginTop: 2,
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
    alignSelf: 'flex-end',
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
  invitedRow: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1.5,
    borderColor: palette.sand[400],
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2] + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 2,
  },
  invitedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: palette.sand[400],
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
  },
  invitedName: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: colors.textDisabled,
  },
  invitedTag: {
    backgroundColor: '#FBF3E4',
    borderWidth: 1,
    borderColor: '#EAD6AF',
    borderRadius: radius.pill,
    paddingHorizontal: spacing[2] + 1,
    paddingVertical: 1,
  },
  invitedTagLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 10,
    color: '#B4863A',
  },
  invitedMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: palette.soon.labelUpcoming,
    marginTop: 1,
  },
  pendingTile: {
    width: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: palette.sand[400],
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[1] + 2,
    alignSelf: 'flex-end',
  },
  row: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2] + 1,
    padding: spacing[3] - 1,
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1,
    borderColor: palette.green[200],
    borderRadius: radius.md,
    marginTop: spacing[2] + 1,
  },
  noteIcon: {
    marginTop: 1,
  },
  noteText: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  noteTextBold: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    color: colors.primary,
  },
  footer: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[3],
    paddingBottom: spacing[5],
    backgroundColor: colors.surfacePage,
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
    // RN's TextInput default border is native-only noise here — the value
    // reads as a plain stat until tapped, same look as the old <Text>.
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
