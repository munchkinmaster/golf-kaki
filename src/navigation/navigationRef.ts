import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from './types';

/**
 * Lets code outside the component tree (InviteToastProvider's "View" tap,
 * which lives above NavigationContainer so the toast can render over any
 * screen) navigate without needing a screen's own `navigation` prop.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
