import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check, ChevronLeft, ChevronRight, Coins, Flag, Info, Landmark, Layers, Minus, Pencil, Plus, Trash2, Users } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { BottomSheet } from '../components/BottomSheet';
import { IconButton } from '../components/IconButton';
import type { SkinsBasis, SkinsConfig, SkinsTiedHoleRule } from '../data/skins';
import { setSkinsParticipant, updateTournamentSideGames } from '../data/tournaments';
import type { TournamentStackParamList } from '../navigation/types';
import { useTournamentDraft } from '../state/TournamentDraftContext';
import { colors, getFontFamily, getSolidAvatarColor, palette, radius, screenGutter, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<TournamentStackParamList, 'TournamentSideGames'>;

const STAKE_PRESETS = [2, 5, 10, 20];

const TIE_RULE_INFO: { id: SkinsTiedHoleRule; title: string; sub: string }[] = [
  { id: 'carryover', title: 'Carry over', sub: 'Rolls to next' },
  { id: 'split_pot', title: 'Split pot', sub: 'Ties share it' },
  { id: 'void', title: 'No carry', sub: 'Skin is void' },
];

const TIE_RULE_NOTE: Record<SkinsTiedHoleRule, string> = {
  carryover: 'A tied hole rolls its skin into the next hole. If the very last hole is still tied, the pot splits evenly among whoever tied it.',
  split_pot: 'A tied hole splits its skin evenly among the tied players immediately — no rolling forward.',
  void: 'A tied hole is void — nobody wins it, and it does not roll forward. That skin is simply out of play.',
};

function summaryLine(config: SkinsConfig, totalPlayers: number): string {
  const tieLabel = TIE_RULE_INFO.find((r) => r.id === config.tiedHoleRule)?.title.toLowerCase() ?? config.tiedHoleRule;
  const whoLabel = config.participantIds.length === totalPlayers ? `all ${totalPlayers} players` : `${config.participantIds.length} of ${totalPlayers} players`;
  return `$${config.stakePerHole}/hole · ${tieLabel} · ${config.basis} · ${whoLabel}`;
}

export function TournamentSideGamesScreen({ navigation }: Props) {
  const { draft, update } = useTournamentDraft();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [skinsConfigOpen, setSkinsConfigOpen] = useState(false);
  const [sideGamesError, setSideGamesError] = useState<string | null>(null);

  const joinedPlayers = draft.players.filter((p) => p.status === 'joined');
  const existingSkins = draft.sideGames.find((g) => g.type === 'skins');

  // Once the shell exists (the host already invited someone on S4), side
  // games write live too — stake/tie-rule/basis to matches.game_settings,
  // and participation to each joined player's own skins_opt_in column
  // (that's what the in-round lobby actually reads, not this jsonb blob).
  async function saveSkinsConfig(config: SkinsConfig) {
    const nextSideGames = [...draft.sideGames.filter((g) => g.type !== 'skins'), config];
    update({ sideGames: nextSideGames });
    setSkinsConfigOpen(false);
    setPickerOpen(false);

    const matchId = draft.matchId;
    if (!matchId) return;
    setSideGamesError(null);
    try {
      await updateTournamentSideGames(matchId, nextSideGames);
      await Promise.all(joinedPlayers.map((p) => setSkinsParticipant(matchId, p.id, config.participantIds.includes(p.id))));
    } catch {
      setSideGamesError('Could not save — please try again.');
    }
  }

  async function removeSideGame(type: SkinsConfig['type']) {
    const nextSideGames = draft.sideGames.filter((g) => g.type !== type);
    update({ sideGames: nextSideGames });

    const matchId = draft.matchId;
    if (!matchId) return;
    setSideGamesError(null);
    try {
      await updateTournamentSideGames(matchId, nextSideGames);
    } catch {
      setSideGamesError('Could not remove — please try again.');
    }
  }

  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <IconButton icon={ChevronLeft} iconSize={20} onPress={() => navigation.goBack()} />
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Side games</Text>
            <Text style={styles.headerSubtitle}>Optional · same round, separate results</Text>
          </View>
          <View style={styles.extraTag}>
            <Text style={styles.extraTagLabel}>Extra</Text>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <Layers size={18} color={colors.accent} />
            </View>
            <View style={styles.heroBody}>
              <Text style={styles.heroTitle}>Rides on {draft.name}</Text>
              <Text style={styles.heroSubtitle}>Same scorecard · {joinedPlayers.length} players</Text>
            </View>
          </View>

          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.fieldLabel}>On this round</Text>
              <Text style={styles.fieldCount}>{draft.sideGames.length} added</Text>
            </View>
            {existingSkins ? (
              <View style={styles.addedCard}>
                <View style={styles.addedCardIcon}>
                  <Coins size={19} color={colors.primary} />
                </View>
                <View style={styles.addedCardBody}>
                  <View style={styles.addedCardTitleRow}>
                    <Text style={styles.addedCardTitle}>Skins</Text>
                    <View style={styles.individualTag}>
                      <Text style={styles.individualTagLabel}>Individual</Text>
                    </View>
                  </View>
                  <Text style={styles.addedCardMeta}>{summaryLine(existingSkins, joinedPlayers.length)}</Text>
                </View>
                <View style={styles.addedCardActions}>
                  <Pressable style={styles.addedCardEdit} onPress={() => setSkinsConfigOpen(true)}>
                    <Pencil size={15} color={colors.primary} />
                  </Pressable>
                  <Pressable style={styles.addedCardDelete} onPress={() => removeSideGame('skins')}>
                    <Trash2 size={15} color={colors.statusDanger} />
                  </Pressable>
                </View>
              </View>
            ) : null}
            {sideGamesError ? <Text style={styles.sideGamesErrorText}>{sideGamesError}</Text> : null}
          </View>

          <View>
            <Text style={styles.fieldLabel}>Add a side game</Text>
            <Pressable style={styles.addButton} onPress={() => setPickerOpen(true)}>
              <Plus size={18} color={colors.primary} />
              <Text style={styles.addButtonLabel}>Add side game</Text>
            </Pressable>
            <Text style={styles.addHint}>Skins for now — Nassau, Banker &amp; Snake coming soon</Text>
          </View>

          <View style={styles.noteCard}>
            <Info size={15} color={colors.primary} style={styles.noteIcon} />
            <Text style={styles.noteText}>Side games score automatically from the same holes you enter for the tournament — winners settle separately from the main standings.</Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.saveContinueButton} onPress={() => navigation.navigate('TournamentPreRound')}>
            <Check size={19} color={palette.white} />
            <Text style={styles.saveContinueLabel}>Save &amp; continue</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('TournamentPreRound')}>
            <Text style={styles.skipLabel}>Skip — no side games</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <BottomSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title="Add a side game" subtitle="Pick one — you can add more later.">
        <Pressable
          style={styles.typeRow}
          onPress={() => {
            setPickerOpen(false);
            setSkinsConfigOpen(true);
          }}
        >
          <View style={styles.typeRowIcon}>
            <Coins size={19} color={colors.primary} />
          </View>
          <View style={styles.typeRowBody}>
            <Text style={styles.typeRowName}>Skins</Text>
            <Text style={styles.typeRowDesc}>Outright lowest score wins the hole's pot</Text>
          </View>
          <ChevronRight size={18} color={palette.ink[300]} />
        </Pressable>
        <DisabledTypeRow icon={Flag} name="Nassau" description="Three bets in one — front 9, back 9, and overall." />
        <DisabledTypeRow icon={Landmark} name="Banker" description="One player takes on the group each hole for points." />
      </BottomSheet>

      <SkinsConfigSheet
        visible={skinsConfigOpen}
        onClose={() => setSkinsConfigOpen(false)}
        onBack={() => {
          setSkinsConfigOpen(false);
          setPickerOpen(true);
        }}
        existing={existingSkins}
        joinedPlayers={joinedPlayers}
        defaultBasis={draft.standingsBasis === 'gross' ? 'gross' : 'nett'}
        onSave={saveSkinsConfig}
      />
    </View>
  );
}

function DisabledTypeRow({ icon: Icon, name, description }: { icon: typeof Flag; name: string; description: string }) {
  return (
    <View style={styles.typeRowDisabled}>
      <View style={styles.typeRowIconDisabled}>
        <Icon size={19} color={colors.textSecondary} />
      </View>
      <View style={styles.typeRowBody}>
        <View style={styles.typeRowNameRow}>
          <Text style={styles.typeRowName}>{name}</Text>
          <View style={styles.soonTag}>
            <Text style={styles.soonTagLabel}>SOON</Text>
          </View>
        </View>
        <Text style={styles.typeRowDesc}>{description}</Text>
      </View>
      <ChevronRight size={18} color={palette.ink[300]} />
    </View>
  );
}

function SkinsConfigSheet({
  visible,
  onClose,
  onBack,
  existing,
  joinedPlayers,
  defaultBasis,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onBack: () => void;
  existing: SkinsConfig | undefined;
  joinedPlayers: { id: string; name: string; playingHandicap: number }[];
  defaultBasis: SkinsBasis;
  onSave: (config: SkinsConfig) => void;
}) {
  const allIds = joinedPlayers.map((p) => p.id);
  const [stake, setStake] = useState(existing?.stakePerHole ?? 5);
  const [tieRule, setTieRule] = useState<SkinsTiedHoleRule>(existing?.tiedHoleRule ?? 'carryover');
  const [basis, setBasis] = useState<SkinsBasis>(existing?.basis ?? defaultBasis);
  const [participantIds, setParticipantIds] = useState<string[]>(existing?.participantIds ?? allIds);

  function toggleParticipant(id: string) {
    setParticipantIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      scrollable={false}
      footer={
        <Pressable
          style={styles.addToRoundButton}
          onPress={() =>
            onSave({ type: 'skins', stakePerHole: stake, tiedHoleRule: tieRule, basis, participantIds: participantIds.length > 0 ? participantIds : allIds })
          }
        >
          <Plus size={18} color={palette.white} />
          <Text style={styles.addToRoundButtonLabel}>Add to round</Text>
        </Pressable>
      }
    >
      <View style={styles.skinsSheetHeader}>
        <Pressable style={styles.skinsSheetBack} onPress={onBack}>
          <ChevronLeft size={18} color={colors.textSecondary} />
        </Pressable>
        <View style={styles.typeRowIcon}>
          <Coins size={19} color={colors.primary} />
        </View>
        <View style={styles.typeRowBody}>
          <Text style={styles.skinsSheetTitle}>Skins</Text>
          <Text style={styles.typeRowDesc}>Set the stake and rules for this round</Text>
        </View>
      </View>

      <ScrollView style={styles.skinsSheetScroll}>
        <View style={styles.skinsSection}>
          <Text style={styles.fieldLabel}>Stake per hole</Text>
          <View style={styles.stakeRow}>
            <Pressable style={styles.stakeButton} onPress={() => setStake((v) => Math.max(1, v - 1))}>
              <Minus size={18} color={colors.primary} />
            </Pressable>
            <View style={styles.stakeValueWrap}>
              <View style={styles.stakeValueRow}>
                <Text style={styles.stakeValue}>$</Text>
                <TextInput
                  style={styles.stakeValueInput}
                  value={String(stake)}
                  onChangeText={(text) => {
                    const n = parseInt(text.replace(/[^0-9]/g, ''), 10);
                    setStake(Number.isNaN(n) ? 1 : Math.max(1, n));
                  }}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  maxLength={4}
                />
              </View>
              <Text style={styles.stakeValueCaption}>each</Text>
            </View>
            <Pressable style={styles.stakeButton} onPress={() => setStake((v) => v + 1)}>
              <Plus size={18} color={colors.primary} />
            </Pressable>
          </View>
          <View style={styles.presetRow}>
            {STAKE_PRESETS.map((p) => (
              <Pressable key={p} style={[styles.presetChip, stake === p && styles.presetChipSelected]} onPress={() => setStake(p)}>
                <Text style={[styles.presetChipLabel, stake === p && styles.presetChipLabelSelected]}>${p}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.skinsSection}>
          <View style={styles.tieHeaderRow}>
            <Users size={16} color={colors.primary} />
            <Text style={styles.fieldLabel}>On a tied hole</Text>
          </View>
          <View style={styles.row}>
            {TIE_RULE_INFO.map((rule) => {
              const selected = tieRule === rule.id;
              return (
                <Pressable key={rule.id} style={[styles.tieCard, selected && styles.tieCardSelected]} onPress={() => setTieRule(rule.id)}>
                  <Text style={[styles.tieCardTitle, selected && styles.tieCardTitleSelected]}>{rule.title}</Text>
                  <Text style={[styles.tieCardSub, selected && styles.tieCardSubSelected]}>{rule.sub}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.tieNote}>
            <Info size={13} color="#9A6B12" style={styles.noteIcon} />
            <Text style={styles.tieNoteText}>{TIE_RULE_NOTE[tieRule]}</Text>
          </View>
        </View>

        <View style={styles.skinsSection}>
          <Text style={styles.fieldLabel}>Scoring basis</Text>
          <View style={styles.row}>
            <Pressable style={[styles.basisCard, basis === 'gross' && styles.basisCardSelected]} onPress={() => setBasis('gross')}>
              <Text style={[styles.basisCardTitle, basis === 'gross' && styles.basisCardTitleSelected]}>Gross</Text>
              <Text style={styles.basisCardSub}>Raw strokes</Text>
            </Pressable>
            <Pressable style={[styles.basisCard, basis === 'nett' && styles.basisCardSelected]} onPress={() => setBasis('nett')}>
              <Text style={[styles.basisCardTitle, basis === 'nett' && styles.basisCardTitleSelected]}>Nett</Text>
              <Text style={styles.basisCardSub}>After handicap</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.skinsSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.tieHeaderRow}>
              <Users size={16} color={colors.primary} />
              <Text style={styles.fieldLabel}>Who's in</Text>
            </View>
            <View style={styles.individualTag}>
              <Text style={styles.individualTagLabel}>
                {participantIds.length} of {joinedPlayers.length}
              </Text>
            </View>
          </View>
          <View style={styles.whosInList}>
            {joinedPlayers.map((p, i) => {
              const on = participantIds.includes(p.id);
              return (
                <Pressable key={p.id} style={[styles.whosInRow, on && styles.whosInRowSelected]} onPress={() => toggleParticipant(p.id)}>
                  <View style={[styles.whosInAvatar, { backgroundColor: getSolidAvatarColor(i) }]}>
                    <Text style={styles.whosInAvatarLabel}>{p.name[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={styles.typeRowBody}>
                    <Text style={styles.whosInName}>{p.name}</Text>
                    <Text style={styles.whosInMeta}>Play HC {p.playingHandicap}</Text>
                  </View>
                  <View style={[styles.whosInCheck, on && styles.whosInCheckOn]}>{on ? <Check size={13} color={palette.white} /> : null}</View>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.whosInHint}>Tap a player to add or remove them from the skins. Anyone left out still plays the round — they just sit out this side game.</Text>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surfacePage },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: screenGutter,
    paddingTop: screenGutter,
    paddingBottom: spacing[2] + 2,
  },
  headerTitleGroup: { flex: 1, minWidth: 0 },
  headerTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    marginTop: 2,
  },
  extraTag: {
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1,
    borderColor: palette.green[200],
    borderRadius: radius.pill,
    paddingHorizontal: spacing[2] + 3,
    paddingVertical: spacing[1],
    flexShrink: 0,
  },
  extraTagLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    color: colors.primary,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: screenGutter, paddingTop: spacing[1], paddingBottom: spacing[6], gap: spacing[4] },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg - 2,
    padding: spacing[3] + 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  heroIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md - 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBody: { flex: 1, minWidth: 0 },
  heroTitle: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: palette.white,
  },
  heroSubtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  fieldLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.textSecondary,
  },
  fieldCount: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
  },
  sideGamesErrorText: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 12,
    color: colors.statusDanger,
    marginTop: spacing[2],
  },
  addedCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: palette.green[200],
    borderRadius: radius.lg - 2,
    padding: spacing[3] + 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
  },
  addedCardIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceBrandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  addedCardBody: { flex: 1, minWidth: 0 },
  addedCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 3,
  },
  addedCardTitle: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.textPrimary,
  },
  addedCardMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: 2,
  },
  addedCardActions: {
    flexDirection: 'row',
    gap: spacing[1] + 2,
    flexShrink: 0,
  },
  addedCardEdit: {
    width: 34,
    height: 34,
    borderRadius: radius.sm + 1,
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1,
    borderColor: palette.green[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  addedCardDelete: {
    width: 34,
    height: 34,
    borderRadius: radius.sm + 1,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  individualTag: {
    backgroundColor: '#FFF3E9',
    borderWidth: 1,
    borderColor: '#F4C79B',
    borderRadius: radius.pill,
    paddingHorizontal: spacing[2] + 1,
    paddingVertical: 2,
  },
  individualTagLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 10,
    color: '#9A5A1E',
  },
  addButton: {
    height: 52,
    borderWidth: 1.5,
    borderColor: palette.green[200],
    borderStyle: 'dashed',
    backgroundColor: colors.surfaceBrandSoft,
    borderRadius: radius.lg - 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2] + 1,
  },
  addButtonLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: colors.primary,
  },
  addHint: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: spacing[2] + 1,
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2] + 1,
    padding: spacing[3] - 1,
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1,
    borderColor: palette.green[200],
    borderRadius: radius.md,
  },
  noteIcon: { marginTop: 1 },
  noteText: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  footer: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[2] + 2,
    paddingBottom: spacing[4],
    backgroundColor: colors.surfacePage,
  },
  saveContinueButton: {
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2] + 1,
  },
  saveContinueLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 17,
    color: palette.white,
  },
  skipLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: colors.textDisabled,
    textAlign: 'center',
    marginTop: spacing[3],
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.lg - 3,
    padding: spacing[3] - 1,
    marginBottom: spacing[2] + 2,
  },
  typeRowDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.lg - 3,
    padding: spacing[3] - 1,
    marginBottom: spacing[2] + 2,
    opacity: 0.45,
  },
  typeRowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md - 1,
    backgroundColor: colors.surfaceBrandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  typeRowIconDisabled: {
    width: 40,
    height: 40,
    borderRadius: radius.md - 1,
    backgroundColor: palette.soon.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  typeRowBody: { flex: 1, minWidth: 0 },
  typeRowNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
  },
  typeRowName: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.textPrimary,
  },
  typeRowDesc: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    marginTop: 1,
    lineHeight: 16,
  },
  soonTag: {
    backgroundColor: palette.soon.surface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.pill,
    paddingHorizontal: spacing[2] - 1,
    paddingVertical: 2,
  },
  soonTagLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 9,
    letterSpacing: 0.6,
    color: colors.textDisabled,
    textTransform: 'uppercase',
  },
  skinsSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
    marginBottom: spacing[3],
  },
  skinsSheetBack: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.soon.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skinsSheetTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 19,
    color: colors.textPrimary,
  },
  skinsSheetScroll: {
    maxHeight: 420,
  },
  skinsSection: {
    marginBottom: spacing[4],
  },
  stakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4] - 2,
  },
  stakeButton: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1.5,
    borderColor: palette.green[200],
    alignItems: 'center',
    justifyContent: 'center',
    // Without this, the stake TextInput's browser-default intrinsic width
    // (react-native-web renders it as a real <input>) can demand more room
    // than the row has, and flexbox shrinks these fixed-size buttons down
    // to make space instead — collapsing them under the number.
    flexShrink: 0,
  },
  stakeValueWrap: {
    flex: 1,
    alignItems: 'center',
  },
  stakeValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stakeValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 34,
    color: colors.textPrimary,
    lineHeight: 36,
  },
  stakeValueInput: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 34,
    color: colors.textPrimary,
    lineHeight: 36,
    width: 76,
    textAlign: 'center',
    padding: 0,
    margin: 0,
    borderWidth: 0,
  },
  stakeValueCaption: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: 2,
  },
  presetRow: {
    flexDirection: 'row',
    gap: spacing[1] + 2,
    marginTop: spacing[2] + 3,
  },
  presetChip: {
    flex: 1,
    height: 34,
    borderRadius: radius.sm + 1,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    backgroundColor: colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipSelected: {
    backgroundColor: colors.surfaceBrandSoft,
    borderColor: colors.primary,
  },
  presetChipLabel: {
    fontFamily: getFontFamily('numeric', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.textDisabled,
  },
  presetChipLabelSelected: {
    color: colors.primary,
  },
  tieHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  row: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  tieCard: {
    flex: 1,
    borderRadius: radius.md - 1,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2] + 1,
  },
  tieCardSelected: {
    backgroundColor: colors.surfaceBrandSoft,
    borderColor: colors.primary,
  },
  tieCardTitle: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 13,
    color: colors.textDisabled,
  },
  tieCardTitleSelected: {
    color: colors.primary,
  },
  tieCardSub: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 9,
    color: palette.soon.labelUpcoming,
    marginTop: 1,
    textAlign: 'center',
  },
  tieCardSubSelected: {
    color: colors.textSecondary,
  },
  tieNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[1] + 2,
    marginTop: spacing[2] + 1,
    padding: spacing[2] + 2,
    backgroundColor: '#FBEFD0',
    borderWidth: 1,
    borderColor: '#E5CE8E',
    borderRadius: radius.sm + 2,
  },
  tieNoteText: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: '#7A5A17',
    lineHeight: 16,
  },
  basisCard: {
    flex: 1,
    borderRadius: radius.md - 1,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2] + 3,
  },
  basisCardSelected: {
    backgroundColor: colors.surfaceBrandSoft,
    borderColor: colors.primary,
  },
  basisCardTitle: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: colors.textDisabled,
  },
  basisCardTitleSelected: {
    color: colors.primary,
  },
  basisCardSub: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    color: palette.soon.labelUpcoming,
    marginTop: 1,
  },
  whosInList: {
    gap: spacing[1] + 2,
    marginTop: spacing[1],
  },
  whosInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 2,
    padding: spacing[2] + 1,
    borderRadius: radius.md - 1,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    backgroundColor: colors.surfaceCard,
  },
  whosInRowSelected: {
    borderColor: palette.green[200],
    backgroundColor: colors.surfaceBrandSoft,
  },
  whosInAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whosInAvatarLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 12,
    color: palette.white,
  },
  whosInName: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.textPrimary,
  },
  whosInMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
  },
  whosInCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: palette.soon.radioOff,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whosInCheckOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  whosInHint: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: spacing[2] + 1,
    lineHeight: 15,
  },
  addToRoundButton: {
    height: 54,
    marginTop: spacing[3] + 1,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2] + 1,
  },
  addToRoundButtonLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 16,
    color: palette.white,
  },
});
