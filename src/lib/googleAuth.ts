import * as AuthSession from 'expo-auth-session';
// Not exported from the package root — this is Supabase's own documented import path
// for parsing an OAuth redirect URL (query string or hash fragment) into params.
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from './supabase';

// Lets the in-progress auth browser tab close itself once Supabase redirects back —
// otherwise it's left dangling open after a successful sign-in.
WebBrowser.maybeCompleteAuthSession();

/**
 * Opens Google's consent screen via Supabase's OAuth endpoint, then exchanges the
 * PKCE code Supabase redirects back with for a session. Throws on failure. Returns
 * `false` (not an error) if the user backs out of the browser tab without completing
 * sign-in — the caller must check this before treating the flow as successful, since
 * a cancel resolves cleanly rather than throwing.
 */
export async function signInWithGoogle(): Promise<boolean> {
  const redirectTo = AuthSession.makeRedirectUri();

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
