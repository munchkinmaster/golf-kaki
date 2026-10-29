import { Crown, GitCompare, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AggregateStandingRow } from '../data/multiRound';
import { colors, getFontFamily, getSolidAvatarColor, palette, radius, screenGutter, shadows, spacing } from '../theme/tokens';
import { formatToPar } from './MultiRoundLobby';

/**
 * Shared chrome for the multi-round recaps (design_handoff_multi_round MR10
 * round recap, MR13 tournament complete): the green hero, its stat tiles,
 * the two-button footer, and the per-round standings table (also MR9's
 * Overall leaderboard).
 */

export function RecapHero({ overline, title, subtitle, onClose, children }: { overline: string; title: string; subtitle: string; onClose: () => void; children?: ReactNode }) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroTopRow}>
        <Text style={styles.heroOverline}>{overline}</Text>
        <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
          <X size={20} color={palette.multiRound.hero.close} />
        </Pressable>
      </View>
      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.heroSubtitle}>{subtitle}</Text>
      {children}
    </View>
  );
}

/** Gross / Nett (accent) / To par — the round's three numbers. */
export function HeroStatTiles({ gross, nett, toPar }: { gross: number | null; nett: number | null; toPar: number | null }) {
  return (
    <View style={styles.tilesRow}>
      <View style={styles.tile}>
        <Text style={styles.tileLabel}>Gross</Text>
        <Text style={styles.tileValue}>{gross ?? '–'}</Text>
      </View>
      <View style={[styles.tile, styles.tileAccent]}>
        <Text style={[styles.tileLabel, styles.tileLabelOnAccent]}>Nett</Text>
        <Text style={styles.tileValue}>{nett ?? '–'}</Text>
      </View>
      <View style={styles.tile}>
        <Text style={styles.tileLabel}>To par</Text>
        <Text style={[styles.tileValue, styles.tileValueToPar, toPar !== null && toPar > 0 && styles.tileValueToParOver]}>{formatToPar(toPar)}</Text>
      </View>
    </View>
  );
}

/** Secondary (outlined) + primary (solid green) pill pair — MR10 Scorecard / Done, MR13 Share / Done. */
export function RecapActions({ secondary, onSecondary, secondaryIcon, onDone }: { secondary: string; onSecondary: () => void; secondaryIcon: ReactNode; onDone: () => void }) {
  return (
    <View style={styles.actions}>
      <Pressable style={styles.secondaryButton} onPress={onSecondary}>
        {secondaryIcon}
        <Text style={styles.secondaryLabel}>{secondary}</Text>
      </Pressable>
      <Pressable style={styles.doneButton} onPress={onDone}>
        <Text style={styles.doneLabel}>Done</Text>
      </Pressable>
    </View>
  );
}

type StandingsTableProps = {
  rows: AggregateStandingRow[];
  /** Which rounds get a column (R1, R2…), in order. */
  roundIndexes: number[];
  nameOf: (playerId: string) => string;
  colorIndexOf: (playerId: string) => number;
  viewerId: string | undefined;
  /** MR9's ▲ places-gained marker — off for the MR10/MR13 recaps, which don't show movement. */
  showMovement?: boolean;
  /** Players whose place came from the tie-break (explainTieBreaks' decidedIds) — they get a "Countback" tag. */
  countbackIds?: Set<string>;
};

/** POS · PLAYER · R1…Rn · TOTAL — per-round cells are that round's nett, TOTAL is aggregate nett to par. DNS shows in-cell; a player who missed a round ranks "—". */
export function MultiRoundStandingsTable({ rows, roundIndexes, nameOf, colorIndexOf, viewerId, showMovement = false, countbackIds }: StandingsTableProps) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.headerCell, styles.posCol]}>Pos</Text>
        <Text style={[styles.headerCell, styles.playerCol]}>Player</Text>
        {roundIndexes.map((i) => (
          <Text key={i} style={[styles.headerCell, styles.roundCol]}>
            R{i}
          </Text>
        ))}
        <Text style={[styles.headerCell, styles.totalCol, styles.headerTotal]}>Total</Text>
      </View>
      {rows.map((row, rowIndex) => {
        const missed = row.missedRounds.length > 0;
        const isViewer = row.playerId === viewerId;
        return (
          <View
            key={row.playerId}
            style={[styles.tableRow, rowIndex > 0 && styles.tableRowDivider, row.rank === 1 && styles.tableRowLeader, isViewer && row.rank !== 1 && styles.tableRowViewer]}
          >
            <View style={[styles.posCol, styles.posCell]}>
              <Text style={[styles.posText, row.rank === 1 && styles.posLeader]}>{row.rank ?? '—'}</Text>
              {row.rank === 1 ? <Crown size={12} color={palette.score.eagle} /> : null}
              {showMovement && row.movement !== null && row.movement > 0 ? <Text style={styles.movement}>▲{row.movement}</Text> : null}
            </View>
            <View style={[styles.playerCol, styles.playerCell]}>
              <View style={[styles.avatar, { backgroundColor: missed ? palette.multiRound.pending.avatarFill : getSolidAvatarColor(colorIndexOf(row.playerId)) }]}>
                <Text style={[styles.avatarLabel, missed && styles.avatarLabelMuted]}>{nameOf(row.playerId)[0]?.toUpperCase() ?? '?'}</Text>
              </View>
              <Text style={[styles.playerName, isViewer && styles.playerNameViewer, missed && styles.playerNameMuted]} numberOfLines={1}>
                {nameOf(row.playerId)}
                {isViewer ? ' (you)' : ''}
              </Text>
              {countbackIds?.has(row.playerId) ? (
                <View style={styles.countbackTag}>
                  <GitCompare size={9} color={colors.textSecondary} />
                  <Text style={styles.countbackTagLabel}>Countback</Text>
                </View>
              ) : null}
            </View>
            {roundIndexes.map((i) => {
              const cell = row.rounds[i];
              return (
                <View key={i} style={styles.roundCol}>
                  {cell?.kind === 'dns' ? (
                    <Text style={styles.dnsTag}>DNS</Text>
                  ) : (
                    <Text style={[styles.roundCell, missed && styles.cellMuted]}>{cell && cell.thru > 0 ? cell.nett : '–'}</Text>
                  )}
                </View>
              );
            })}
            <Text style={[styles.totalCol, styles.totalCell, !missed && row.totalToPar < 0 && styles.totalUnder, !missed && row.totalToPar > 0 && styles.totalOver, missed && styles.cellMuted]}>
              {missed ? '—' : formatToPar(row.totalToPar)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** "Tie-break: countback" — explainTieBreaks' notes under the standings, same card the single-round Finish screen (S10) uses for Stableford countback. Also carries sharedPlaceNote mid-tournament (title "Tied places"). Renders nothing when there's nothing to explain. */
export function TieBreakCard({ notes, title = 'Tie-break: countback' }: { notes: string[]; title?: string }) {
  if (notes.length === 0) return null;
  return (
    <View style={styles.tieBreakCard}>
      <View style={styles.tieBreakIconTile}>
        <GitCompare size={16} color={colors.primary} />
      </View>
      <View style={styles.tieBreakBody}>
        <Text style={styles.tieBreakTitle}>{title}</Text>
        {notes.map((note, i) => (
          <Text key={i} style={styles.tieBreakText}>
            {note}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  countbackTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: palette.soon.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing[1] + 2,
    paddingVertical: 1,
    flexShrink: 0,
  },
  countbackTagLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 8.5,
    color: colors.textSecondary,
  },
  tieBreakCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2] + 3,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.lg - 2,
    padding: spacing[3] + 1,
  },
  tieBreakIconTile: {
    width: 34,
    height: 34,
    borderRadius: radius.md - 1,
    backgroundColor: colors.surfaceBrandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tieBreakBody: { flex: 1, minWidth: 0 },
  tieBreakTitle: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 13,
    color: colors.textPrimary,
  },
  tieBreakText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 15,
  },
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: screenGutter,
    paddingTop: spacing[3],
    paddingBottom: spacing[5] + 2,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroOverline: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 2,
    color: palette.orange[300],
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 23,
    color: palette.white,
    marginTop: spacing[2] + 2,
  },
  heroSubtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: palette.multiRound.hero.subtitle,
    marginTop: 3,
  },
  tilesRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[4],
  },
  tile: {
    flex: 1,
    backgroundColor: palette.multiRound.hero.tileFill,
    borderRadius: radius.md + 1,
    paddingVertical: spacing[2] + 3,
    paddingHorizontal: spacing[2],
    alignItems: 'center',
  },
  tileAccent: {
    backgroundColor: colors.accent,
    ...shadows.accent,
  },
  tileLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 10,
    letterSpacing: 0.6,
    color: palette.multiRound.hero.label,
    textTransform: 'uppercase',
  },
  tileLabelOnAccent: {
    color: palette.multiRound.hero.labelOnAccent,
  },
  tileValue: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 26,
    color: palette.white,
    marginTop: 2,
  },
  tileValueToPar: {
    color: palette.multiRound.timeline.done,
  },
  tileValueToParOver: {
    color: palette.multiRound.hero.toParOver,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2] + 1,
    paddingHorizontal: screenGutter,
    paddingTop: spacing[2] + 2,
    paddingBottom: spacing[3],
  },
  secondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: palette.green[200],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1] + 3,
  },
  secondaryLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: colors.primary,
  },
  doneButton: {
    flex: 1,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: palette.white,
  },
  table: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.lg - 2,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing[2] + 2,
    paddingHorizontal: spacing[3],
  },
  headerCell: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: palette.multiRound.hero.labelOnAccent,
  },
  headerTotal: {
    color: palette.orange[300],
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2] + 2,
    paddingHorizontal: spacing[3],
    minHeight: 48,
  },
  tableRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  tableRowLeader: {
    backgroundColor: palette.multiRound.leaderFill,
  },
  tableRowViewer: {
    backgroundColor: colors.surfaceBrandSoft,
  },
  posCol: { width: 40 },
  playerCol: { flex: 1, minWidth: 0 },
  roundCol: { width: 34, alignItems: 'center' },
  totalCol: { width: 44, textAlign: 'right' },
  posCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  posText: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 14,
    color: colors.textSecondary,
  },
  posLeader: {
    color: palette.score.eagle,
  },
  movement: {
    fontFamily: getFontFamily('numeric', '600'),
    fontWeight: '600',
    fontSize: 9,
    color: palette.green[600],
  },
  playerCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingRight: spacing[1],
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 12,
    color: palette.white,
  },
  avatarLabelMuted: {
    color: palette.soon.labelUpcoming,
  },
  playerName: {
    flexShrink: 1,
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: colors.textPrimary,
  },
  playerNameViewer: {
    color: colors.primary,
  },
  playerNameMuted: {
    color: palette.multiRound.pending.name,
  },
  roundCell: {
    fontFamily: getFontFamily('numeric', '400'),
    fontSize: 13,
    color: colors.textSecondary,
  },
  cellMuted: {
    color: palette.multiRound.pending.meta,
  },
  dnsTag: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 9,
    color: palette.multiRound.note.icon,
    backgroundColor: palette.multiRound.note.fill,
    borderWidth: 1,
    borderColor: palette.multiRound.note.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing[1] + 1,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  totalCell: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.textPrimary,
  },
  totalUnder: {
    color: palette.green[600],
  },
  totalOver: {
    color: colors.statusDanger,
  },
});
