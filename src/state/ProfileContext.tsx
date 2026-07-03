import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { Profile, ProfilePatch } from '../data/profile';
import { fetchMyProfile, updateMyProfile } from '../data/profile';
import { useAuth } from './AuthContext';

type ProfileContextValue = {
  /** Null until the fetch resolves, or if signed out. */
  profile: Profile | null;
  /** True while the signed-in user's profile row is being fetched. */
  loading: boolean;
  /** Set if the fetch failed (e.g. no profiles row for this user) — profile stays null. */
  error: string | null;
  /** Re-runs the fetch, for a "Try again" affordance after a failed load. */
  refresh: () => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      setProfile(await fetchMyProfile(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setError(null);
      return;
    }
    load(userId);
  }, [userId, load]);

  const refresh = useCallback(async () => {
    if (userId) await load(userId);
  }, [userId, load]);

  const updateProfile = useCallback(
    async (patch: ProfilePatch) => {
      if (!userId) throw new Error('updateProfile called without a signed-in user.');
      setProfile(await updateMyProfile(userId, patch));
    },
    [userId],
  );

  const value = useMemo<ProfileContextValue>(
    () => ({ profile, loading, error, refresh, updateProfile }),
    [profile, loading, error, refresh, updateProfile],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within a ProfileProvider');
  return ctx;
}
