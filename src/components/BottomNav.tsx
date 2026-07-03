import type { LucideIcon } from 'lucide-react-native';
import { CirclePlus, Flag, House, User, Users } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { borderWidth, colors, getFontFamily, spacing } from '../theme/tokens';

export type BottomNavTab = 'home' | 'rounds' | 'kaki' | 'profile';

type NavItem = {
  key: BottomNavTab;
  label: string;
  icon: LucideIcon;
};

const LEFT_ITEMS: NavItem[] = [
  { key: 'home', label: 'Home', icon: House },
  { key: 'rounds', label: 'Rounds', icon: Flag },
];

const RIGHT_ITEMS: NavItem[] = [
  { key: 'kaki', label: 'Kaki', icon: Users },
  { key: 'profile', label: 'Profile', icon: User },
];

const TAB_ICON_SIZE = 23;
const START_ICON_SIZE = 25;

type BottomNavProps = {
  /** Which home-base tab is currently shown. Start has no "active" state — it's a flow trigger, not a screen you stay on. */
  active: BottomNavTab;
  onNavigate: (tab: BottomNavTab) => void;
  /** Begins the round flow (Select course). */
  onStart?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** The bottom tab bar docked on home-base screens (Home, Rounds, Kaki, Profile). Build once, reuse everywhere — never copy per screen. */
export function BottomNav({ active, onNavigate, onStart, style }: BottomNavProps) {
  const insets = useSafeAreaInsets();

  function renderItem(item: NavItem) {
    const isActive = item.key === active;
    const color = isActive ? colors.primary : colors.textDisabled;
    const Icon = item.icon;

    return (
      <Pressable key={item.key} style={styles.tab} onPress={() => onNavigate(item.key)}>
        <Icon size={TAB_ICON_SIZE} color={color} strokeWidth={isActive ? 2.4 : 2} />
        <Text
          style={[
            styles.label,
            { color, fontFamily: getFontFamily('body', isActive ? '700' : '500'), fontWeight: isActive ? '700' : '500' },
          ]}
        >
          {item.label}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.base, { paddingBottom: spacing[3] + insets.bottom }, style]}>
      {LEFT_ITEMS.map(renderItem)}
      <Pressable style={styles.tab} onPress={onStart}>
        <CirclePlus size={START_ICON_SIZE} color={colors.accent} strokeWidth={2.4} />
        <Text style={[styles.label, styles.startLabel]}>Start</Text>
      </Pressable>
      {RIGHT_ITEMS.map(renderItem)}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surfaceCard,
    borderTopWidth: borderWidth.thin,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing[3],
    paddingHorizontal: spacing[1] + 2,
    shadowColor: '#0E3A28',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.07,
    shadowRadius: 22,
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: spacing[1],
  },
  label: {
    fontSize: 10,
  },
  startLabel: {
    color: colors.accent,
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
  },
});
