/**
 * Kaki (friend) relationships: the friends list, incoming/outgoing requests,
 * and the searchable directory behind the Add-friend sheet. Backed by
 * `kaki_relationships`, which also carries the persistent per-pair stroke
 * ledger (`net_strokes_per_9`) — see the migration comment for why it's
 * stored per-9 rather than per-18.
 */

import { supabase } from '../lib/supabase';

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

/** Accepts an incoming request. */
export async function acceptFriendRequest(relationshipId: string): Promise<void> {
  const { error } = await supabase.from('kaki_relationships').update({ status: 'accepted' }).eq('id', relationshipId);
  if (error) throw error;
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
