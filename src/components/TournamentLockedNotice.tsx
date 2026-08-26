import { Lock } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, getFontFamily, radius, spacing } from '../theme/tokens';

/**
 * Shown on S1–S3 (Format/Course/Rules) once the tournament shell already
 * exists — the host's first invite on S4 created a real match row, and an
 * invited player's seat (tee, playing handicap) was computed against
 * whatever Format/Course/Rules said at that moment. Letting the host change
 * course or handicap allowance after that would silently desync their view
 * from the invitee's, so these three screens go read-only instead.
 */
export function TournamentLockedNotice() {
  return (
    <View style={styles.banner}>
      <Lock size={14} color={colors.textSecondary} />
      <Text style={styles.text}>Locked — you've already invited players, so this can't change for this tournament.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2] + 1,
    padding: spacing[3] - 1,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.md,
  },
  text: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
});
