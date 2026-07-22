import { Bell } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { IconButton } from './IconButton';
import { colors, getFontFamily, palette } from '../theme/tokens';

type Props = {
  count: number;
  size?: number;
  iconSize?: number;
  onPress: () => void;
};

/** Persistent header entry point to the Notifications screen — bell + unread-count badge, reused on Home, Profile, Rounds, and Kaki. */
export function NotificationBell({ count, size = 44, iconSize = 20, onPress }: Props) {
  return (
    <View>
      <IconButton icon={Bell} size={size} iconSize={iconSize} color={colors.textSecondary} onPress={onPress} />
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>{count > 99 ? '99+' : count}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 5,
    borderRadius: 999,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.surfacePage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 10,
    color: palette.white,
  },
});
