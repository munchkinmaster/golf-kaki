/**
 * Confirms an early finish — tapped when the host finishes a round while at
 * least one player hasn't scored every hole yet. Previously this state was
 * simply unreachable (both FinishScreen and TournamentFinishScreen hard-
 * disabled the CTA until every card was complete), which meant a player who
 * goes AFK mid-round — phone dies, has to leave, whatever — could block the
 * whole group from ever finishing. Mirrors RoundsScreen's DeleteRoundSheet
 * (same Modal/scrim/sheet shape and token choices) since that's this
 * codebase's one other "irreversible action, make sure they mean it" confirm.
 */
import { TriangleAlert } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, getFontFamily, palette, radius, shadows, spacing } from '../theme/tokens';

export function FinishEarlySheet({
  visible,
  names,
  finishing,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  /** First names of every joined player who hasn't scored all their holes yet. */
  names: string[];
  finishing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const whoText = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.length} players`;
  const havent = names.length === 1 ? "hasn't" : "haven't";
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.scrim} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.icon}>
            <TriangleAlert size={21} color={colors.statusWarning} />
          </View>
          <Text style={styles.title}>Finish this round?</Text>
          <Text style={styles.body}>
            <Text style={styles.bodyStrong}>{whoText}</Text> {havent} finished entering scores yet. That round won't count toward handicap, streaks, or
            badges if you finish now — and nobody can add to a card afterward.
          </Text>
          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={onCancel} disabled={finishing}>
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.confirmButton} onPress={onConfirm} disabled={finishing}>
              <Text style={styles.confirmLabel}>{finishing ? 'Finishing…' : 'Finish anyway'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(20,32,24,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surfaceCard,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing[6],
    paddingBottom: spacing[7],
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(201,138,35,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3] + 2,
  },
  title: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 19,
    color: colors.textPrimary,
  },
  body: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textMuted,
    marginTop: spacing[2],
  },
  bodyStrong: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2] + 2,
    marginTop: spacing[5] + 2,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.sand[300],
    borderRadius: radius.md,
    paddingVertical: spacing[3] + 2,
  },
  cancelLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 15,
    color: colors.textSecondary,
  },
  confirmButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.statusDanger,
    borderRadius: radius.md,
    paddingVertical: spacing[3] + 2,
    ...shadows.md,
  },
  confirmLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: palette.white,
  },
});
