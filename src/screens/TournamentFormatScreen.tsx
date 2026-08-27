import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowRight, Calculator, Circle, CircleCheckBig, Hash, Info, ListChecks, Sparkles, User, Users } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { StablefordPointsCard } from '../components/StablefordPointsCard';
import { System36RuleCards } from '../components/System36RuleCards';
import { TournamentLockedNotice } from '../components/TournamentLockedNotice';
import { TournamentWizardHeader } from '../components/TournamentWizardHeader';
import type { TournamentStackParamList } from '../navigation/types';
import type { TournamentFormat } from '../state/TournamentDraftContext';
import { useTournamentDraft } from '../state/TournamentDraftContext';
import { colors, getFontFamily, palette, radius, screenGutter, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<TournamentStackParamList, 'TournamentFormat'>;

/**
 * The three scoring formats on S1/SY1/SB1, in display order. All three are
 * buildable now that design_handoff_stableford_flow/README.md scoped
 * Stableford's flow. `description` copy matches the SY1/SB1 format-card
 * mocks verbatim.
 */
const FORMAT_CARDS: { format: TournamentFormat; icon: typeof Hash; name: string; description: string; selectable: boolean }[] = [
  { format: 'stroke_play', icon: Hash, name: 'Stroke play (medal)', description: 'Count every stroke — lowest total wins', selectable: true },
  { format: 'stableford', icon: ListChecks, name: 'Stableford', description: 'Points per hole — best total wins', selectable: true },
  { format: 'system_36', icon: Calculator, name: 'System 36', description: 'Handicap worked out from the round itself', selectable: true },
];

const FORMAT_INFO: { format: TournamentFormat; icon: typeof Hash; name: string; description: string }[] = [
  {
    format: 'stroke_play',
    icon: Hash,
    name: 'Stroke play (medal)',
    description: 'Count every stroke over the round — the lowest gross (or nett) total wins. The classic tournament format.',
  },
  {
    format: 'stableford',
    icon: ListChecks,
    name: 'Stableford',
    description: 'Points scored per hole against par — birdie 3, par 2, bogey 1. Highest points win, and one bad hole never wrecks your round.',
  },
  {
    format: 'system_36',
    icon: Calculator,
    name: 'System 36',
    description: 'Auto-handicap format — build your handicap as you play, then score to par. Great for mixed-ability groups with no official index.',
  },
];

export function TournamentFormatScreen({ navigation }: Props) {
  const { draft, update } = useTournamentDraft();
  const [infoOpen, setInfoOpen] = useState(false);
  const locked = draft.tournamentId !== null;

  const canContinue = draft.name.trim().length > 0;

  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <TournamentWizardHeader step="format" onBack={() => navigation.goBack()} />

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {locked ? <TournamentLockedNotice /> : null}
          <View pointerEvents={locked ? 'none' : 'auto'} style={[styles.lockableGroup, locked && styles.lockedContent]}>
          <View>
            <Text style={styles.fieldLabel}>Tournament name</Text>
            <TextInput
              value={draft.name}
              onChangeText={(name) => update({ name })}
              placeholder="Weekend Medal"
              placeholderTextColor={colors.textDisabled}
              style={styles.nameInput}
            />
          </View>

          <View>
            <Text style={styles.fieldLabel}>Play as</Text>
            <View style={styles.row}>
              <View style={[styles.playAsOption, styles.playAsOptionSelected]}>
                <User size={17} color={palette.white} />
                <Text style={styles.playAsOptionLabelSelected}>Individual</Text>
              </View>
              <View style={styles.playAsOptionDisabled}>
                <Users size={16} color={palette.soon.labelUpcoming} />
                <Text style={styles.playAsOptionLabelDisabled}>Team</Text>
                <SoonTag />
              </View>
            </View>
            <Text style={styles.helperText}>Everyone plays their own ball. Standings rank each player individually.</Text>
          </View>

          <View>
            <View style={styles.labelWithInfoRow}>
              <Text style={styles.fieldLabel}>Scoring format</Text>
              <Info size={14} color={colors.primary} onPress={() => setInfoOpen(true)} />
            </View>
            <View style={styles.cardStack}>
              {FORMAT_CARDS.map((f) =>
                f.selectable ? (
                  <FormatCard
                    key={f.format}
                    icon={f.icon}
                    name={f.name}
                    description={f.description}
                    selected={draft.format === f.format}
                    onPress={() => update({ format: f.format })}
                  />
                ) : (
                  <DisabledFormatCard key={f.format} icon={f.icon} name={f.name} description={f.description} />
                ),
              )}
            </View>
          </View>

          {draft.format === 'system_36' ? (
            <>
              <View style={styles.s36Callout}>
                <View style={styles.s36CalloutIcon}>
                  <Sparkles size={17} color={palette.white} />
                </View>
                <View style={styles.s36CalloutBody}>
                  <Text style={styles.s36CalloutTitle}>No handicaps to enter</Text>
                  <Text style={styles.s36CalloutText}>Perfect for a mixed group. Everyone’s handicap is worked out from how they play today.</Text>
                </View>
              </View>
              <System36RuleCards />
            </>
          ) : null}

          {draft.format === 'stableford' ? <StablefordPointsCard /> : null}

          <View>
            <Text style={styles.fieldLabel}>Round structure</Text>
            <View style={styles.row}>
              <View style={[styles.structureOption, styles.structureOptionSelected]}>
                <Text style={styles.structureOptionLabelSelected}>Single round</Text>
              </View>
              <View style={styles.structureOptionDisabled}>
                <Text style={styles.structureOptionLabelDisabled}>Multi-round</Text>
              </View>
            </View>
          </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label="Continue"
            variant="accent"
            size="lg"
            block
            disabled={!canContinue}
            onPress={() => navigation.navigate('TournamentCourse')}
            icon={<ArrowRight size={19} color={colors.textOnAccent} />}
            iconPosition="right"
          />
        </View>
      </SafeAreaView>

      <BottomSheet visible={infoOpen} onClose={() => setInfoOpen(false)} title="Scoring formats explained" subtitle="How each format scores your round.">
        {FORMAT_INFO.map((f) => (
          <FormatInfoRow key={f.name} icon={f.icon} name={f.name} description={f.description} selected={draft.format === f.format} />
        ))}
      </BottomSheet>
    </View>
  );
}

function SoonTag() {
  return (
    <View style={styles.soonTag}>
      <Text style={styles.soonTagLabel}>SOON</Text>
    </View>
  );
}

function FormatCard({
  icon: Icon,
  name,
  description,
  selected,
  onPress,
}: {
  icon: typeof Hash;
  name: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.formatCard, selected ? styles.formatCardSelected : styles.formatCardSelectable, pressed && styles.formatCardPressed]}
    >
      <View style={[styles.formatCardIcon, selected && styles.formatCardIconSelected]}>
        <Icon size={18} color={selected ? palette.white : colors.textMuted} />
      </View>
      <View style={styles.formatCardBody}>
        <Text style={selected ? styles.formatCardNameSelected : styles.formatCardName}>{name}</Text>
        <Text style={styles.formatCardDesc}>{description}</Text>
      </View>
      {selected ? <CircleCheckBig size={20} color={colors.primary} /> : <Circle size={20} color={palette.soon.radioOff} />}
    </Pressable>
  );
}

function DisabledFormatCard({ icon: Icon, name, description }: { icon: typeof Hash; name: string; description: string }) {
  return (
    <View style={styles.formatCardDisabled}>
      <View style={styles.formatCardIcon}>
        <Icon size={18} color={colors.textDisabled} />
      </View>
      <View style={styles.formatCardBody}>
        <View style={styles.formatCardNameRow}>
          <Text style={styles.formatCardName}>{name}</Text>
          <SoonTag />
        </View>
        <Text style={styles.formatCardDesc}>{description}</Text>
      </View>
      <View style={styles.formatCardRadioOff} />
    </View>
  );
}

function FormatInfoRow({ icon: Icon, name, description, selected }: { icon: typeof Hash; name: string; description: string; selected: boolean }) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoRowIcon, selected && styles.infoRowIconSelected]}>
        <Icon size={19} color={selected ? colors.primary : colors.textSecondary} />
      </View>
      <View style={styles.infoRowBody}>
        <View style={styles.infoRowNameRow}>
          <Text style={styles.infoRowName}>{name}</Text>
          {selected ? (
            <View style={styles.selectedTag}>
              <Text style={styles.selectedTagLabel}>Selected</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.infoRowDesc}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.surfacePage,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[1],
    paddingBottom: spacing[6],
    gap: spacing[4],
  },
  lockableGroup: {
    gap: spacing[4],
  },
  lockedContent: {
    opacity: 0.5,
  },
  fieldLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing[2] - 1,
  },
  nameInput: {
    height: 50,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4] - 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 15,
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  playAsOption: {
    flex: 1,
    height: 50,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  playAsOptionSelected: {
    backgroundColor: colors.primary,
  },
  playAsOptionLabelSelected: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: palette.white,
  },
  playAsOptionDisabled: {
    flex: 1,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1] + 3,
  },
  playAsOptionLabelDisabled: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: palette.soon.labelUpcoming,
  },
  helperText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    lineHeight: 15,
    marginTop: spacing[1] + 2,
  },
  labelWithInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
    marginBottom: spacing[2] - 1,
  },
  cardStack: {
    gap: spacing[2],
  },
  formatCard: {
    borderRadius: radius.lg - 2,
    borderWidth: 1.5,
    padding: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  formatCardSelected: {
    backgroundColor: colors.surfaceBrandSoft,
    borderColor: colors.primary,
  },
  formatCardSelectable: {
    backgroundColor: colors.surfaceCard,
    borderColor: colors.borderDefault,
  },
  formatCardPressed: {
    transform: [{ scale: 0.985 }],
  },
  s36Callout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3] - 1,
    backgroundColor: palette.settledTile.fill,
    borderWidth: 1.5,
    borderColor: palette.settledTile.border,
    borderRadius: radius.lg - 2,
    padding: spacing[3],
  },
  s36CalloutIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md - 1,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  s36CalloutBody: {
    flex: 1,
    minWidth: 0,
  },
  s36CalloutTitle: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 13,
    color: palette.settledTile.label,
  },
  s36CalloutText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: palette.settledTile.captionText,
    lineHeight: 16,
    marginTop: 2,
  },
  formatCardDisabled: {
    borderRadius: radius.lg - 2,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    backgroundColor: colors.surfaceCard,
    padding: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    opacity: 0.45,
  },
  formatCardIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md - 1,
    backgroundColor: palette.soon.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatCardIconSelected: {
    backgroundColor: colors.primary,
  },
  formatCardBody: {
    flex: 1,
    minWidth: 0,
  },
  formatCardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
  },
  formatCardName: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.textPrimary,
  },
  formatCardNameSelected: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.primary,
  },
  formatCardDesc: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  formatCardRadioOff: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: palette.soon.radioOff,
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
  structureOption: {
    flex: 1,
    height: 46,
    borderRadius: radius.md - 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  structureOptionSelected: {
    backgroundColor: colors.primary,
  },
  structureOptionLabelSelected: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: palette.white,
  },
  structureOptionDisabled: {
    flex: 1,
    height: 46,
    borderRadius: radius.md - 1,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  structureOptionLabelDisabled: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: palette.soon.labelUpcoming,
  },
  footer: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[3],
    paddingBottom: spacing[5],
    backgroundColor: colors.surfacePage,
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing[3] + 1,
  },
  infoRowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: palette.soon.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRowIconSelected: {
    backgroundColor: colors.surfaceBrandSoft,
  },
  infoRowBody: {
    flex: 1,
    minWidth: 0,
  },
  infoRowNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  infoRowName: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.textPrimary,
  },
  infoRowDesc: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginTop: 3,
  },
  selectedTag: {
    backgroundColor: palette.green[100],
    borderRadius: radius.pill,
    paddingHorizontal: spacing[2] + 1,
    paddingVertical: 2,
  },
  selectedTagLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 10,
    color: palette.green[600],
  },
});
