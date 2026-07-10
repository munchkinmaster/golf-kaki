import * as AuthSession from 'expo-auth-session';
// Not exported from the package root — this is Supabase's own documented import path
// for parsing an OAuth redirect URL (query string or hash fragment) into params.
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from './supabase';

// Lets the in-progress auth browser tab close itself once Supabase redirects back —
// otherwise it's left dangling open after a successful sign-in.
WebBrowser.maybeCompleteAuthSession();

/**
 * Starts Google sign-in via Supabase's OAuth endpoint. Throws on failure. Returns
 * `false` (not an error) if the user backs out without completing sign-in — the
 * caller must check this before treating the flow as successful, since a cancel
 * resolves cleanly rather than throwing.
 */
export async function signInWithGoogle(): Promise<boolean> {
  const redirectTo = AuthSession.makeRedirectUri();

  if (Platform.OS === 'web') {
    // A full-page redirect rather than the native popup/in-app-browser flow below —
    // expo-web-browser's web implementation opens the consent screen via window.open(),
    // which mobile Safari silently blocks once it happens after an `await` (i.e. no
    // longer counts as a direct result of the tap). A plain navigation isn't subject to
    // that. supabase-js completes the flow itself on reload (detectSessionInUrl, see
    // src/lib/supabase.ts), so this function's return value is moot once it navigates.
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) throw error;
    return true;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Supabase did not return an authorization URL.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'cancel' || result.type === 'dismiss') return false;
  if (result.type !== 'success' || !result.url) {
    throw new Error('Google sign-in did not complete.');
  }

  const { params, errorCode } = QueryParams.getQueryParams(result.url);
  if (errorCode) throw new Error(errorCode);

  const { code } = params;
  if (!code) throw new Error('No authorization code returned from Google sign-in.');

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
  return true;
}
