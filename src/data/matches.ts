/**
 * Matches: creation (Create Game -> `matches` + `match_players` rows) and the
 * Match Lobby's live view of who's joined plus the per-pair stroke deal the
 * host has agreed with each other player (`game_matchups`). Downstream
 * scoring (Scorecard, Leaderboard, Finish, Recap) still runs on the fixed
 * 3-player demo in data/round.ts — that's a separate, later wiring pass and
 * isn't touched here.
 */

import { isTransientError, sleep, withRetry } from '../lib/retry';
import { supabase } from '../lib/supabase';

export type HolesCount = 9 | 18;
export type MatchStatus = 'lobby' | 'live' | 'finished';
export type StrokeMode = 'get' | 'give';

export type MatchPlayer = {
  playerId: string;
  name: string;
  handicap: number | null;
  isHost: boolean;
};

export type MatchLobby = {
  id: string;
  matchCode: string;
  hostId: string;
  status: MatchStatus;
  strokesBasis: HolesCount;
  stakePerHole: number;
  golferCount: number;
  courseId: string;
  comboId: string;
  holesToPlay: HolesCount;
  startHole: number;
  startedAt: string | null;
  finishedAt: string | null;
  players: MatchPlayer[];
};

// Excludes 0/O/1/I to avoid misreads — mirrors the DB's generate_match_code().
const MATCH_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Client-side preview so Create Game can show/share a code before the match row exists. */
export function generateMatchCodePreview(): string {
  let code = '';
  for (let i = 0; i < 4; i++) code += MATCH_CODE_CHARS[Math.floor(Math.random() * MATCH_CODE_CHARS.length)];
  return code;
}

const GAME_MODE_NAMES: Record<string, string> = {
  kaki_match_play: 'Kaki Match Play',
};

/** Falls back to the raw slug for any mode not in the display-name map yet. */
export function gameModeDisplayName(gameMode: string): string {
  return GAME_MODE_NAMES[gameMode] ?? gameMode;
}

export type NewMatchPlayer = { id: string; handicap: number | null };

export type CreateMatchParams = {
  matchCode: string;
  hostId: string;
  courseId: string;
  comboId: string;
  holesToPlay: HolesCount;
  /** Shotgun-start hole (1-18) — 1 for every normal, non-shotgun round. Only meaningful when holesToPlay is 18 (see SelectCourseScreen). */
  startHole: number;
  matchName: string;
  gameMode: string;
  golferCount: number;
  /** Every player to seat at creation, host included. */
  players: NewMatchPlayer[];
};

/**
 * Creates the match + one match_players row per seated player. Two different
 * retry reasons share this loop: a match_code collision (rare, gets a fresh
 * code) and a transient network/server error (same code, just tried again
 * after a backoff) — anything else (RLS denial, bad course/combo ref) is
 * rethrown immediately.
 */
export async function createMatch(params: CreateMatchParams): Promise<{ id: string; matchCode: string }> {
  let matchCode = params.matchCode;
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data, error } = await supabase
      .from('matches')
      .insert({
        host_id: params.hostId,
        course_id: params.courseId,
        combo_id: params.comboId,
        holes_to_play: params.holesToPlay,
        // Always valid at creation (the check constraint requires 9 here whenever
        // holes_to_play is 9); the lobby's "strokes set for" toggle can raise it
        // to 18 afterwards when holes_to_play allows it.
        strokes_basis: 9,
        start_hole: params.startHole,
        match_name: params.matchName,
        game_mode: params.gameMode,
        golfer_count: params.golferCount,
        match_code: matchCode,
      })
      .select('id')
      .single();

    if (!error) {
      const matchId = (data as { id: string }).id;
      // The match row above is already committed. Upsert-with-ignore (rather
      // than insert) makes this step safe to retry blindly — a retry after a
      // response timeout just no-ops on the rows a prior attempt already wrote.
      await withRetry(async () => {
        const { error: playersError } = await supabase.from('match_players').upsert(
          params.players.map((p) => ({
            match_id: matchId,
            player_id: p.id,
            is_host: p.id === params.hostId,
            handicap_at_time: p.handicap,
            // The host is seated outright; anyone else picked from the invite list
            // is only "invited" until they accept from their own Home notification.
            status: p.id === params.hostId ? 'joined' : 'invited',
          })),
          { onConflict: 'match_id,player_id', ignoreDuplicates: true },
        );
        if (playersError) throw playersError;
      });
      return { id: matchId, matchCode };
    }

    const isLastAttempt = attempt === maxAttempts - 1;
    if (error.code === '23505') {
      if (isLastAttempt) throw error;
      matchCode = generateMatchCodePreview();
      continue;
    }
    if (isTransientError(error) && !isLastAttempt) {
      await sleep(400 * 2 ** attempt + Math.random() * 400);
      continue;
    }
    throw error;
  }

  throw new Error('Could not create match — please try again.');
}

type MatchRow = {
  id: string;
  host_id: string;
  match_code: string;
  status: MatchStatus;
  strokes_basis: HolesCount;
  stake_per_hole: number;
  golfer_count: number;
  course_id: string;
  combo_id: string;
  holes_to_play: HolesCount;
  start_hole: number;
  started_at: string | null;
  finished_at: string | null;
};

type MatchPlayerRow = {
  player_id: string;
  is_host: boolean;
  handicap_at_time: number | null;
  profiles: { display_name: string };
};

/** Everyone joined so far, plus the match's current settings — for the lobby's initial load and its manual refresh. */
export async function fetchMatchLobby(matchId: string): Promise<MatchLobby> {
  return withRetry(async () => {
    const [{ data: matchData, error: matchError }, { data: playerRows, error: playersError }] = await Promise.all([
      supabase
        .from('matches')
        .select('id, host_id, match_code, status, strokes_basis, stake_per_hole, golfer_count, course_id, combo_id, holes_to_play, start_hole, started_at, finished_at')
        .eq('id', matchId)
        .single(),
      supabase
        .from('match_players')
        .select('player_id, is_host, handicap_at_time, profiles ( display_name )')
        .eq('match_id', matchId)
        // Invited-but-not-yet-accepted friends don't count as seated — they show
        // as an open slot until they accept from their own Home notification.
        .eq('status', 'joined')
        .order('joined_at'),
    ]);
    if (matchError) throw matchError;
    if (playersError) throw playersError;

    const match = matchData as MatchRow;
    const players: MatchPlayer[] = (playerRows as unknown as MatchPlayerRow[]).map((row) => ({
      playerId: row.player_id,
      name: row.profiles.display_name,
      handicap: row.handicap_at_time,
      isHost: row.is_host,
    }));

    return {
      id: match.id,
      matchCode: match.match_code,
      hostId: match.host_id,
      status: match.status,
      strokesBasis: match.strokes_basis,
      stakePerHole: Number(match.stake_per_hole),
      golferCount: match.golfer_count,
      courseId: match.course_id,
      comboId: match.combo_id,
      holesToPlay: match.holes_to_play,
      startHole: match.start_hole,
      startedAt: match.started_at,
      finishedAt: match.finished_at,
      players,
    };
  });
}

export type MatchByCode = {
  id: string;
  matchCode: string;
  matchName: string;
  courseName: string;
  summaryLine: string;
  gameModeName: string;
  golferCount: number;
  holesToPlay: HolesCount;
  status: MatchStatus;
  playerCount: number;
};

type MatchByCodeRow = {
  id: string;
  match_code: string;
  match_name: string;
  game_mode: string;
  golfer_count: number;
  holes_to_play: HolesCount;
  status: MatchStatus;
  course_id: string;
  combo_id: string;
  courses: { name: string };
};

/** Looks up a match by its 4-character code (case-insensitive) for Join Game's live preview + the actual join. Null if no match has that code. */
export async function findMatchByCode(code: string): Promise<MatchByCode | null> {
  return withRetry(() => findMatchByCodeOnce(code));
}

async function findMatchByCodeOnce(code: string): Promise<MatchByCode | null> {
  const { data, error } = await supabase
    .from('matches')
    .select('id, match_code, match_name, game_mode, golfer_count, holes_to_play, status, course_id, combo_id, courses ( name )')
    .eq('match_code', code.toUpperCase())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as MatchByCodeRow;

  // course_combos has a composite (course_id, combo_id) key — not a single-column
  // FK PostgREST can auto-embed — so its label is a separate lookup.
  const [{ data: comboRow, error: comboError }, { count: playerCount, error: countError }] = await Promise.all([
    supabase.from('course_combos').select('label').eq('course_id', row.course_id).eq('combo_id', row.combo_id).single(),
    // Only "joined" counts toward capacity — a pending invite hasn't taken the seat yet.
    supabase.from('match_players').select('*', { count: 'exact', head: true }).eq('match_id', row.id).eq('status', 'joined'),
  ]);
  if (comboError) throw comboError;
  if (countError) throw countError;

  return {
    id: row.id,
    matchCode: row.match_code,
    matchName: row.match_name,
    courseName: row.courses.name,
    summaryLine: `${row.holes_to_play} holes · ${(comboRow as { label: string }).label}`,
    gameModeName: gameModeDisplayName(row.game_mode),
    golferCount: row.golfer_count,
    holesToPlay: row.holes_to_play,
    status: row.status,
    playerCount: playerCount ?? 0,
  };
}

async function isSeated(matchId: string, playerId: string): Promise<boolean> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('match_players')
      .select('player_id')
      .eq('match_id', matchId)
      .eq('player_id', playerId)
      .maybeSingle();
    if (error) throw error;
    return data !== null;
  });
}

/**
 * Joins the viewer to a match by code — idempotent if they're already joined
 * (re-tapping Join is safe), and promotes a pending invite straight to
 * "joined" if they had one (entering the code is just as much consent as
 * tapping Accept on the Home notification would have been).
 */
export async function joinMatchByCode(code: string, playerId: string, handicap: number | null): Promise<MatchByCode> {
  const match = await findMatchByCode(code);
  if (!match) throw new Error("We couldn't find a match with that code.");
  if (match.status === 'finished') throw new Error('This match has already finished.');

  // "Full" only applies to someone with no existing row — an already-seated (or
  // already-invited) player re-entering the code isn't taking a NEW seat.
  if (match.status === 'lobby' && match.playerCount >= match.golferCount) {
    const seated = await isSeated(match.id, playerId);
    if (!seated) throw new Error('This match is full.');
  }

  await withRetry(async () => {
    const { error } = await supabase
      .from('match_players')
      .upsert(
        { match_id: match.id, player_id: playerId, is_host: false, handicap_at_time: handicap, status: 'joined' },
        { onConflict: 'match_id,player_id' },
      );
    if (error) throw error;
  });

  return match;
}

/** Idempotent field update — safe to retry blindly on a transient failure. */
export async function updateMatchSettings(
  matchId: string,
  patch: { strokesBasis?: HolesCount; stakePerHole?: number },
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.strokesBasis !== undefined) row.strokes_basis = patch.strokesBasis;
  if (patch.stakePerHole !== undefined) row.stake_per_hole = patch.stakePerHole;
  if (Object.keys(row).length === 0) return;

  await withRetry(async () => {
    const { error } = await supabase.from('matches').update(row).eq('id', matchId);
    if (error) throw error;
  });
}

export type MatchupPair = { playerAId: string; playerBId: string; frontNineStrokes: number; backNineStrokes: number | null };

/** Every pairwise stroke deal recorded for this match so far (may not cover every pair yet — caller fills gaps from the kaki ledger). */
export async function fetchMatchups(matchId: string): Promise<MatchupPair[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('game_matchups')
      .select('player_a_id, player_b_id, front_nine_strokes, back_nine_strokes')
      .eq('match_id', matchId);
    if (error) throw error;
    return (data as { player_a_id: string; player_b_id: string; front_nine_strokes: number; back_nine_strokes: number | null }[]).map((row) => ({
      playerAId: row.player_a_id,
      playerBId: row.player_b_id,
      frontNineStrokes: row.front_nine_strokes,
      backNineStrokes: row.back_nine_strokes,
    }));
  });
}

/**
 * Persists one pair's agreed strokes. `mode`/`strokes` are from `actingPlayerId`'s
 * side of the deal — Kaki Match Play is pairwise, so this is any two players in
 * the match (either participant in the pair, or the host as an admin override),
 * not host-only. Upsert is idempotent, so safe to retry blindly.
 */
export async function upsertMatchup(
  matchId: string,
  actingPlayerId: string,
  otherPlayerId: string,
  strokes: number,
  mode: StrokeMode,
): Promise<void> {
  const [player_a_id, player_b_id] = actingPlayerId < otherPlayerId ? [actingPlayerId, otherPlayerId] : [otherPlayerId, actingPlayerId];
  const actingIsA = actingPlayerId === player_a_id;
  // Same sign convention as the column: positive = player_a gives to player_b.
  const sign = actingIsA === (mode === 'give') ? 1 : -1;

  await withRetry(async () => {
    const { error } = await supabase
      .from('game_matchups')
      .upsert(
        { match_id: matchId, player_a_id, player_b_id, front_nine_strokes: sign * strokes },
        { onConflict: 'match_id,player_a_id,player_b_id' },
      );
    if (error) throw error;
  });
}

/**
 * Host-only: removes an unfinished round for everyone — cascades to
 * match_players, game_matchups, scores, badge_moments, and
 * handicap_differentials via FK. RLS also enforces host-only and rejects a
 * finished match server-side, so this is safe even if a stale UI calls it.
 */
export async function deleteMatch(matchId: string): Promise<void> {
  await withRetry(async () => {
    const { error } = await supabase.from('matches').delete().eq('id', matchId);
    if (error) throw error;
  });
}

/** Idempotent — retrying just re-sets the same status/timestamp. */
export async function startMatch(matchId: string): Promise<void> {
  await withRetry(async () => {
    const { error } = await supabase
      .from('matches')
      .update({ status: 'live', started_at: new Date().toISOString() })
      .eq('id', matchId);
    if (error) throw error;
  });
}

export type MatchInvite = {
  matchId: string;
  matchCode: string;
  matchName: string;
  courseName: string;
  summaryLine: string;
  gameModeName: string;
  holesToPlay: HolesCount;
  status: MatchStatus;
  hostName: string;
};

type MatchInviteRow = {
  matches: {
    id: string;
    match_code: string;
    match_name: string;
    game_mode: string;
    holes_to_play: HolesCount;
    status: MatchStatus;
    course_id: string;
    combo_id: string;
    courses: { name: string };
    host: { display_name: string };
  };
};

/** Pending "invited" seats for the Home notification center — a friend the host picked in Create Game, not yet accepted or declined. */
export async function fetchMatchInvites(playerId: string): Promise<MatchInvite[]> {
  return withRetry(() => fetchMatchInvitesOnce(playerId));
}

async function fetchMatchInvitesOnce(playerId: string): Promise<MatchInvite[]> {
  const { data, error } = await supabase
    .from('match_players')
    .select(
      `matches (
        id, match_code, match_name, game_mode, holes_to_play, status, course_id, combo_id,
        courses ( name ),
        host:profiles!matches_host_id_fkey ( display_name )
      )`,
    )
    .eq('player_id', playerId)
    .eq('status', 'invited');
  if (error) throw error;

  const rows = data as unknown as MatchInviteRow[];
  // course_combos has a composite key PostgREST can't auto-embed — one lookup per
  // invite, but the pending-invite list is always small (a handful at most).
  return Promise.all(
    rows.map(async (row) => {
      const m = row.matches;
      const { data: comboRow, error: comboError } = await supabase
        .from('course_combos')
        .select('label')
        .eq('course_id', m.course_id)
        .eq('combo_id', m.combo_id)
        .single();
      if (comboError) throw comboError;

      return {
        matchId: m.id,
        matchCode: m.match_code,
        matchName: m.match_name,
        courseName: m.courses.name,
        summaryLine: `${m.holes_to_play} holes · ${(comboRow as { label: string }).label}`,
        gameModeName: gameModeDisplayName(m.game_mode),
        holesToPlay: m.holes_to_play,
        status: m.status,
        hostName: m.host.display_name,
      };
    }),
  );
}

/** Accepts a pending invite — flips this player's seat from "invited" to "joined". */
export async function acceptMatchInvite(matchId: string, playerId: string): Promise<void> {
  await withRetry(async () => {
    const { error } = await supabase
      .from('match_players')
      .update({ status: 'joined' })
      .eq('match_id', matchId)
      .eq('player_id', playerId);
    if (error) throw error;
  });
}

/** Declines a pending invite — just removes the seat (mirrors declining a kaki friend request). */
export async function declineMatchInvite(matchId: string, playerId: string): Promise<void> {
  await withRetry(async () => {
    const { error } = await supabase.from('match_players').delete().eq('match_id', matchId).eq('player_id', playerId);
    if (error) throw error;
  });
}

export type LiveKakiGame = {
  matchId: string;
  matchName: string;
  hostName: string;
  courseName: string;
  gameModeName: string;
  playerCount: number;
  golferCount: number;
  thru: number;
  stakePerHole: number;
};

type LiveMatchRow = {
  id: string;
  match_name: string;
  game_mode: string;
  stake_per_hole: number;
  thru: number;
  golfer_count: number;
  courses: { name: string };
  host: { display_name: string };
};

type LiveMatchPlayerRow = { match_id: string; matches: LiveMatchRow };

/**
 * Friends' currently-live matches the viewer isn't already seated in, for
 * Join Game's "or join a live one" list. Two passes: who's an accepted kaki
 * (RLS on kaki_relationships only allows reading rows the viewer is part of,
 * which is exactly the shape this needs), then which of the viewer's kaki are
 * seated in a still-live match — deduped, since a match with two of the
 * viewer's kaki in it would otherwise appear twice.
 */
export async function fetchLiveKakiGames(viewerId: string): Promise<LiveKakiGame[]> {
  return withRetry(() => fetchLiveKakiGamesOnce(viewerId));
}

async function fetchLiveKakiGamesOnce(viewerId: string): Promise<LiveKakiGame[]> {
  const { data: relRows, error: relError } = await supabase
    .from('kaki_relationships')
    .select('player_a_id, player_b_id')
    .eq('status', 'accepted')
    .or(`player_a_id.eq.${viewerId},player_b_id.eq.${viewerId}`);
  if (relError) throw relError;

  const friendIds = (relRows as { player_a_id: string; player_b_id: string }[]).map((row) =>
    row.player_a_id === viewerId ? row.player_b_id : row.player_a_id,
  );
  if (friendIds.length === 0) return [];

  const { data: seatRows, error: seatError } = await supabase
    .from('match_players')
    .select(
      `match_id,
       matches!inner (
         id, match_name, game_mode, stake_per_hole, thru, golfer_count,
         courses ( name ),
         host:profiles!matches_host_id_fkey ( display_name )
       )`,
    )
    .in('player_id', friendIds)
    .eq('status', 'joined')
    .eq('matches.status', 'live');
  if (seatError) throw seatError;

  const byMatchId = new Map<string, LiveMatchRow>();
  for (const row of seatRows as unknown as LiveMatchPlayerRow[]) {
    byMatchId.set(row.matches.id, row.matches);
  }
  if (byMatchId.size === 0) return [];

  // Exclude matches the viewer already has a seat in (joined or invited) —
  // this list is for friends' games, not the viewer's own.
  const { data: ownSeatRows, error: ownSeatError } = await supabase
    .from('match_players')
    .select('match_id')
    .eq('player_id', viewerId)
    .in('match_id', [...byMatchId.keys()]);
  if (ownSeatError) throw ownSeatError;
  for (const row of ownSeatRows as { match_id: string }[]) byMatchId.delete(row.match_id);
  if (byMatchId.size === 0) return [];

  const candidates = [...byMatchId.values()];
  const counts = await Promise.all(
    candidates.map((m) => supabase.from('match_players').select('*', { count: 'exact', head: true }).eq('match_id', m.id).eq('status', 'joined')),
  );
  for (const { error } of counts) if (error) throw error;

  return candidates.map((m, i) => ({
    matchId: m.id,
    matchName: m.match_name,
    hostName: m.host.display_name,
    courseName: m.courses.name,
    gameModeName: gameModeDisplayName(m.game_mode),
    playerCount: counts[i]!.count ?? 0,
    golferCount: m.golfer_count,
    thru: m.thru,
    stakePerHole: Number(m.stake_per_hole),
  }));
}

/**
 * Seats the viewer in a friend's already-live match (picked from the "join a
 * live one" list, so there's no code to look up by) — same upsert shape as
 * `joinMatchByCode`, but this path always enforces the capacity check since
 * there's no invited-seat exception here (nobody reserved this player a
 * spot; they're opting into someone else's round on the spot).
 */
export async function joinLiveMatch(matchId: string, playerId: string, handicap: number | null): Promise<void> {
  await withRetry(async () => {
    const { count, error: countError } = await supabase
      .from('match_players')
      .select('*', { count: 'exact', head: true })
      .eq('match_id', matchId)
      .eq('status', 'joined');
    if (countError) throw countError;

    const { data: matchRow, error: matchError } = await supabase.from('matches').select('golfer_count, status').eq('id', matchId).single();
    if (matchError) throw matchError;
    const match = matchRow as { golfer_count: number; status: MatchStatus };
    if (match.status === 'finished') throw new Error('This match has already finished.');
    if ((count ?? 0) >= match.golfer_count) throw new Error('This match is full.');

    const { error } = await supabase
      .from('match_players')
      .upsert({ match_id: matchId, player_id: playerId, is_host: false, handicap_at_time: handicap, status: 'joined' }, { onConflict: 'match_id,player_id' });
    if (error) throw error;
  });
}
