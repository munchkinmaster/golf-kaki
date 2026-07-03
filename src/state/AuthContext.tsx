import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { signInWithGoogle as runGoogleSignIn } from '../lib/googleAuth';
import { supabase } from '../lib/supabase';

type AuthContextValue = {
  session: Session | null;
  /** True until the initial session restore (from AsyncStorage) resolves. */
  loading: boolean;
  /** True while a Google sign-in is in flight, for disabling/loading the button. */
  signingIn: boolean;
  /** Resolves `false` (not an error) if the user backs out without completing sign-in. */
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    setSigningIn(true);
    try {
      return await runGoogleSignIn();
    } finally {
      setSigningIn(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const value = useMemo<AuthContextValue>(
    () => ({ session, loading, signingIn, signInWithGoogle, signOut }),
    [session, loading, signingIn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
