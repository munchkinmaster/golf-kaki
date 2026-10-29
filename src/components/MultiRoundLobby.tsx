import { Check, ChevronDown, ChevronRight, Clock, Flag, Pencil } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TeeColor } from '../data/courses';
import { teePresentation } from '../data/tees';
import { colors, getFontFamily, getSolidAvatarColor, palette, radius, shadows, spacing } from '../theme/tokens';

/**
 * Building blocks for the multi-round tournament lobby
 * (design_handoff_multi_round MR6a / MR6 / MR6b) — composed by
 * TournamentLobbyScreen when the tournament has more than one round.
 */

/** "Tasik Puteri Golf & Country Club" → "Tasik Puteri" — the header timeline's short labels ("R1 · Orchid"). */
export function shortCourseName(name: string): string {
  const short = name.replace(/(\s+(&|Golf|Country|Club|CC|C\.C\.|G&CC|Resort))+$/i, '').trim();
  return short.length > 0 ? short : name;
}

/** 'next' = MR6's between-rounds "R2 · next": dim bar, bright label. */
export type TimelineSegment = { label: string; state: 'done' | 'live' | 'current' | 'next' | 'upcoming' };

/** The 3-segment (one per round) progress rail under the lobby header title. */
export function RoundTimeline({ segments }: { segments: TimelineSegment[] }) {
  return (
    <View style={styles.timeline}>
      <View style={styles.timelineRow}>
        {segments.map((s, i) => (
          <View key={i} style={[styles.timelineBar, { backgroundColor: TIMELINE_FILL[s.state] }]} />
        ))}
      </View>
      <View style={styles.timelineRow}>
        {segments.map((s, i) => (
          <Text key={i} numberOfLines={1} style={[styles.timelineLabel, s.state !== 'upcoming' && styles.timelineLabelActive]}>
            {s.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const TIMELINE_FILL: Record<TimelineSegment['state'], string> = {
  done: palette.multiRound.timeline.done,
  live: colors.accent,
  current: palette.multiRound.timeline.current,
  next: palette.multiRound.timeline.upcoming,
  upcoming: palette.multiRound.timeline.upcoming,
};

/** Header status chip — "R1 today" (clock), "R2 · THRU 6" (live dot), "R1 of 3" (check). */
export function LobbyStatusPill({ kind, label }: { kind: 'upcoming' | 'live' | 'done'; label: string }) {
  return (
    <View style={styles.statusPill}>
      {kind === 'live' ? <View style={styles.liveDot} /> : kind === 'upcoming' ? <Clock size={12} color={palette.multiRound.timeline.clock} /> : <Check size={12} color={palette.multiRound.timeline.clock} />}
      <Text style={[styles.statusPillLabel, kind === 'live' && styles.statusPillLabelLive]}>{label}</Text>
    </View>
  );
}

export type RoundCardVariant = 'done' | 'ready' | 'live' | 'notSetUp' | 'planned' | 'future';

type RoundCardProps = {
  variant: RoundCardVariant;
  index: number;
  title: string;
  /** Up to two muted lines under the title. */
  lines: string[];
  onPress?: () => void;
  /** Organiser-only edit affordance (MR6 "Not set up" → MR11). */
  onEdit?: () => void;
};

const PILL: Partial<Record<RoundCardVariant, string>> = { ready: 'Ready', live: 'Live', notSetUp: 'Not set up', planned: 'Planned' };

/** One row of the lobby's ROUNDS list. */
export function RoundCard({ variant, index, title, lines, onPress, onEdit }: RoundCardProps) {
  const pill = PILL[variant];
  return (
    <Pressable
      disabled={!onPress && !onEdit}
      onPress={onPress ?? onEdit}
      style={[styles.roundCard, variant === 'ready' || variant === 'notSetUp' ? styles.roundCardSelected : null, variant === 'live' && styles.roundCardLive, variant === 'future' && styles.roundCardFuture]}
    >
      <RoundBadge variant={variant} index={index} />
      <View style={styles.roundBody}>
        <View style={styles.roundTitleRow}>
          <Text style={styles.roundTitle}>{title}</Text>
          {pill ? <Text style={[styles.roundPill, ROUND_PILL_STYLE[variant]]}>{pill}</Text> : null}
        </View>
        {lines.map((line, i) => (
          <Text key={i} style={styles.roundLine}>
            {line}
          </Text>
        ))}
      </View>
      {onEdit ? <Pencil size={15} color={colors.textDisabled} /> : onPress ? <ChevronRight size={16} color={palette.soon.labelUpcoming} /> : null}
    </Pressable>
  );
}

function RoundBadge({ variant, index }: { variant: RoundCardVariant; index: number }) {
  if (variant === 'done') {
    return (
      <View style={[styles.badge, styles.badgeDone]}>
        <Check size={16} color={palette.white} />
      </View>
    );
  }
  if (variant === 'ready' || variant === 'live') {
    return (
      <View style={[styles.badge, styles.badgeActive]}>
        <Flag size={16} color={palette.white} />
      </View>
    );
  }
  return (
    <View style={[styles.badge, variant === 'future' ? styles.badgeFuture : styles.badgeNumbered]}>
      <Text style={[styles.badgeNumber, variant === 'future' && styles.badgeNumberFuture]}>{index}</Text>
    </View>
  );
}

export type LobbyPlayerState = 'seated' | 'pending' | 'dns';

type MultiRoundPlayerRowProps = {
  name: string;
  handicapIndex: number | null;
  isHost: boolean;
  isViewer: boolean;
  state: LobbyPlayerState;
  colorIndex: number;
  courseId: string | null;
  teeColor: TeeColor;
  rating: { courseRating: number; slopeRating: number } | undefined;
  playingHandicap: number;
  handicapOverride: boolean;
  editable: boolean;
  onOpenTee: () => void;
  onOpenHandicap: () => void;
};

/** MR6a/MR6b player row — tee chip with CR / Slope beneath, and the Play HC box. Pending (invited) and DNS rows drop both for a muted placeholder. */
export function MultiRoundPlayerRow(props: MultiRoundPlayerRowProps) {
  const { name, handicapIndex, isHost, isViewer, state, colorIndex, courseId, teeColor, rating, playingHandicap, handicapOverride, editable } = props;
  const initial = name[0]?.toUpperCase() ?? '?';
  const meta = [`HCP ${handicapIndex ?? '—'}`, isHost ? 'Host' : null].filter(Boolean).join(' · ');

  if (state !== 'seated') {
    return (
      <View style={[styles.playerRow, styles.playerRowMuted]}>
        <View style={[styles.avatar, styles.avatarMuted]}>
          <Text style={[styles.avatarLabel, styles.avatarLabelMuted]}>{initial}</Text>
        </View>
        <View style={styles.playerInfo}>
          <View style={styles.playerNameRow}>
            <Text style={[styles.playerName, styles.playerNameMuted]} numberOfLines={1}>
              {name}
            </Text>
            {state === 'pending' ? <Text style={styles.invitedTag}>Invited</Text> : null}
          </View>
          <Text style={styles.playerMetaMuted}>{state === 'pending' ? 'Tee & HC set when they join' : 'Not playing this round'}</Text>
        </View>
        {state === 'pending' ? (
          <View style={styles.hcColumn}>
            <View style={[styles.hcTile, styles.hcTilePending]}>
              <Text style={[styles.hcValue, styles.hcValuePending]}>—</Text>
            </View>
            <Text style={[styles.hcLabel, styles.hcLabelPending]}>Pending</Text>
          </View>
        ) : (
          <Text style={[styles.roundPill, ROUND_PILL_STYLE.notSetUp]}>DNS</Text>
        )}
      </View>
    );
  }

  const tee = teePresentation(courseId, teeColor);
  return (
    <View style={[styles.playerRow, isViewer && styles.playerRowViewer]}>
      <View style={[styles.avatar, { backgroundColor: getSolidAvatarColor(colorIndex) }]}>
        <Text style={styles.avatarLabel}>{initial}</Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={[styles.playerName, isViewer && styles.playerNameViewer]} numberOfLines={1}>
          {name}
          {isViewer ? ' (you)' : ''}
        </Text>
        <Text style={styles.playerMeta}>{meta}</Text>
      </View>
      <View style={styles.teeColumn}>
        <Pressable style={styles.teeChip} onPress={props.onOpenTee} disabled={!editable} accessibilityLabel={`${name}'s tee`}>
          <View style={[styles.teeDot, { backgroundColor: tee.dot }, tee.dotBorder ? { borderWidth: 1, borderColor: tee.dotBorder } : null]} />
          <Text style={styles.teeLabel}>{tee.label}</Text>
          {editable ? <ChevronDown size={11} color={palette.soon.labelUpcoming} /> : null}
        </Pressable>
        <Text style={styles.ratingText}>{rating ? `${rating.courseRating.toFixed(1)} / ${rating.slopeRating}` : '—'}</Text>
      </View>
      <View style={styles.hcColumn}>
        <Pressable
          style={[styles.hcTile, handicapOverride && styles.hcTileOverridden]}
          onPress={props.onOpenHandicap}
          disabled={!editable}
          accessibilityLabel={`${name}'s Play HC`}
        >
          <Text style={[styles.hcValue, handicapOverride && styles.hcValueOverridden]}>{playingHandicap}</Text>
          {editable ? <Pencil size={10} color={handicapOverride ? palette.multiRound.note.icon : colors.primary} style={styles.hcPencil} /> : null}
        </Pressable>
        <Text style={styles.hcLabel}>Play HC</Text>
      </View>
    </View>
  );
}

export type OverallRow = { playerId: string; name: string; rank: number | null; toPar: number | null; isViewer: boolean; colorIndex: number };

/** MR6's compact "OVERALL · AFTER R1" list. */
export function OverallStandingsList({ rows }: { rows: OverallRow[] }) {
  return (
    <View style={styles.overallCard}>
      {rows.map((row, i) => (
        <View key={row.playerId} style={[styles.overallRow, i > 0 && styles.overallRowDivider, row.isViewer && styles.overallRowViewer]}>
          <Text style={[styles.overallPos, row.rank === 1 && styles.overallPosLeader]}>{row.rank ?? '—'}</Text>
          <View style={[styles.avatar, styles.overallAvatar, { backgroundColor: getSolidAvatarColor(row.colorIndex) }]}>
            <Text style={styles.avatarLabel}>{row.name[0]?.toUpperCase() ?? '?'}</Text>
          </View>
          <Text style={[styles.overallName, row.isViewer && styles.playerNameViewer]} numberOfLines={1}>
            {row.name}
            {row.isViewer ? ' (you)' : ''}
          </Text>
          <Text style={[styles.overallToPar, row.toPar !== null && row.toPar < 0 && styles.overallToParUnder, row.toPar !== null && row.toPar > 0 && styles.overallToParOver]}>{formatToPar(row.toPar)}</Text>
        </View>
      ))}
    </View>
  );
}

/** −3 / E / +2 — true minus sign, matching the scorecard's to-par figures. */
export function formatToPar(toPar: number | null): string {
  if (toPar === null) return '—';
  if (toPar === 0) return 'E';
  return toPar < 0 ? `−${Math.abs(toPar)}` : `+${toPar}`;
}

const pillBase = { borderWidth: 1, borderRadius: radius.pill, overflow: 'hidden' as const };
const ROUND_PILL_STYLE: Partial<Record<RoundCardVariant, object>> = {
  ready: { ...pillBase, color: colors.primary, backgroundColor: colors.surfaceBrandSoft, borderColor: palette.multiRound.brandSoftBorder },
  live: { ...pillBase, color: palette.multiRound.required.text, backgroundColor: palette.multiRound.required.fill, borderColor: palette.multiRound.required.border },
  notSetUp: { ...pillBase, color: palette.multiRound.note.icon, backgroundColor: palette.multiRound.note.fill, borderColor: palette.multiRound.note.border },
  planned: { ...pillBase, color: palette.multiRound.note.icon, backgroundColor: palette.multiRound.note.fill, borderColor: palette.multiRound.note.border },
};

const styles = StyleSheet.create({
  timeline: {
    marginTop: spacing[3] + 2,
    gap: spacing[1] + 2,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: spacing[1] + 1,
  },
  timelineBar: {
    flex: 1,
    height: 5,
    borderRadius: radius.pill,
  },
  timelineLabel: {
    flex: 1,
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 10,
    color: palette.multiRound.timeline.labelUpcoming,
  },
  timelineLabelActive: {
    color: palette.multiRound.timeline.labelActive,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
    backgroundColor: palette.multiRound.timeline.pillFill,
    borderRadius: radius.pill,
    paddingVertical: spacing[1] + 2,
    paddingHorizontal: spacing[2] + 2,
    flexShrink: 0,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  statusPillLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    color: palette.white,
  },
  statusPillLabelLive: {
    color: palette.multiRound.timeline.clock,
  },
  roundCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.lg - 2,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3] + 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
    minHeight: 44,
  },
  roundCardSelected: {
    borderColor: colors.primary,
  },
  roundCardLive: {
    borderColor: palette.multiRound.required.border,
  },
  roundCardFuture: {
    backgroundColor: colors.surfaceMutedTile,
    borderStyle: 'dashed',
    borderColor: palette.multiRound.futureBorder,
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDone: {
    backgroundColor: colors.primary,
  },
  badgeActive: {
    backgroundColor: colors.accent,
    ...shadows.accent,
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  badgeNumbered: {
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  badgeFuture: {
    backgroundColor: palette.soon.surface,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.multiRound.emptyTileBorder,
  },
  badgeNumber: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: colors.primary,
  },
  badgeNumberFuture: {
    color: palette.soon.labelUpcoming,
  },
  roundBody: {
    flex: 1,
    minWidth: 0,
  },
  roundTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing[1] + 2,
  },
  roundTitle: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 13,
    color: colors.textPrimary,
  },
  roundPill: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 10,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  roundLine: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    lineHeight: 15,
    color: colors.textDisabled,
    marginTop: 2,
  },
  playerRow: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.md,
    paddingVertical: spacing[2],
    paddingLeft: spacing[2] + 2,
    paddingRight: spacing[2] + 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 2,
  },
  playerRowViewer: {
    borderColor: colors.primary,
    ...shadows.sm,
  },
  playerRowMuted: {
    backgroundColor: colors.surfaceMutedTile,
    borderStyle: 'dashed',
    borderColor: palette.multiRound.pending.border,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarMuted: {
    backgroundColor: palette.multiRound.pending.avatarFill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: palette.multiRound.emptyTileBorder,
  },
  avatarLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 13,
    color: palette.white,
  },
  avatarLabelMuted: {
    color: palette.soon.labelUpcoming,
  },
  playerInfo: {
    flex: 1,
    minWidth: 0,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
  },
  playerName: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.textPrimary,
  },
  playerNameViewer: {
    color: colors.primary,
  },
  playerNameMuted: {
    color: palette.multiRound.pending.name,
    flexShrink: 1,
  },
  playerMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    color: colors.textDisabled,
  },
  playerMetaMuted: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    color: palette.multiRound.pending.meta,
  },
  invitedTag: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 10,
    color: palette.multiRound.pending.tagText,
    backgroundColor: palette.multiRound.pending.tagFill,
    borderWidth: 1,
    borderColor: palette.multiRound.pending.tagBorder,
    borderRadius: radius.pill,
    paddingHorizontal: spacing[2] - 1,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  teeColumn: {
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  teeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1] + 1,
    width: 68,
    paddingVertical: spacing[1],
    backgroundColor: colors.surfaceMutedTile,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.sm,
  },
  teeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  teeLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 10,
    color: colors.textMuted,
  },
  ratingText: {
    fontFamily: getFontFamily('numeric', '600'),
    fontWeight: '600',
    fontSize: 9,
    color: colors.textDisabled,
    marginTop: 2,
  },
  hcColumn: {
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  hcTile: {
    width: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: spacing[1] + 2,
    backgroundColor: colors.surfaceBrandSoft,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.sm,
  },
  hcTileOverridden: {
    backgroundColor: palette.multiRound.note.fill,
    borderColor: palette.multiRound.note.border,
  },
  hcTilePending: {
    backgroundColor: palette.multiRound.pending.tileFill,
    borderStyle: 'dashed',
    borderColor: palette.multiRound.pending.border,
  },
  hcValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.primary,
  },
  hcValueOverridden: {
    color: palette.multiRound.note.icon,
  },
  hcValuePending: {
    color: palette.multiRound.pending.tileText,
  },
  hcPencil: {
    opacity: 0.55,
  },
  hcLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 8,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: colors.textDisabled,
    marginTop: 2,
  },
  hcLabelPending: {
    color: palette.multiRound.pending.meta,
  },
  overallCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.lg - 2,
    overflow: 'hidden',
  },
  overallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2] + 2,
    paddingHorizontal: spacing[4],
    minHeight: 44,
  },
  overallRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  overallRowViewer: {
    backgroundColor: colors.surfaceBrandSoft,
  },
  overallPos: {
    width: 16,
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 13,
    color: colors.textSecondary,
  },
  overallPosLeader: {
    color: palette.score.eagle,
  },
  overallAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  overallName: {
    flex: 1,
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: colors.textPrimary,
  },
  overallToPar: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.textPrimary,
  },
  overallToParUnder: {
    color: palette.green[600],
  },
  overallToParOver: {
    color: colors.statusDanger,
  },
});
