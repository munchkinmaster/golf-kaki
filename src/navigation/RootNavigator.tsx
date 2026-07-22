import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';

import type { RootStackParamList } from './types';
import { BragCardScreen } from '../screens/BragCardScreen';
import { CreateGameScreen } from '../screens/CreateGameScreen';
import { FinishScreen } from '../screens/FinishScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { InGameLobbyScreen } from '../screens/InGameLobbyScreen';
import { JoinGameScreen } from '../screens/JoinGameScreen';
import { KakiScreen } from '../screens/KakiScreen';
import { LandingScreen } from '../screens/LandingScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { MatchLobbyScreen } from '../screens/MatchLobbyScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RecapScreen } from '../screens/RecapScreen';
import { RoundsScreen } from '../screens/RoundsScreen';
import { ScorecardScreen } from '../screens/ScorecardScreen';
import { SelectCourseScreen } from '../screens/SelectCourseScreen';
import { TrophyCabinetScreen } from '../screens/TrophyCabinetScreen';
import { useAuth } from '../state/AuthContext';
import { colors } from '../theme/tokens';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { session, loading } = useAuth();

  // Session restore (from AsyncStorage) resolves before we pick an initial route —
  // otherwise a signed-in user would always flash Landing on cold start.
  if (loading) {
    return <View style={[styles.loading, { backgroundColor: colors.surfacePage }]} />;
  }

  return (
    <Stack.Navigator initialRouteName={session ? 'Home' : 'Landing'} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Kaki" component={KakiScreen} />
      <Stack.Screen name="Rounds" component={RoundsScreen} />
      <Stack.Screen name="TrophyCabinet" component={TrophyCabinetScreen} />
      <Stack.Screen name="BragCard" component={BragCardScreen} />
      <Stack.Screen name="SelectCourse" component={SelectCourseScreen} />
      <Stack.Screen name="JoinGame" component={JoinGameScreen} />
      <Stack.Screen name="CreateGame" component={CreateGameScreen} />
      <Stack.Screen name="MatchLobby" component={MatchLobbyScreen} />
      <Stack.Screen name="Scorecard" component={ScorecardScreen} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Stack.Screen name="InGameLobby" component={InGameLobbyScreen} />
      <Stack.Screen name="Finish" component={FinishScreen} />
      <Stack.Screen name="Recap" component={RecapScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
  },
});
