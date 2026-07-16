import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, type NavigationState } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from './src/components/ErrorBoundary';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AuthProvider, useAuth } from './src/state/AuthContext';
import { ProfileProvider } from './src/state/ProfileContext';
import { fontAssets } from './src/theme/fonts';
import { colors } from './src/theme/tokens';

export default function App() {
  const [fontsLoaded] = useFonts(fontAssets);

  if (!fontsLoaded) {
    return <View style={[styles.container, { backgroundColor: colors.surfacePage }]} />;
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <ProfileProvider>
          <SafeAreaProvider>
            <AppNavigation />
          </SafeAreaProvider>
        </ProfileProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

const NAVIGATION_STATE_KEY = 'golfkaki.navigationState';

/**
 * Mobile browsers reclaim memory from backgrounded tabs by reloading them, which drops
 * React Navigation's in-memory state and lands back on whatever RootNavigator's
 * `initialRouteName` is — Home, not wherever the player actually was (e.g. mid-scorecard).
 * Persisting navigation state to AsyncStorage and restoring it here fixes that. Restoring
 * is gated on there being a live session — a signed-out/expired session should always land
 * on Landing, not resume a stale deep route with no way to fetch its data.
 */
function AppNavigation() {
  const { session, loading } = useAuth();
  const [isNavReady, setIsNavReady] = useState(false);
  const [initialState, setInitialState] = useState<NavigationState | undefined>();

  useEffect(() => {
    if (loading) return;
    (async () => {
      try {
        if (session) {
          const saved = await AsyncStorage.getItem(NAVIGATION_STATE_KEY);
          if (saved) setInitialState(JSON.parse(saved));
        }
      } catch {
        // corrupt/unreadable saved state — fall through to RootNavigator's own default route
      } finally {
        setIsNavReady(true);
      }
    })();
  }, [loading, session]);

  if (loading || !isNavReady) {
    return <View style={[styles.container, { backgroundColor: colors.surfacePage }]} />;
  }

  return (
    <NavigationContainer
      initialState={initialState}
      onStateChange={(state) => {
        AsyncStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(state)).catch(() => {});
      }}
    >
      <RootNavigator />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
