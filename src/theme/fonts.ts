import {
  Quicksand_400Regular,
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
} from '@expo-google-fonts/quicksand';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';

/** Keyed as `${fontFamily}-${fontWeight}` to match theme/tokens.ts's getFontFamily(). */
export const fontAssets = {
  'Quicksand-400': Quicksand_400Regular,
  'Quicksand-500': Quicksand_500Medium,
  'Quicksand-600': Quicksand_600SemiBold,
  'Quicksand-700': Quicksand_700Bold,
  'PlusJakartaSans-400': PlusJakartaSans_400Regular,
  'PlusJakartaSans-500': PlusJakartaSans_500Medium,
  'PlusJakartaSans-600': PlusJakartaSans_600SemiBold,
  'PlusJakartaSans-700': PlusJakartaSans_700Bold,
  'SpaceGrotesk-400': SpaceGrotesk_400Regular,
  'SpaceGrotesk-500': SpaceGrotesk_500Medium,
  'SpaceGrotesk-600': SpaceGrotesk_600SemiBold,
  'SpaceGrotesk-700': SpaceGrotesk_700Bold,
} as const;
