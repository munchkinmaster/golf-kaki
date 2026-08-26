import { CircleCheckBig, List, Lock, Trophy, Users } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { colors, getFontFamily, palette, radius, spacing } from '../theme/tokens';

export type InRoundTab = 'scorecard' | 'leaderboard' | 'lobby' | 'finish';

const TABS: { key: InRoundTab; label: string; icon: LucideIcon }[] = [
  { key: 'scorecard', label: 'Scorecard', icon: List },
  { key: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { key: 'lobby', label: 'Lobby', icon: Users },
  { key: 'finish', label: 'Finish', icon: CircleCheckBig },
];

const ICON_SIZE = 21;

type InRoundTabBarProps = {
  active: InRoundTab;
  onNavigate: (tab: InRoundTab) => void;
  /** System 36 keeps the Leaderboard tab muted with a lock badge until the last card is in (SY7–SY9) — the tap still routes there, where a locked screen explains itself. */
  leaderboardLocked?: boolean;
};

/**
 * The four-tab bar docked on every in-round surface (Scorecard / Leaderboard
 * / Lobby / Finish). Extracted from the identical `inRoundNav`/`inRoundTab`
 * styles copy-pasted across ScorecardScreen, LeaderboardScreen,
 * InGameLobbyScreen, and FinishScreen — those screens still own their inline
 * copy today (not touched by this extraction); this is the shared version
 * for the new tournament flow's S6c/S7/S8/S9/S10, which reuses the exact
 * same four tabs and labels.
 */
export function InRoundTabBar({ active, onNavigate, leaderboardLocked = false }: InRoundTabBarProps) {
  return (
    <View style={styles.nav}>
      {TABS.map(({ key, label, icon: Icon }) => {
        const isActive = key === active;
        const locked = key === 'leaderboard' && leaderboardLocked;
        const iconColor = locked ? colors.textMuted : isActive ? colors.primary : palette.sand[400];
        return (
          <Pressable key={key} style={styles.tab} onPress={() => onNavigate(key)}>
            <View style={styles.iconWrap}>
              <Icon size={ICON_SIZE} color={iconColor} />
              {locked ? (
                <View style={styles.lockBadge}>
                  <Lock size={8} color={colors.textMuted} />
                </View>
              ) : null}
            </View>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive, locked && styles.tabLabelLocked]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
    backgroundColor: colors.surfaceCard,
    paddingTop: spacing[2],
    paddingBottom: spacing[3] + 2,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  iconWrap: {
    position: 'relative',
  },
  lockBadge: {
    position: 'absolute',
    right: -5,
    bottom: -2,
    width: 13,
    height: 13,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontFamily: getFontFamily('body', '500'),
    fontWeight: '500',
    fontSize: 10,
    color: palette.sand[400],
  },
  tabLabelActive: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    color: colors.primary,
  },
  tabLabelLocked: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    color: colors.textMuted,
  },
});
