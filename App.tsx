import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, type NavigationState } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from './src/components/ErrorBoundary';
import { navigationRef } from './src/navigation/navigationRef';
import { NAVIGATION_STATE_KEY, parseNavState, serializeNavState } from './src/navigation/persistedNavState';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AuthProvider, useAuth } from './src/state/AuthContext';
import { InviteToastProvider } from './src/state/InviteToastProvider';
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
            <InviteToastProvider>
              <AppNavigation />
            </InviteToastProvider>
          </SafeAreaProvider>
        </ProfileProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

/**
 * Mobile browsers reclaim memory from backgrounded tabs by reloading them, which drops
 * React Navigation's in-memory state and lands back on whatever RootNavigator's
 * `initialRouteName` is — Home, not wherever the player actually was (e.g. mid-scorecard).
 * Persisting navigation state to AsyncStorage and restoring it here fixes that. Restoring
 * is gated on there being a live session — a signed-out/expired session should always land
 * on Landing, not resume a stale deep route with no way to fetch its data — and on the
 * saved stack being recent and not parked on a recap (see parseNavState).
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
          setInitialState(parseNavState(await AsyncStorage.getItem(NAVIGATION_STATE_KEY), Date.now()));
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
      ref={navigationRef}
      initialState={initialState}
      onStateChange={(state) => {
        AsyncStorage.setItem(NAVIGATION_STATE_KEY, serializeNavState(state, Date.now())).catch(() => {});
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
