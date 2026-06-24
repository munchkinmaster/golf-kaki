import { NavigationContainer } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from './src/navigation/RootNavigator';
import { fontAssets } from './src/theme/fonts';
import { colors } from './src/theme/tokens';

export default function App() {
  const [fontsLoaded] = useFonts(fontAssets);

  if (!fontsLoaded) {
    return <View style={[styles.container, { backgroundColor: colors.surfacePage }]} />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
