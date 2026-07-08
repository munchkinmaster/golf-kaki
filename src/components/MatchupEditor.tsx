/**
 * The pairwise Get/Give stroke editor — shared between MatchLobbyScreen
 * (pre-round) and InGameLobbyScreen (mid-round, same editor minus the Start
 * button). Kaki Match Play is genuinely pairwise: every two players in the
 * match have their own agreed strokes, not just each player vs the host. The
 * host oversees every pair; everyone else only sees (and can only edit) the
 * pairs they're personally staked in.
 */

import { Minus, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { pairKey } from '../data/round';
import type { StrokeMode } from '../data/round';
import { colors, getFontFamily, getPlayerColors, radius, shadows, spacing } from '../theme/tokens';

export type PairSetting = {
  playerAId: string;
  playerBId: string;
  strokes: number;
  aGives: boolean;
};

export type MatchupEditorPlayer = { playerId: string; name: string; handicap: number | null };

type Props = {
  players: MatchupEditorPlayer[];
  viewerId: string | null | undefined;
  hostId: string | null;
  pairSettings: PairSetting[];
  onAdjustStrokes: (a: string, b: string, delta: number) => void;
  onSetAGives: (a: string, b: string, aGivesNext: boolean) => void;
  /** Mid-round (InGameLobbyScreen): once the round's underway, only the host can still adjust strokes — everyone else is view-only, even for their own pairs. Pre-round Match Lobby leaves this off. */
  hostOnlyEdit?: boolean;
};

export function MatchupEditor({ players, viewerId, hostId, pairSettings, onAdjustStrokes, onSetAGives, hostOnlyEdit = false }: Props) {
  const isHostViewer = hostId !== null && hostId === viewerId;
  const playersById = new Map(players.map((p) => [p.playerId, p]));

  function canEditPair(pair: PairSetting): boolean {
    if (hostOnlyEdit) return isHostViewer;
    return isHostViewer || pair.playerAId === viewerId || pair.playerBId === viewerId;
  }

  const visiblePairSettings = isHostViewer
    ? pairSettings
    : pairSettings.filter((p) => p.playerAId === viewerId || p.playerBId === viewerId);

  return (
    <View style={styles.strokeSettingsCard}>
      {visiblePairSettings.map((pair, index) => {
        const nameA = playersById.get(pair.playerAId)?.name ?? '';
        const nameB = playersById.get(pair.playerBId)?.name ?? '';
        const handicapA = playersById.get(pair.playerAId)?.handicap ?? null;
        const handicapB = playersById.get(pair.playerBId)?.handicap ?? null;
        const viewerIsA = pair.playerAId === viewerId;
        const viewerIsB = pair.playerBId === viewerId;
        const editable = canEditPair(pair);

        // Every pair has its own deal now (not just host-vs-someone). If the
        // viewer is one of the two, show it from their own side ("I"); if
        // they're a bystander to this particular pair (only possible for the
        // host, or in a 4+ player match), show it in third person instead.
        let subjectLabel: string;
        let counterpartName: string;
        let counterpartHandicap: number | null;
        let displayMode: StrokeMode;
        let colorSubjectId: string;
        if (viewerIsA) {
          subjectLabel = 'I';
          counterpartName = nameB;
          counterpartHandicap = handicapB;
          displayMode = pair.aGives ? 'give' : 'get';
          colorSubjectId = pair.playerBId;
        } else if (viewerIsB) {
          subjectLabel = 'I';
          counterpartName = nameA;
          counterpartHandicap = handicapA;
          displayMode = pair.aGives ? 'get' : 'give';
          colorSubjectId = pair.playerAId;
        } else {
          subjectLabel = nameA;
          counterpartName = nameB;
          counterpartHandicap = handicapB;
          displayMode = pair.aGives ? 'give' : 'get';
          colorSubjectId = pair.playerBId;
        }
        const verb = (word: string) => (subjectLabel === 'I' ? word : `${word}s`);
        const playerColor = getPlayerColors(Math.max(0, players.findIndex((pl) => pl.playerId === colorSubjectId)));

        function toggleMode(sideMode: StrokeMode) {
          // `sideMode` is from whichever side is rendered as "I"/subjectLabel — convert back to canonical a-perspective before persisting.
          const aGivesNext = viewerIsB ? sideMode === 'get' : sideMode === 'give';
          onSetAGives(pair.playerAId, pair.playerBId, aGivesNext);
        }

        return (
          <View
            key={pairKey(pair.playerAId, pair.playerBId)}
            style={[styles.strokeSettingRow, index < visiblePairSettings.length - 1 && styles.strokeSettingRowDivider]}
          >
            <View style={styles.strokeSettingTopRow}>
              <View style={[styles.strokeAvatar, { backgroundColor: playerColor.background }]}>
                <Text style={[styles.strokeAvatarLabel, { color: playerColor.color }]}>{counterpartName.charAt(0)}</Text>
              </View>
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{counterpartName}</Text>
                <Text style={styles.playerMeta}>{counterpartHandicap !== null ? `HCP ${counterpartHandicap}` : 'No handicap yet'}</Text>
              </View>
              <View style={[styles.stepperRow, !editable && styles.stepperRowDisabled]}>
                <Pressable
                  style={styles.stepperButton}
                  disabled={!editable}
                  onPress={() => onAdjustStrokes(pair.playerAId, pair.playerBId, -1)}
                >
                  <Minus size={15} color={colors.textDisabled} />
                </Pressable>
                <Text style={styles.stepperValue}>{pair.strokes}</Text>
                <Pressable
                  style={[styles.stepperButton, styles.stepperButtonAccent]}
                  disabled={!editable}
                  onPress={() => onAdjustStrokes(pair.playerAId, pair.playerBId, 1)}
                >
                  <Plus size={15} color={colors.primary} />
                </Pressable>
              </View>
            </View>
            <View style={styles.strokeModeRow}>
              <Text style={styles.strokeModeLabel}>{subjectLabel}</Text>
              <View style={[styles.strokeModeTrack, !editable && styles.strokeModeTrackDisabled]}>
                <Pressable
                  style={[styles.strokeModeOption, displayMode === 'get' && styles.strokeModeOptionActive]}
                  disabled={!editable}
                  onPress={() => toggleMode('get')}
                >
                  <Text style={[styles.strokeModeOptionLabel, displayMode === 'get' && styles.strokeModeOptionLabelGet]}>
                    {verb('get')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.strokeModeOption, displayMode === 'give' && styles.strokeModeOptionActive]}
                  disabled={!editable}
                  onPress={() => toggleMode('give')}
                >
                  <Text style={[styles.strokeModeOptionLabel, displayMode === 'give' && styles.strokeModeOptionLabelGive]}>
                    {verb('give')}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.strokeModeLabel}>{displayMode === 'get' ? `from ${counterpartName}` : `to ${counterpartName}`}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strokeSettingsCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[3] + 1,
    marginBottom: spacing[3] + 2,
    ...shadows.xs,
  },
  strokeSettingRow: {
    paddingVertical: spacing[3] - 1,
  },
  strokeSettingRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSunken,
  },
  strokeSettingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
  },
  strokeAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  strokeAvatarLabel: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 13,
  },
  playerInfo: {
    flex: 1,
    minWidth: 0,
  },
  playerName: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: colors.textPrimary,
  },
  playerMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: 1,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] - 1,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.pill,
    padding: 3,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonAccent: {
    backgroundColor: colors.surfaceBrandSoft,
  },
  stepperRowDisabled: {
    opacity: 0.5,
  },
  stepperValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.textPrimary,
    minWidth: 20,
    textAlign: 'center',
  },
  strokeModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
    marginTop: spacing[2] + 1,
    paddingLeft: 34 + (spacing[2] + 3),
  },
  strokeModeLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
  },
  strokeModeTrack: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.pill,
    padding: 3,
  },
  strokeModeTrackDisabled: {
    opacity: 0.5,
  },
  strokeModeOption: {
    paddingVertical: spacing[1] + 1,
    paddingHorizontal: spacing[3] - 1,
    borderRadius: radius.pill,
  },
  strokeModeOptionActive: {
    backgroundColor: colors.surfaceCard,
  },
  strokeModeOptionLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    color: colors.textDisabled,
  },
  strokeModeOptionLabelGet: {
    color: colors.primary,
  },
  strokeModeOptionLabelGive: {
    color: colors.accent,
  },
});
