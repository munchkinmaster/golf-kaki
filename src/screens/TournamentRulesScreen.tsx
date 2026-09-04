import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowRight, CircleSlash, GitCompare, Handshake, Info, ShieldCheck, Target } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { STABLEFORD_POINT_CHIPS } from '../components/System36RuleCards';
import { TournamentLockedNotice } from '../components/TournamentLockedNotice';
import { TournamentWizardHeader } from '../components/TournamentWizardHeader';
import type { StandingsBasis, TieBreakRule } from '../state/TournamentDraftContext';
import type { TournamentStackParamList } from '../navigation/types';
import { useTournamentDraft } from '../state/TournamentDraftContext';
import { colors, getFontFamily, palette, radius, screenGutter, spacing } from '../theme/tokens';

/** SB3's points table needs 6 chips on one row (vs. the format screen's 3-per-row grid), so labels are abbreviated to fit — same values/colors as STABLEFORD_POINT_CHIPS, just shorter text for this dense layout. */
const SB_SHORT_LABEL: Record<string, string> = {
  Albatross: 'Alba',
  Eagle: 'Eagle',
  Birdie: 'Birdie',
  Par: 'Par',
  Bogey: 'Bogey',
  'Double+': 'Dbl+',
};

type Props = NativeStackScreenProps<TournamentStackParamList, 'TournamentRules'>;

const STANDINGS_OPTIONS: { id: StandingsBasis; label: string; caption: string }[] = [
  { id: 'nett', label: 'Nett', caption: 'Handicap-adjusted' },
  { id: 'gross', label: 'Gross', caption: 'Raw strokes' },
  { id: 'both', label: 'Both', caption: 'Two winners' },
];

/** SY3 points table — the 2/1/0 gross chips that derive the System 36 handicap (par/bogey/double only; the full Stableford range lives on the SY1/SY6 rule cards). */
const S36_POINT_CHIPS: { value: string; label: string; chip: (typeof palette.scoreChip)[keyof typeof palette.scoreChip] }[] = [
  { value: '2', label: 'Par or better', chip: palette.scoreChip.par },
  { value: '1', label: 'Bogey', chip: palette.scoreChip.bogey },
  { value: '0', label: 'Double+', chip: palette.scoreChip.double },
];

const TIE_BREAK_INFO: { id: TieBreakRule; icon: typeof GitCompare; name: string; description: string }[] = [
  {
    id: 'countback',
    icon: GitCompare,
    name: 'Countback',
    description:
      "Compares the tied players' scores over the last 9 holes. Still level? It steps down to the last 6, then last 3, then the 18th hole. The lowest score wins — no shared trophy.",
  },
  {
    id: 'shared_place',
    icon: Handshake,
    name: 'Shared place',
    description: 'Tied players share the position and split any prize equally. The next place is skipped — two players tied for 1st means no outright 2nd.',
  },
];

export function TournamentRulesScreen({ navigation }: Props) {
  const { draft, update } = useTournamentDraft();
  const [infoOpen, setInfoOpen] = useState(false);
  const locked = draft.tournamentId !== null;
  const isSystem36 = draft.format === 'system_36';
  const isStableford = draft.format === 'stableford';
  /** Both points-ranked formats share the same countback description ("most points", not "compare nett") — see SB3/SY3. */
  const ranksByPoints = isSystem36 || isStableford;

  // The tie-break selector is the one control all three formats share —
  // System 36 and Stableford still let the host pick countback vs. shared
  // place (see SY3/SB3), they just replace stroke play's standings-basis +
  // handicap-allowance controls with their own points-table explainer above
  // it (Stableford keeps the handicap-allowance slider too, since unlike
  // System 36 it uses an ordinary upfront Playing Handicap — see SB3).
  const tieBreakSection = (
    <View>
      <View style={styles.labelWithInfoRow}>
        <Text style={styles.fieldLabel}>Tie-break</Text>
        <Info size={14} color={colors.primary} onPress={() => setInfoOpen(true)} />
      </View>
      <View style={styles.cardStack}>
        {TIE_BREAK_INFO.map((rule) => {
          const selected = draft.tieBreakRule === rule.id;
          const Icon = rule.icon;
          return (
            <Pressable
              key={rule.id}
              style={[styles.tieBreakCard, selected && styles.tieBreakCardSelected]}
              onPress={() => update({ tieBreakRule: rule.id })}
            >
              <View style={[styles.tieBreakIcon, selected && styles.tieBreakIconSelected]}>
                <Icon size={18} color={selected ? palette.white : colors.textSecondary} />
              </View>
              <View style={styles.tieBreakBody}>
                <Text style={[styles.tieBreakName, selected && styles.tieBreakNameSelected]}>{rule.name}</Text>
                <Text style={styles.tieBreakDesc}>
                  {rule.id !== 'countback'
                    ? 'Ties split the position'
                    : ranksByPoints
                      ? 'Most points over last 9, 6, 3, then 18th'
                      : 'Compare last 9, 6, 3, then 18th hole'}
                </Text>
              </View>
              {selected ? <View style={styles.tieBreakCheck} /> : <View style={styles.tieBreakRadioOff} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <TournamentWizardHeader step="rules" onBack={() => navigation.goBack()} />

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {locked ? <TournamentLockedNotice /> : null}
          <View pointerEvents={locked ? 'none' : 'auto'} style={[styles.lockableGroup, locked && styles.lockedContent]}>
          {isSystem36 ? (
            <>
              <Text style={styles.s36Subtitle}>{draft.name} · System 36 · Individual</Text>

              <View>
                <Text style={styles.fieldLabel}>Points table</Text>
                <View style={styles.s36PointsCard}>
                  <View style={styles.s36PointsHeader}>
                    <Text style={styles.s36PointsHeaderTitle}>Standard System 36</Text>
                    <View style={styles.selectedTag}>
                      <Text style={styles.selectedTagLabel}>Selected</Text>
                    </View>
                  </View>
                  <View style={styles.s36PointsBody}>
                    {S36_POINT_CHIPS.map((c) => (
                      <View key={c.label} style={[styles.s36Chip, { backgroundColor: c.chip.fill, borderColor: c.chip.border }]}>
                        <Text style={[styles.s36ChipValue, { color: c.chip.text }]}>{c.value}</Text>
                        <Text style={styles.s36ChipLabel}>{c.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <Text style={styles.s36PointsNote}>Scored off your gross, no strokes applied — these points set your handicap, not the final result.</Text>
              </View>

              <Card variant="inverse" watermark watermarkSize={110} padding={spacing[4]} style={styles.s36Hero}>
                <View style={styles.s36HeroStep}>
                  <View style={styles.s36HeroBadge}>
                    <Text style={styles.s36HeroBadgeText}>1</Text>
                  </View>
                  <View style={styles.s36HeroStepBody}>
                    <Text style={styles.s36HeroOverline}>Sets your handicap</Text>
                    <View style={styles.s36HeroFormula}>
                      <Text style={styles.s36HeroFormulaNum}>36</Text>
                      <Text style={styles.s36HeroFormulaOp}>−</Text>
                      <Text style={styles.s36HeroFormulaWord}>points</Text>
                      <Text style={styles.s36HeroFormulaOp}>=</Text>
                      <Text style={styles.s36HeroFormulaAccent}>handicap</Text>
                    </View>
                    <Text style={styles.s36HeroStepText}>
                      e.g. <Text style={styles.s36HeroStepStrong}>24 pts → HCP 12</Text>. You then play off 12.
                    </Text>
                  </View>
                </View>
                <View style={styles.s36HeroDivider} />
                <View style={styles.s36HeroStep}>
                  <View style={styles.s36HeroBadge}>
                    <Text style={styles.s36HeroBadgeText}>2</Text>
                  </View>
                  <View style={styles.s36HeroStepBody}>
                    <Text style={styles.s36HeroOverline}>Decides the win</Text>
                    <Text style={styles.s36HeroWinTitle}>Most Stableford points wins</Text>
                    <Text style={styles.s36HeroStepText}>Points scored off your System 36 handicap.</Text>
                  </View>
                </View>
              </Card>

              {tieBreakSection}
            </>
          ) : isStableford ? (
            <>
              <Text style={styles.s36Subtitle}>{draft.name} · Stableford · Individual</Text>

              <View>
                <Text style={styles.fieldLabel}>Points table</Text>
                <View style={styles.s36PointsCard}>
                  <View style={styles.s36PointsHeader}>
                    <Text style={styles.s36PointsHeaderTitle}>Standard</Text>
                    <View style={styles.selectedTag}>
                      <Text style={styles.selectedTagLabel}>Selected</Text>
                    </View>
                  </View>
                  <View style={styles.sbPointsBody}>
                    {STABLEFORD_POINT_CHIPS.map((c) => (
                      <View key={c.label} style={[styles.sbChip, { backgroundColor: c.chip.fill, borderColor: c.chip.border }]}>
                        <Text style={[styles.sbChipValue, { color: c.chip.text }]}>{c.value}</Text>
                        <Text style={styles.sbChipLabel}>{SB_SHORT_LABEL[c.label] ?? c.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <Text style={styles.s36PointsNote}>Points are worked out against your nett score on each hole.</Text>
              </View>

              <View>
                <View style={styles.allowanceHeaderRow}>
                  <Text style={styles.fieldLabel}>Handicap allowance</Text>
                  <Text style={styles.allowanceValue}>{draft.handicapAllowancePct}%</Text>
                </View>
                <HandicapAllowanceSlider value={draft.handicapAllowancePct} onChange={(pct) => update({ handicapAllowancePct: pct })} />
                <View style={styles.allowanceCaptionRow}>
                  <Text style={styles.allowanceCaption}>Scratch (0%)</Text>
                  <Text style={styles.allowanceCaption}>Full (100%)</Text>
                </View>
              </View>

              <View style={styles.sbTargetCard}>
                <View style={styles.sbTargetIcon}>
                  <Target size={18} color={colors.primary} />
                </View>
                <View style={styles.sbTargetBody}>
                  <Text style={styles.sbTargetTitle}>Playing to handicap = 36 pts</Text>
                  <Text style={styles.sbTargetCaption}>2 points a hole across 18 holes</Text>
                </View>
              </View>

              {tieBreakSection}
            </>
          ) : (
            <>
              <View>
                <Text style={styles.fieldLabel}>Rank standings by</Text>
                <View style={styles.row}>
                  {STANDINGS_OPTIONS.map((opt) => {
                    const selected = draft.standingsBasis === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        style={[styles.standingsOption, selected && styles.standingsOptionSelected]}
                        onPress={() => update({ standingsBasis: opt.id })}
                      >
                        <Text style={[styles.standingsOptionLabel, selected && styles.standingsOptionLabelSelected]}>{opt.label}</Text>
                        <Text style={[styles.standingsOptionCaption, selected && styles.standingsOptionCaptionSelected]}>{opt.caption}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View>
                <View style={styles.allowanceHeaderRow}>
                  <Text style={styles.fieldLabel}>Handicap allowance</Text>
                  <Text style={styles.allowanceValue}>{draft.handicapAllowancePct}%</Text>
                </View>
                <HandicapAllowanceSlider value={draft.handicapAllowancePct} onChange={(pct) => update({ handicapAllowancePct: pct })} />
                <View style={styles.allowanceCaptionRow}>
                  <Text style={styles.allowanceCaption}>Scratch (0%)</Text>
                  <Text style={styles.allowanceCaption}>Full (100%)</Text>
                </View>
              </View>

              {tieBreakSection}

              <View style={styles.soonGroup}>
                <View style={styles.soonRow}>
                  <View style={styles.soonRowLeft}>
                    <ShieldCheck size={16} color={colors.textSecondary} />
                    <View style={styles.soonRowText}>
                      <View style={styles.soonRowTitleRow}>
                        <Text style={styles.soonRowTitle}>Attest scores</Text>
                        <SoonTag />
                      </View>
                      <Text style={styles.soonRowDesc}>Playing partner confirms each card</Text>
                    </View>
                  </View>
                  <ToggleOff />
                </View>
                <View style={styles.soonRow}>
                  <View style={styles.soonRowLeft}>
                    <CircleSlash size={16} color={colors.textSecondary} />
                    <View style={styles.soonRowText}>
                      <View style={styles.soonRowTitleRow}>
                        <Text style={styles.soonRowTitle}>Max score per hole</Text>
                        <SoonTag />
                      </View>
                      <Text style={styles.soonRowDesc}>Cap blow-up holes (net double bogey)</Text>
                    </View>
                  </View>
                  <ToggleOff />
                </View>
              </View>
            </>
          )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label="Continue"
            variant="accent"
            size="lg"
            block
            onPress={() => navigation.navigate('TournamentPlayers')}
            icon={<ArrowRight size={19} color={colors.textOnAccent} />}
            iconPosition="right"
          />
        </View>
      </SafeAreaView>

      <BottomSheet visible={infoOpen} onClose={() => setInfoOpen(false)} title="Tie-breaks explained" subtitle="How a level score is settled.">
        {TIE_BREAK_INFO.map((rule) => (
          <TieBreakInfoRow key={rule.id} rule={rule} selected={draft.tieBreakRule === rule.id} />
        ))}
      </BottomSheet>
    </View>
  );
}

const SLIDER_THUMB_SIZE = 22;

function HandicapAllowanceSlider({ value, onChange }: { value: number; onChange: (pct: number) => void }) {
  const trackWidthRef = useRef(0);
  const startPctRef = useRef(value);

  function clampPct(pct: number): number {
    return Math.min(100, Math.max(0, Math.round(pct)));
  }

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const width = trackWidthRef.current;
        if (width <= 0) return;
        const pct = clampPct((evt.nativeEvent.locationX / width) * 100);
        startPctRef.current = pct;
        onChange(pct);
      },
      onPanResponderMove: (_evt, gesture) => {
        const width = trackWidthRef.current;
        if (width <= 0) return;
        onChange(clampPct(startPctRef.current + (gesture.dx / width) * 100));
      },
    }),
  ).current;

  function handleLayout(e: LayoutChangeEvent) {
    trackWidthRef.current = e.nativeEvent.layout.width;
  }

  return (
    <View style={styles.sliderTrack} onLayout={handleLayout} {...responder.panHandlers}>
      <View style={[styles.sliderFill, { width: `${value}%` }]} />
      <View style={[styles.sliderThumb, { left: `${value}%`, marginLeft: -SLIDER_THUMB_SIZE / 2 }]} />
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

function ToggleOff() {
  return (
    <View style={styles.toggleTrack}>
      <View style={styles.toggleThumb} />
    </View>
  );
}

function TieBreakInfoRow({ rule, selected }: { rule: (typeof TIE_BREAK_INFO)[number]; selected: boolean }) {
  const Icon = rule.icon;
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoRowIcon, selected && styles.infoRowIconSelected]}>
        <Icon size={19} color={selected ? colors.primary : colors.textSecondary} />
      </View>
      <View style={styles.infoRowBody}>
        <View style={styles.infoRowNameRow}>
          <Text style={styles.infoRowName}>{rule.name}</Text>
          {selected ? (
            <View style={styles.selectedTag}>
              <Text style={styles.selectedTagLabel}>Selected</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.infoRowDesc}>{rule.description}</Text>
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
  s36Subtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textMuted,
  },
  s36PointsCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  s36PointsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4] - 1,
    paddingVertical: spacing[3] - 1,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  s36PointsHeaderTitle: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 13,
    color: colors.textPrimary,
  },
  s36PointsBody: {
    flexDirection: 'row',
    gap: spacing[2],
    padding: spacing[3] + 1,
  },
  s36Chip: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: radius.sm + 2,
    paddingVertical: spacing[2] + 1,
    alignItems: 'center',
  },
  s36ChipValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 22,
  },
  s36ChipLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  s36PointsNote: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15,
    marginTop: spacing[2] - 1,
  },
  // ---- Stableford (SB3) — points table is 6 chips on one row (vs. System
  // 36's 3), and a target callout replaces S36's two-step hero card.
  sbPointsBody: {
    flexDirection: 'row',
    gap: spacing[1] + 1,
    padding: spacing[3] + 1,
  },
  sbChip: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: radius.sm,
    paddingVertical: spacing[2],
    alignItems: 'center',
  },
  sbChipValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 17,
    lineHeight: 19,
  },
  sbChipLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sbTargetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.lg - 2,
    padding: spacing[3],
  },
  sbTargetIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceBrandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sbTargetBody: {
    flex: 1,
    minWidth: 0,
  },
  sbTargetTitle: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: colors.textPrimary,
  },
  sbTargetCaption: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  s36Hero: {
    gap: spacing[3],
  },
  s36HeroStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2] + 2,
  },
  s36HeroBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.orange[300],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  s36HeroBadgeText: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 11,
    color: colors.primary,
  },
  s36HeroStepBody: {
    flex: 1,
    minWidth: 0,
  },
  s36HeroOverline: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.orange[300],
  },
  s36HeroFormula: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: spacing[2] - 1,
    marginTop: spacing[2] - 1,
  },
  s36HeroFormulaNum: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 24,
    color: colors.textInverse,
  },
  s36HeroFormulaOp: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 17,
    color: 'rgba(255,255,255,0.7)',
  },
  s36HeroFormulaWord: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.textInverse,
  },
  s36HeroFormulaAccent: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: palette.orange[300],
  },
  s36HeroStepText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 16,
    marginTop: spacing[2] - 1,
  },
  s36HeroStepStrong: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    color: colors.textInverse,
  },
  s36HeroWinTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 18,
    color: colors.textInverse,
    marginTop: spacing[2] - 1,
  },
  s36HeroDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  fieldLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing[2] - 1,
  },
  row: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  standingsOption: {
    flex: 1,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  standingsOptionSelected: {
    backgroundColor: colors.surfaceBrandSoft,
    borderColor: colors.primary,
  },
  standingsOptionLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: colors.textDisabled,
  },
  standingsOptionLabelSelected: {
    color: colors.primary,
  },
  standingsOptionCaption: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    color: palette.soon.labelUpcoming,
  },
  standingsOptionCaptionSelected: {
    color: colors.textSecondary,
  },
  allowanceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2] - 1,
  },
  allowanceValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.primary,
  },
  sliderTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.borderDefault,
    justifyContent: 'center',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  sliderThumb: {
    position: 'absolute',
    width: SLIDER_THUMB_SIZE,
    height: SLIDER_THUMB_SIZE,
    borderRadius: SLIDER_THUMB_SIZE / 2,
    backgroundColor: colors.surfaceCard,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  allowanceCaptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[1] + 2,
  },
  allowanceCaption: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    color: palette.soon.labelUpcoming,
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
  tieBreakCard: {
    borderRadius: radius.lg - 2,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    backgroundColor: colors.surfaceCard,
    padding: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  tieBreakCardSelected: {
    backgroundColor: colors.surfaceBrandSoft,
    borderColor: colors.primary,
  },
  tieBreakIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md - 1,
    backgroundColor: palette.soon.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tieBreakIconSelected: {
    backgroundColor: colors.primary,
  },
  tieBreakBody: {
    flex: 1,
    minWidth: 0,
  },
  tieBreakName: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.textPrimary,
  },
  tieBreakNameSelected: {
    color: colors.primary,
  },
  tieBreakDesc: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  tieBreakCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  tieBreakRadioOff: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: palette.soon.radioOff,
  },
  soonGroup: {
    gap: spacing[2],
    opacity: 0.45,
  },
  soonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[3] - 1,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.md,
  },
  soonRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
    flex: 1,
    minWidth: 0,
  },
  soonRowText: {
    flex: 1,
    minWidth: 0,
  },
  soonRowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
  },
  soonRowTitle: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.textPrimary,
  },
  soonRowDesc: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
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
  toggleTrack: {
    width: 42,
    height: 25,
    borderRadius: radius.pill,
    backgroundColor: palette.soon.radioOff,
    justifyContent: 'center',
    flexShrink: 0,
  },
  toggleThumb: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: palette.white,
    marginLeft: 3,
  },
  footer: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[3],
    paddingBottom: spacing[5],
    backgroundColor: colors.surfacePage,
  },
  continueStub: {
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  continueStubText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    textAlign: 'center',
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
