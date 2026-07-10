import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY — copy .env.example to .env and fill in your project values.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // AsyncStorage rather than the default (browser-only) localStorage, so sessions
    // persist across app restarts on native. PKCE puts the auth code in the redirect
    // URL's query string, which `expo-linking`/`expo-auth-session` can parse reliably —
    // the implicit flow's hash-fragment tokens are awkward to read back from a deep link.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // On web, Google sign-in does a full-page redirect (see src/lib/googleAuth.ts) rather
    // than the native in-app-browser flow, so the auth code comes back in this tab's own
    // URL — let supabase-js pick it up itself instead of the manual exchange native does.
    detectSessionInUrl: Platform.OS === 'web',
    flowType: 'pkce',
  },
});
