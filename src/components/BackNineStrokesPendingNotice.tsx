import { Hourglass } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, getFontFamily, radius, spacing } from '../theme/tokens';

export type FrontNineBlocker = { playerId: string; name: string; holes: number[] };

/**
 * Shown on the back nine of an 18-hole/9-strokes-basis round while some
 * player's front 9 still has a gap, so no pair's deal can be re-struck yet
 * (see round.ts's hasCompleteFrontNine and useLiveRound's buildBackNineDeals).
 *
 * Exists because the state it describes is invisible otherwise: a hole with no
 * score row renders its par in the grid, identical to a hole actually played
 * to par, and holes with no deal render without stroke flags and get compared
 * on raw gross — which reads exactly like "the strokes reset to zero." This
 * says whose card is holding it up and which hole, because that's the only
 * part a player can act on.
 */
export function BackNineStrokesPendingNotice({ blockers, canEdit, onPress }: { blockers: FrontNineBlocker[]; canEdit: boolean; onPress?: () => void }) {
  if (blockers.length === 0) return null;

  const body = canEdit ? 'Tap to fill it in.' : 'These holes are playing scratch until then.';
  const Container = canEdit && onPress ? Pressable : View;

  return (
    <Container style={styles.banner} onPress={canEdit ? onPress : undefined}>
      <Hourglass size={15} color={colors.statusWarning} style={styles.icon} />
      <Text style={styles.text}>
        <Text style={styles.lead}>Back-9 strokes are on hold</Text>
        {` — ${describe(blockers)}. ${body}`}
      </Text>
    </Container>
  );
}

/** "koon hasn't entered hole 9" / "koon hasn't entered holes 7, 8 and 9" / "koon and 航超 haven't finished their front 9". */
function describe(blockers: FrontNineBlocker[]): string {
  if (blockers.length > 1) return `${joinNames(blockers.map((b) => b.name))} haven't finished their front 9`;
  const only = blockers[0]!;
  if (only.holes.length === 0 || only.holes.length > 3) return `${only.name} hasn't finished their front 9`;
  const holes = joinNames(only.holes.map(String));
  return `${only.name} hasn't entered ${only.holes.length === 1 ? 'hole' : 'holes'} ${holes}`;
}

function joinNames(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2] + 1,
    padding: spacing[3] - 1,
    marginBottom: spacing[3],
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.md,
  },
  icon: {
    flexShrink: 0,
    marginTop: 1,
  },
  text: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  lead: {
    fontFamily: getFontFamily('body', '600'),
    color: colors.textPrimary,
  },
});
