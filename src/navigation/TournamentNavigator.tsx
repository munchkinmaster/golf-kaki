import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { TournamentCourseScreen } from '../screens/TournamentCourseScreen';
import { TournamentFormatScreen } from '../screens/TournamentFormatScreen';
import { TournamentPlayersScreen } from '../screens/TournamentPlayersScreen';
import { TournamentPreRoundScreen } from '../screens/TournamentPreRoundScreen';
import { TournamentRulesScreen } from '../screens/TournamentRulesScreen';
import { TournamentSideGamesScreen } from '../screens/TournamentSideGamesScreen';
import { TournamentDraftProvider } from '../state/TournamentDraftContext';
import type { TournamentStackParamList } from './types';

const Stack = createNativeStackNavigator<TournamentStackParamList>();

/**
 * The tournament creation wizard, mounted as a single screen in the root
 * stack (see RootNavigator). TournamentDraftProvider wraps the nested
 * navigator rather than the whole app, so the draft resets automatically
 * every time someone enters this flow fresh (the provider unmounts when the
 * root stack navigates away, remounts with default state next time).
 */
export function TournamentNavigator() {
  return (
    <TournamentDraftProvider>
      <Stack.Navigator initialRouteName="TournamentFormat" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="TournamentFormat" component={TournamentFormatScreen} />
        <Stack.Screen name="TournamentCourse" component={TournamentCourseScreen} />
        <Stack.Screen name="TournamentRules" component={TournamentRulesScreen} />
        <Stack.Screen name="TournamentPlayers" component={TournamentPlayersScreen} />
        <Stack.Screen name="TournamentSideGames" component={TournamentSideGamesScreen} />
        <Stack.Screen name="TournamentPreRound" component={TournamentPreRoundScreen} />
      </Stack.Navigator>
    </TournamentDraftProvider>
  );
}
