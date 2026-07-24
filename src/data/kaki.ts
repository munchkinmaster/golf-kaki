/**
 * Kaki (friend) relationships: the friends list, incoming/outgoing requests,
 * and the searchable directory behind the Add-friend sheet. Backed by
 * `kaki_relationships`, which also carries the persistent per-pair stroke
 * ledger (`net_strokes_per_9`) — see the migration comment for why it's
 * stored per-9 rather than per-18.
 */

import { withRetry } from '../lib/retry';
import { supabase } from '../lib/supabase';
import { fetchCourseCatalog, getComboHoles } from './courses';
import { getNextRoundNet, pairKey } from './round';
import type { GrossMap, RoundSchedule, StrokeDeal } from './round';

export type KakiPerson = {
  id: string;
  name: string;
  handle: string;
  handicap: number | null;
};

export type FriendRequest = KakiPerson & { relationshipId: string };

export type Friend = KakiPerson & {
  relationshipId: string;
  /** Strokes over 18, from the viewer's perspective. Positive = viewer gives, negative = viewer gets, 0 = even. */
  strokes18: number;
};

export type AddCandidate = KakiPerson & { relationshipId?: string; status: 'add' | 'requested' };

export type KakiOverview = {
  friends: Friend[];
  requests: FriendRequest[];
  directory: AddCandidate[];
};

type ProfileRow = {
  id: string;
  display_name: string;
  handle: string;
  handicap: number | null;
};

type RelationshipRow = {
  id: string;
  player_a_id: string;
  player_b_id: string;
  status: 'pending' | 'accepted';
  requested_by: string;
  net_strokes_per_9: number;
  player_a: ProfileRow;
  player_b: ProfileRow;
};

function fromProfileRow(row: ProfileRow): KakiPerson {
  return { id: row.id, name: row.display_name, handle: `@${row.handle}`, handicap: row.handicap };
}

/** Fetches the viewer's friends, incoming requests, and an addable directory in two queries. */
export async function fetchKakiOverview(userId: string): Promise<KakiOverview> {
  return withRetry(() => fetchKakiOverviewOnce(userId));
}

async function fetchKakiOverviewOnce(userId: string): Promise<KakiOverview> {
  const [relationships, otherProfiles] = await Promise.all([
    supabase
      .from('kaki_relationships')
      .select(
        `id, player_a_id, player_b_id, status, requested_by, net_strokes_per_9,
         player_a:profiles!kaki_relationships_player_a_id_fkey ( id, display_name, handle, handicap ),
         player_b:profiles!kaki_relationships_player_b_id_fkey ( id, display_name, handle, handicap )`,
      )
      .or(`player_a_id.eq.${userId},player_b_id.eq.${userId}`)
      .then(({ data, error }) => {
        if (error) throw error;
        return data as unknown as RelationshipRow[];
      }),
    supabase
      .from('profiles')
      .select('id, display_name, handle, handicap')
      .neq('id', userId)
      .order('display_name')
      .then(({ data, error }) => {
        if (error) throw error;
        return data as ProfileRow[];
      }),
  ]);

  const friends: Friend[] = [];
  const requests: FriendRequest[] = [];
  // Tracks how each other profile relates to the viewer, so the directory below
  // can skip existing friends and people who've already sent a request.
  const relatedStatus = new Map<string, 'friends' | 'pending_sent' | 'pending_received'>();
  const relatedRelationshipId = new Map<string, string>();

  for (const row of relationships) {
    const isPlayerA = row.player_a_id === userId;
    const other = fromProfileRow(isPlayerA ? row.player_b : row.player_a);
    relatedRelationshipId.set(other.id, row.id);

    if (row.status === 'accepted') {
      const viewerNet = isPlayerA ? row.net_strokes_per_9 : -row.net_strokes_per_9;
      friends.push({ ...other, relationshipId: row.id, strokes18: viewerNet * 2 });
      relatedStatus.set(other.id, 'friends');
    } else if (row.requested_by === userId) {
      relatedStatus.set(other.id, 'pending_sent');
    } else {
      requests.push({ ...other, relationshipId: row.id });
      relatedStatus.set(other.id, 'pending_received');
    }
  }

  const directory: AddCandidate[] = otherProfiles
    .filter((p) => {
      const status = relatedStatus.get(p.id);
      return status !== 'friends' && status !== 'pending_received';
    })
    .map((p) => {
      const person = fromProfileRow(p);
      const isSent = relatedStatus.get(p.id) === 'pending_sent';
      return { ...person, status: isSent ? 'requested' : 'add', relationshipId: relatedRelationshipId.get(p.id) };
    });

  return { friends, requests, directory };
}

/**
 * Finds the most recently finished match both players appeared in, for the
 * ledger backfill below — two queries plus a JS intersect, since PostgREST
 * can't filter one joined table by two different player_ids in one request.
 */
async function findLastSharedFinishedMatch(playerAId: string, playerBId: string): Promise<string | null> {
  const { data: aRows, error: aError } = await supabase
    .from('match_players')
    .select('match_id, matches!inner(finished_at, status)')
    .eq('player_id', playerAId)
    .eq('matches.status', 'finished');
  if (aError) throw aError;
  const aMatches = aRows as unknown as { match_id: string; matches: { finished_at: string | null } }[];
  if (aMatches.length === 0) return null;

  const { data: bRows, error: bError } = await supabase
    .from('match_players')
    .select('match_id')
    .eq('player_id', playerBId)
    .in(
      'match_id',
      aMatches.map((m) => m.match_id),
    );
  if (bError) throw bError;
  const sharedIds = new Set((bRows as { match_id: string }[]).map((r) => r.match_id));

  const shared = aMatches.filter((m) => sharedIds.has(m.match_id));
  if (shared.length === 0) return null;
  shared.sort((x, y) => (y.matches.finished_at ?? '').localeCompare(x.matches.finished_at ?? ''));
  return shared[0]!.match_id;
}

/**
 * Recomputes one pair's next-round net strokes from a single finished match.
 * Pairwise match-play math only ever depends on the two players' own gross
 * scores and their own deal, never the rest of that match's roster, so this
 * doesn't need the full roster/scores useLiveRound assembles for a live round.
 */
async function computePairNetForMatch(matchId: string, playerAId: string, playerBId: string): Promise<number | null> {
  const { data: matchRow, error: matchError } = await supabase
    .from('matches')
    .select('holes_to_play, strokes_basis, start_hole, course_id, combo_id')
    .eq('id', matchId)
    .single();
  if (matchError) throw matchError;
  const match = matchRow as { holes_to_play: 9 | 18; strokes_basis: 9 | 18; start_hole: number; course_id: string; combo_id: string };

  const [a, b] = playerAId < playerBId ? [playerAId, playerBId] : [playerBId, playerAId];

  const [{ data: scoreRows, error: scoreError }, { data: matchupRow, error: matchupError }, catalog] = await Promise.all([
    supabase.from('scores').select('player_id, hole_number, gross_strokes').eq('match_id', matchId).in('player_id', [a, b]),
    supabase.from('game_matchups').select('front_nine_strokes, back_nine_strokes').eq('match_id', matchId).eq('player_a_id', a).eq('player_b_id', b).maybeSingle(),
    fetchCourseCatalog(),
  ]);
  if (scoreError) throw scoreError;
  if (matchupError) throw matchupError;

  const course = catalog.find((c) => c.id === match.course_id);
  if (!course) return null;
  const allHoles = getComboHoles(course, match.combo_id);
  const holes = match.holes_to_play === 9 ? allHoles.slice(0, 9) : allHoles;

  const scores = scoreRows as { player_id: string; hole_number: number; gross_strokes: number }[];
  const gross: GrossMap = {};
  for (const p of [a, b]) gross[p] = holes.map((h) => scores.find((s) => s.player_id === p && s.hole_number === h.n)?.gross_strokes ?? h.par);

  const row = matchupRow as { front_nine_strokes: number; back_nine_strokes: number | null } | null;
  const toDeal = (amount: number): StrokeDeal[] =>
    amount === 0 ? [] : amount > 0 ? [{ giver: a, receiver: b, amount }] : [{ giver: b, receiver: a, amount: -amount }];
  const frontNineDeals = toDeal(row?.front_nine_strokes ?? 0);
  const backNineDeals = row?.back_nine_strokes == null ? null : toDeal(row.back_nine_strokes);

  const schedule: RoundSchedule = { holesToPlay: match.holes_to_play, strokesBasis: match.strokes_basis, startHole: match.start_hole };
  const net = getNextRoundNet([a, b], gross, frontNineDeals, holes, schedule, backNineDeals);
  return net[pairKey(a, b)] ?? 0;
}

/**
 * Accepts an incoming request, then backfills the stroke ledger from the
 * pair's most recent finished match together, if any. Two kaki can play a
 * match before formally accepting each other — updateLedgerStrokes silently
 * no-ops without an accepted relationship (see its own comment) — so without
 * this, that match's carry-forward would be stranded forever the moment they
 * do accept, with no later event left to re-trigger the write.
 */
export async function acceptFriendRequest(relationshipId: string): Promise<void> {
  const { data, error } = await supabase
    .from('kaki_relationships')
    .update({ status: 'accepted' })
    .eq('id', relationshipId)
    .select('player_a_id, player_b_id')
    .single();
  if (error) throw error;
  const { player_a_id, player_b_id } = data as { player_a_id: string; player_b_id: string };

  try {
    const lastMatchId = await findLastSharedFinishedMatch(player_a_id, player_b_id);
    if (lastMatchId) {
      const net = await computePairNetForMatch(lastMatchId, player_a_id, player_b_id);
      if (net !== null) await updateLedgerStrokes(player_a_id, player_b_id, net);
    }
  } catch {
    // Backfill is best-effort — a failure here shouldn't block accepting the request.
  }
}

/** Declines an incoming request, or cancels one the viewer sent — both are just row removal. */
export async function removeKakiRelationship(relationshipId: string): Promise<void> {
  const { error } = await supabase.from('kaki_relationships').delete().eq('id', relationshipId);
  if (error) throw error;
}

/** Sends a friend request; ids are canonicalized so the pair has exactly one row. */
export async function sendFriendRequest(userId: string, targetId: string): Promise<string> {
  const [player_a_id, player_b_id] = userId < targetId ? [userId, targetId] : [targetId, userId];
  const { data, error } = await supabase
    .from('kaki_relationships')
    .insert({ player_a_id, player_b_id, requested_by: userId })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/**
 * Updates ONE pair's carry-forward stroke ledger after a match — a plain
 * UPDATE, never an insert, so a pair with no existing 'accepted' kaki
 * relationship silently no-ops (playing a match with someone never
 * auto-friends them). `netStrokesPer9` is already in the same per-9,
 * positive-a-gives-b unit the column stores — round.ts's `getNextRoundNet`
 * (keyed the same canonical way) is what callers pass in here, so no
 * conversion is needed beyond re-canonicalizing a/b if the caller didn't.
 */
export async function updateLedgerStrokes(playerAId: string, playerBId: string, netStrokesPer9: number): Promise<void> {
  await withRetry(async () => {
    const [a, b] = playerAId < playerBId ? [playerAId, playerBId] : [playerBId, playerAId];
    const signed = playerAId < playerBId ? netStrokesPer9 : -netStrokesPer9;
    const { error } = await supabase
      .from('kaki_relationships')
      .update({ net_strokes_per_9: signed })
      .eq('player_a_id', a)
      .eq('player_b_id', b)
      .eq('status', 'accepted');
    if (error) throw error;
  });
}

/**
 * Strokes-over-18 for every accepted-kaki pair *within* `playerIds`, keyed by
 * canonical `"a:b"` (a < b, string comparison) — signed from a's perspective
 * (positive = a gives b). For seeding a Match Lobby's full pairwise stroke
 * matrix (every player vs every other player, not just vs one distinguished
 * viewer) from the accepted kaki ledger. Pairs with no accepted relationship
 * yet are omitted (caller defaults to 0 — even strokes).
 */
export async function fetchLedgerStrokesForGroup(playerIds: string[]): Promise<Record<string, number>> {
  if (playerIds.length < 2) return {};
  return withRetry(() => fetchLedgerStrokesForGroupOnce(playerIds));
}

async function fetchLedgerStrokesForGroupOnce(playerIds: string[]): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('kaki_relationships')
    .select('player_a_id, player_b_id, net_strokes_per_9')
    .eq('status', 'accepted')
    .in('player_a_id', playerIds)
    .in('player_b_id', playerIds);
  if (error) throw error;

  const strokes: Record<string, number> = {};
  for (const row of data as { player_a_id: string; player_b_id: string; net_strokes_per_9: number }[]) {
    // kaki_relationships already stores player_a_id < player_b_id, so this is already canonical.
    strokes[`${row.player_a_id}:${row.player_b_id}`] = row.net_strokes_per_9 * 2;
  }
  return strokes;
}
