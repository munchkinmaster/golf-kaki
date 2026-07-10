import { Component } from 'react';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';
import { colors, fontWeight, getFontFamily, spacing } from '../theme/tokens';

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Catches render errors anywhere below it so a bug in one screen shows a
 *  recoverable message instead of a blank/frozen app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('Unhandled render error', error, info.componentStack);
  }

  reload = () => {
    if (Platform.OS === 'web') {
      window.location.reload();
      return;
    }
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.page}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          Golf Kaki hit an unexpected error. Try again — if it keeps happening, let us know what you were doing.
        </Text>
        <Button label="Reload" variant="secondary" onPress={this.reload} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfacePage,
    paddingHorizontal: spacing[6],
    gap: spacing[3],
  },
  title: {
    fontFamily: getFontFamily('display', fontWeight.bold),
    fontSize: 22,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    fontFamily: getFontFamily('body', fontWeight.regular),
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
});
