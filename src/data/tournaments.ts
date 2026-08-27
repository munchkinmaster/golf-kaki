/**
 * Tournament (stroke play + optional Skins) creation and lobby fetch.
 *
 * S1–S3 (Format/Course/Rules) are still pure local TournamentDraftContext
 * state — nothing about them can change once the tournament exists (see the
 * locked-screen banners on those three), so there's nothing to sync there.
 * From S4 onward, the picture is different: the FIRST player the host
 * invites creates the real tournament + match + host row right there (see
 * createTournament, called from TournamentPlayersScreen) — every invite
 * after that, and the tee/handicap/Skins edits, go live immediately via the
 * functions below, so an invited player can actually see and accept before
 * the host ever reaches S6b. A host who never invites anyone keeps the old
 * single-shot path: everything commits at S6b's "Create tournament" tap.
 *
 * See the migration comment in 20260810120000_tournament_stroke_play.sql for
 * the schema (`tournaments` + `matches.tournament_id` + match_players'
 * tee/handicap columns + `matches.game_settings` for side-game config), and
 * 20260813120000_tournament_player_self_service.sql for match_players.
 * skins_opt_in and the host-can-edit-any-seat policy that the live-edit
 * functions below depend on.
 */

import type { TeeColor } from './courses';
import { generateMatchCodePreview } from './matches';
import type { MatchStatus } from './matches';
import type { SideGameSettings, SkinsConfig } from './skins';
import { isTransientError, sleep, withRetry } from '../lib/retry';
import { supabase } from '../lib/supabase';

export type TournamentPlayAs = 'individual' | 'team';
export type TournamentRoundStructure = 'single' | 'multi';
export type TournamentStandingsBasis = 'nett' | 'gross' | 'both';
export type TournamentTieBreakRule = 'countback' | 'shared_place';
/**
 * Mirrors tournaments.scoring_format (widened to include 'stableford' by
 * 20260827120000_tournament_stableford_format.sql). Now the SAME set of
 * values as TournamentDraftContext's TournamentFormat, so draft.format can
 * be passed straight through at the createTournament call site with no
 * narrowing.
 */
export type TournamentScoringFormat = 'stroke_play' | 'system_36' | 'stableford';

export { generateMatchCodePreview as generateTournamentCodePreview };

export type CreateTournamentPlayer = {
  id: string;
  isHost: boolean;
  status: 'joined' | 'invited';
  handicapIndex: number | null;
  teeColor: TeeColor;
  playingHandicap: number;
  handicapOverride: boolean;
};

export type CreateTournamentParams = {
  hostId: string;
  /** Client-side preview code (see generateMatchCodePreview) so the UI can show/share it before the row exists — same pattern as createMatch's matchCode. */
  tournamentCode: string;
  name: string;
  playAs: TournamentPlayAs;
  roundStructure: TournamentRoundStructure;
  scoringFormat: TournamentScoringFormat;
  standingsBasis: TournamentStandingsBasis;
  handicapAllowancePct: number;
  tieBreakRule: TournamentTieBreakRule;
  courseId: string;
  comboId: string;
  /** Shotgun start — mirrors matches.start_hole. */
  startHole: number;
  players: CreateTournamentPlayer[];
  sideGames: SkinsConfig[];
};

/**
 * Creates the tournament + its (today, always single) match + one
 * match_players row per player currently in `params.players`. Called from
 * two places: TournamentPlayersScreen the moment the host's first invite
 * goes out (players = [host, thatFriend]), or TournamentPreRoundScreen's
 * "Create tournament" for a host who never invited anyone (players =
 * [host]). Two retry reasons, same shape as createMatch: a tournament_code
 * collision (rare, gets a fresh code) or a transient network error (same
 * code, retried after a backoff) — anything else rethrows immediately. The
 * match + match_players insert only runs once the tournament row is
 * actually committed, and is retried on its own (transient-only, via
 * withRetry) rather than looping back into the code dance — a fresh
 * tournament_code retry after that point would leave an orphaned tournament
 * row behind.
 */
export async function createTournament(params: CreateTournamentParams): Promise<{ tournamentId: string; matchId: string; tournamentCode: string }> {
  let code = params.tournamentCode;
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data, error } = await supabase
      .from('tournaments')
      .insert({
        host_id: params.hostId,
        name: params.name,
        tournament_code: code,
        play_as: params.playAs,
        round_structure: params.roundStructure,
        scoring_format: params.scoringFormat,
        standings_basis: params.standingsBasis,
        handicap_allowance_pct: params.handicapAllowancePct,
        tie_break_rule: params.tieBreakRule,
      })
      .select('id')
      .single();

    if (!error) {
      const tournamentId = (data as { id: string }).id;
      const matchId = await createTournamentMatch(tournamentId, params);
      return { tournamentId, matchId, tournamentCode: code };
    }

    const isLastAttempt = attempt === maxAttempts - 1;
    if (error.code === '23505') {
      if (isLastAttempt) throw error;
      code = generateMatchCodePreview();
      continue;
    }
    if (isTransientError(error) && !isLastAttempt) {
      await sleep(400 * 2 ** attempt + Math.random() * 400);
      continue;
    }
    throw error;
  }

  throw new Error('Could not create tournament — please try again.');
}

async function createTournamentMatch(tournamentId: string, params: CreateTournamentParams): Promise<string> {
  return withRetry(async () => {
    const gameSettings: SideGameSettings = { sideGames: params.sideGames };
    // Skins participation lives on match_players.skins_opt_in, not in this
    // jsonb blob (see the module comment) — seed it from whatever the S5
    // config's participantIds were at creation time. No skins game yet?
    // Every row just keeps the column's true default, which is inert until
    // one exists.
    const skinsParticipantIds = params.sideGames.find((g) => g.type === 'skins')?.participantIds ?? null;

    const { data, error } = await supabase
      .from('matches')
      .insert({
        host_id: params.hostId,
        course_id: params.courseId,
        combo_id: params.comboId,
        // Always 18 for this flow — S2 only ever resolves an 18-hole combo.
        // strokes_basis is a Kaki Match Play concept (per-pair restrike at the
        // turn) with no meaning for stroke play/Skins; set to a value that
        // satisfies the shared check constraint and is otherwise unused here.
        holes_to_play: 18,
        strokes_basis: 18,
        start_hole: params.startHole,
        match_name: params.name,
        // Mirrors tournaments.scoring_format — game_mode is the free-text
        // column useLiveRound-adjacent code already keys off, so a
        // System 36 tournament's match carries 'system_36' straight
        // through rather than the two columns disagreeing.
        game_mode: params.scoringFormat,
        golfer_count: params.players.length,
        tournament_id: tournamentId,
        game_settings: gameSettings,
      })
      .select('id')
      .single();
    if (error) throw error;
    const matchId = (data as { id: string }).id;

    const { error: playersError } = await supabase.from('match_players').upsert(
      params.players.map((p) => ({
        match_id: matchId,
        player_id: p.id,
        is_host: p.isHost,
        handicap_at_time: p.handicapIndex,
        status: p.status,
        tee_color: p.teeColor,
        playing_handicap: p.playingHandicap,
        handicap_override: p.handicapOverride,
        ...(skinsParticipantIds ? { skins_opt_in: skinsParticipantIds.includes(p.id) } : {}),
      })),
      { onConflict: 'match_id,player_id', ignoreDuplicates: true },
    );
    if (playersError) throw playersError;

    return matchId;
  });
}

/** Invites one more player to an already-created tournament — TournamentPlayersScreen's 2nd+ Add, once the first invite already created the shell. A real live insert, not local draft state, so the invitee sees it immediately. */
export async function inviteTournamentPlayer(matchId: string, player: CreateTournamentPlayer): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase.from('match_players').insert({
      match_id: matchId,
      player_id: player.id,
      is_host: player.isHost,
      handicap_at_time: player.handicapIndex,
      status: player.status,
      tee_color: player.teeColor,
      playing_handicap: player.playingHandicap,
      handicap_override: player.handicapOverride,
      // Left at the column default (true) — the host can opt them out from
      // S5's "who's in" list or the lobby's Skins sheet afterward.
    });
    if (error) throw error;
  });
}

export type TournamentPlayerSeatPatch = { teeColor?: TeeColor; playingHandicap?: number; handicapOverride?: boolean };

/** Edits one player's tee/handicap on an already-created tournament. The host editing anyone (TournamentPlayersScreen once the shell exists, or S6c) rides the host-can-update-any-seat policy; a player editing their own seat rides the pre-existing self-row policy. */
export async function updateTournamentPlayerSeat(matchId: string, playerId: string, patch: TournamentPlayerSeatPatch): Promise<void> {
  return withRetry(async () => {
    const dbPatch: Record<string, unknown> = {};
    if (patch.teeColor !== undefined) dbPatch.tee_color = patch.teeColor;
    if (patch.playingHandicap !== undefined) dbPatch.playing_handicap = patch.playingHandicap;
    if (patch.handicapOverride !== undefined) dbPatch.handicap_override = patch.handicapOverride;
    if (Object.keys(dbPatch).length === 0) return;
    const { error } = await supabase.from('match_players').update(dbPatch).eq('match_id', matchId).eq('player_id', playerId);
    if (error) throw error;
  });
}

/** Replaces matches.game_settings.sideGames wholesale — used once the tournament shell already exists and the host edits/removes a side game from S5. Skins' participantIds rides along for SkinsConfig shape-compatibility, but match_players.skins_opt_in (see setSkinsParticipant) is what fetchTournamentLobby actually reads back for who's in. */
export async function updateTournamentSideGames(matchId: string, sideGames: SkinsConfig[]): Promise<void> {
  return withRetry(async () => {
    const gameSettings: SideGameSettings = { sideGames };
    const { error } = await supabase.from('matches').update({ game_settings: gameSettings }).eq('id', matchId);
    if (error) throw error;
  });
}

/** Flips one player's Skins participation — host-only in the UI (S5's "who's in" list, S6b's pill row, S6c's sheet), riding the same host-update-any-seat policy as tee/handicap edits. */
export async function setSkinsParticipant(matchId: string, playerId: string, optedIn: boolean): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase.from('match_players').update({ skins_opt_in: optedIn }).eq('match_id', matchId).eq('player_id', playerId);
    if (error) throw error;
  });
}

/**
 * Flips a tournament round to finished — a plain status update, NOT the
 * pairwise finish_match RPC Kaki Match Play uses (that RPC settles pairwise
 * StrokeDeals into kaki_relationships; a tournament's Skins pot is a 3+
 * player zero-sum side pot with no pairwise-deal shape, and per product
 * decision stays display-only — see skins.ts's computeSkinsStandings'
 * netDollars, rendered on S10 but never written to the ledger). Host-only
 * via the same matches UPDATE RLS every other round-settings edit in this
 * codebase rides. Idempotent — retrying just re-sets the same status/timestamp,
 * mirroring data/matches.ts's startMatch.
 */
export async function finishTournamentRound(matchId: string): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase.from('matches').update({ status: 'finished', finished_at: new Date().toISOString() }).eq('id', matchId);
    if (error) throw error;
  });
}

export type TournamentLobbyPlayer = {
  id: string;
  name: string;
  handicapIndex: number | null;
  isHost: boolean;
  status: 'joined' | 'invited';
  teeColor: TeeColor;
  playingHandicap: number;
  handicapOverride: boolean;
};

export type TournamentLobby = {
  tournamentId: string;
  matchId: string;
  hostId: string;
  name: string;
  tournamentCode: string;
  scoringFormat: TournamentScoringFormat;
  standingsBasis: TournamentStandingsBasis;
  handicapAllowancePct: number;
  tieBreakRule: TournamentTieBreakRule;
  matchStatus: MatchStatus;
  thru: number;
  courseId: string;
  comboId: string;
  /** Shotgun start — mirrors matches.start_hole. Needed to build the round's actual tee-off order (buildPlayOrder) for live scoring. */
  startHole: number;
  players: TournamentLobbyPlayer[];
  sideGames: SkinsConfig[];
};

type TournamentRow = {
  id: string;
  host_id: string;
  name: string;
  tournament_code: string;
  scoring_format: TournamentScoringFormat;
  standings_basis: TournamentStandingsBasis;
  handicap_allowance_pct: number;
  tie_break_rule: TournamentTieBreakRule;
};

type MatchRow = {
  id: string;
  status: MatchStatus;
  thru: number;
  course_id: string;
  combo_id: string;
  start_hole: number;
  game_settings: SideGameSettings | null;
};

type PlayerRow = {
  player_id: string;
  is_host: boolean;
  handicap_at_time: number | null;
  status: 'joined' | 'invited';
  tee_color: TeeColor | null;
  playing_handicap: number | null;
  handicap_override: boolean;
  skins_opt_in: boolean;
  profiles: { display_name: string };
};

/** Everyone's current state for the pre-round/in-round lobby (S6b's post-creation view and S6c) — a plain fetch-on-mount, not a realtime subscription (that lands with live scoring in a later phase). */
export async function fetchTournamentLobby(tournamentId: string): Promise<TournamentLobby> {
  return withRetry(async () => {
    const { data: tData, error: tError } = await supabase
      .from('tournaments')
      .select('id, host_id, name, tournament_code, scoring_format, standings_basis, handicap_allowance_pct, tie_break_rule')
      .eq('id', tournamentId)
      .single();
    if (tError) throw tError;
    const tournament = tData as TournamentRow;

    const { data: mData, error: mError } = await supabase
      .from('matches')
      .select('id, status, thru, course_id, combo_id, start_hole, game_settings')
      .eq('tournament_id', tournamentId)
      .single();
    if (mError) throw mError;
    const match = mData as MatchRow;

    const { data: playerRows, error: pError } = await supabase
      .from('match_players')
      .select('player_id, is_host, handicap_at_time, status, tee_color, playing_handicap, handicap_override, skins_opt_in, profiles ( display_name )')
      .eq('match_id', match.id)
      .order('joined_at');
    if (pError) throw pError;
    const rows = playerRows as unknown as PlayerRow[];

    const players: TournamentLobbyPlayer[] = rows.map((row) => ({
      id: row.player_id,
      name: row.profiles.display_name,
      handicapIndex: row.handicap_at_time,
      isHost: row.is_host,
      status: row.status,
      teeColor: row.tee_color ?? 'white',
      playingHandicap: row.playing_handicap ?? 0,
      handicapOverride: row.handicap_override,
    }));

    // participantIds is authoritative from match_players.skins_opt_in, not
    // whatever's stored in game_settings (which may be a stale snapshot from
    // creation time or an earlier edit) — see the module comment.
    const storedSideGames = match.game_settings?.sideGames ?? [];
    const sideGames: SkinsConfig[] = storedSideGames.map((g) =>
      g.type === 'skins' ? { ...g, participantIds: rows.filter((r) => r.skins_opt_in).map((r) => r.player_id) } : g,
    );

    return {
      tournamentId: tournament.id,
      matchId: match.id,
      hostId: tournament.host_id,
      name: tournament.name,
      tournamentCode: tournament.tournament_code,
      scoringFormat: tournament.scoring_format,
      standingsBasis: tournament.standings_basis,
      handicapAllowancePct: tournament.handicap_allowance_pct,
      tieBreakRule: tournament.tie_break_rule,
      matchStatus: match.status,
      thru: match.thru,
      courseId: match.course_id,
      comboId: match.combo_id,
      startHole: match.start_hole,
      players,
      sideGames,
    };
  });
}

/** Host removes a player before the round starts (S4's tap-to-cancel and S6b's swipe-to-remove, for someone already persisted — the common case pre-shell is still just editing local draft state). */
export async function removeTournamentPlayer(matchId: string, playerId: string): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase.from('match_players').delete().eq('match_id', matchId).eq('player_id', playerId);
    if (error) throw error;
  });
}
