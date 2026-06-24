import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { borderWidth, colors, getFontFamily, spacing } from '../theme/tokens';

export type TabBarItem = {
  key: string;
  label: string;
  icon: LucideIcon;
};

type TabBarProps = {
  items: TabBarItem[];
  activeKey: string;
  onChange: (key: string) => void;
};

const ICON_SIZE = 21;

export function TabBar({ items, activeKey, onChange }: TabBarProps) {
  return (
    <View style={styles.base}>
      {items.map((item) => {
        const active = item.key === activeKey;
        const color = active ? colors.primary : colors.textDisabled;
        const Icon = item.icon;

        return (
          <Pressable key={item.key} style={styles.tab} onPress={() => onChange(item.key)}>
            <Icon size={ICON_SIZE} color={color} strokeWidth={2} />
            <Text
              style={[
                styles.label,
                { color, fontFamily: getFontFamily('body', active ? '600' : '500'), fontWeight: active ? '600' : '500' },
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceCard,
    borderTopWidth: borderWidth.thin,
    borderTopColor: colors.borderDefault,
    paddingTop: spacing[2],
    paddingBottom: spacing[3],
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: spacing[1],
  },
  label: {
    fontSize: 10,
  },
});
