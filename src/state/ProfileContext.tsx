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
  updateProfile: (patch: ProfilePatch) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchMyProfile(userId)
      .then((fetched) => {
        if (!cancelled) setProfile(fetched);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const updateProfile = useCallback(
    async (patch: ProfilePatch) => {
      if (!userId) throw new Error('updateProfile called without a signed-in user.');
      setProfile(await updateMyProfile(userId, patch));
    },
    [userId],
  );

  const value = useMemo<ProfileContextValue>(() => ({ profile, loading, updateProfile }), [profile, loading, updateProfile]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within a ProfileProvider');
  return ctx;
}
