/** The signed-in user's `profiles` row (Supabase-backed identity: name, handle, handicap, bio). */

import { supabase } from '../lib/supabase';

export type Profile = {
  id: string;
  displayName: string;
  /** No leading "@" — callers prefix it for display. */
  handle: string;
  /** Null until the golfer sets one — there's no editor for this yet. */
  handicap: number | null;
  bio: string | null;
  avatarPath: string | null;
  location: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string;
  handle: string;
  handicap: number | null;
  bio: string | null;
  avatar_path: string | null;
  location: string | null;
};

const PROFILE_COLUMNS = 'id, display_name, handle, handicap, bio, avatar_path, location';

function fromRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    handle: row.handle,
    handicap: row.handicap,
    bio: row.bio,
    avatarPath: row.avatar_path,
    location: row.location,
  };
}

export async function fetchMyProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).single();
  if (error) throw error;
  return fromRow(data as ProfileRow);
}

export type ProfilePatch = Partial<{ displayName: string; handle: string; bio: string }>;

export async function updateMyProfile(userId: string, patch: ProfilePatch): Promise<Profile> {
  const row: Record<string, string> = {};
  if (patch.displayName !== undefined) row.display_name = patch.displayName;
  if (patch.handle !== undefined) row.handle = patch.handle;
  if (patch.bio !== undefined) row.bio = patch.bio;

  const { data, error } = await supabase.from('profiles').update(row).eq('id', userId).select(PROFILE_COLUMNS).single();
  if (error) throw error;
  return fromRow(data as ProfileRow);
}

/** First letters of the first two words, e.g. "Wei Liang" -> "WL", "Marcus" -> "MA". */
export function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

/** Strips a leading "@" so an edited display handle can be written back to the bare `handle` column. */
export function stripHandlePrefix(input: string): string {
  return input.trim().replace(/^@+/, '');
}
