import { ChevronLeft, ChevronRight, Info } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMonthTitle, formatRoundDate, minRoundDate, monthGrid, parseLocalDate } from '../data/roundDates';
import { colors, getFontFamily, palette, radius, shadows, spacing } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

type RoundDatePickerSheetProps = {
  visible: boolean;
  /** 0-based round being edited. */
  roundIndex: number;
  /** Every round's current date (YYYY-MM-DD) — the others are marked R1, R2… on the calendar. */
  dates: string[];
  /** Local YYYY-MM-DD — Round 1 can't be scheduled before it. */
  today: string;
  onClose: () => void;
  onConfirm: (date: string) => void;
};

/**
 * MR2c — a round's date as a Monday-first month calendar. Calendar only: the
 * handoff removed the +1/+2/+4-week quick picks. Dates before the previous
 * round (or before today, for Round 1) are greyed out; other rounds' dates
 * are tagged so the host sees the whole schedule while picking one.
 */
export function RoundDatePickerSheet({ visible, roundIndex, dates, today, onClose, onConfirm }: RoundDatePickerSheetProps) {
  const current = dates[roundIndex] ?? today;
  const [selected, setSelected] = useState(current);
  const [month, setMonth] = useState(() => monthOf(current));

  // Re-seed every time the sheet opens (possibly for a different round).
  useEffect(() => {
    if (!visible) return;
    setSelected(current);
    setMonth(monthOf(current));
  }, [visible, current]);

  const minDate = minRoundDate(dates, roundIndex, today);
  const minMonth = monthOf(minDate);
  const canGoBack = month.year > minMonth.year || (month.year === minMonth.year && month.month > minMonth.month);
  const shiftMonth = (delta: number) => setMonth(({ year, month: m }) => monthOf(`${year}-${String(m + 1).padStart(2, '0')}-01`, delta));

  const prev = roundIndex > 0 ? dates[roundIndex - 1] : undefined;
  const subtitle = prev ? `After Round ${roundIndex} · ${formatRoundDate(prev)}` : `Round 1 of ${dates.length}`;
  const note = roundIndex > 0 ? `Dates before Round ${roundIndex} are greyed out. Tee time is set on the day.` : 'Dates before today are greyed out. Tee time is set on the day.';

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={`Round ${roundIndex + 1} date`}
      subtitle={subtitle}
      footer={<Button label={`Set ${formatRoundDate(selected)}`} variant="accent" size="lg" block onPress={() => onConfirm(selected)} />}
    >
      <View>
        <View style={styles.monthRow}>
          <Pressable style={styles.monthButton} disabled={!canGoBack} onPress={() => shiftMonth(-1)} accessibilityLabel="Previous month">
            <ChevronLeft size={16} color={canGoBack ? colors.textSecondary : palette.multiRound.dayDisabled} />
          </Pressable>
          <Text style={styles.monthTitle}>{formatMonthTitle(month.year, month.month)}</Text>
          <Pressable style={styles.monthButton} onPress={() => shiftMonth(1)} accessibilityLabel="Next month">
            <ChevronRight size={16} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.week}>
          {WEEKDAY_LABELS.map((label, i) => (
            <Text key={i} style={[styles.weekdayLabel, i >= 5 && styles.weekendText]}>
              {label}
            </Text>
          ))}
        </View>

        {monthGrid(month.year, month.month).map((week, w) => (
          <View key={w} style={styles.week}>
            {week.map((date, i) => {
              if (date === null) return <View key={i} style={styles.cell} />;
              const isSelected = date === selected;
              const otherRound = dates.findIndex((d, r) => r !== roundIndex && d === date);
              const disabled = date < minDate;
              return (
                <Pressable key={i} style={styles.cell} disabled={disabled} onPress={() => setSelected(date)}>
                  <View style={[styles.day, isSelected ? styles.daySelected : otherRound >= 0 ? styles.dayOtherRound : null]}>
                    <Text
                      style={[
                        styles.dayLabel,
                        i >= 5 && styles.dayLabelWeekend,
                        disabled && styles.dayLabelDisabled,
                        (isSelected || otherRound >= 0) && styles.dayLabelFilled,
                      ]}
                    >
                      {parseLocalDate(date).getDate()}
                    </Text>
                  </View>
                  {isSelected || otherRound >= 0 ? (
                    <Text style={[styles.roundTag, isSelected && styles.roundTagSelected]}>R{isSelected ? roundIndex + 1 : otherRound + 1}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}

        <View style={styles.note}>
          <Info size={13} color={colors.textMuted} />
          <Text style={styles.noteText}>{note}</Text>
        </View>
      </View>
    </BottomSheet>
  );
}

function monthOf(date: string, delta = 0): { year: number; month: number } {
  const d = parseLocalDate(date);
  const total = d.getFullYear() * 12 + d.getMonth() + delta;
  return { year: Math.floor(total / 12), month: total % 12 };
}

const styles = StyleSheet.create({
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[1],
    marginBottom: spacing[2],
    marginHorizontal: 2,
  },
  monthButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.circle,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  monthTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 15,
    color: colors.textPrimary,
  },
  week: {
    flexDirection: 'row',
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 10,
    color: palette.soon.labelUpcoming,
    paddingBottom: spacing[1],
  },
  weekendText: {
    color: colors.primary,
    fontWeight: '700',
  },
  cell: {
    flex: 1,
    height: 48,
    alignItems: 'center',
  },
  day: {
    width: 36,
    height: 36,
    borderRadius: radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: {
    backgroundColor: colors.accent,
    ...shadows.accent,
  },
  dayOtherRound: {
    backgroundColor: colors.primary,
  },
  dayLabel: {
    fontFamily: getFontFamily('numeric', '400'),
    fontSize: 14,
    color: colors.textPrimary,
  },
  dayLabelWeekend: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    color: colors.primary,
  },
  dayLabelDisabled: {
    fontFamily: getFontFamily('numeric', '400'),
    fontWeight: '400',
    color: palette.multiRound.dayDisabled,
  },
  dayLabelFilled: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    color: palette.white,
  },
  roundTag: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    fontSize: 8,
    letterSpacing: 0.3,
    color: colors.primary,
    marginTop: 1,
  },
  roundTagSelected: {
    color: palette.multiRound.required.text,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] - 1,
    marginTop: spacing[3],
    paddingVertical: spacing[2] + 1,
    paddingHorizontal: spacing[3],
    backgroundColor: colors.surfaceMutedTile,
    borderWidth: 1,
    borderColor: palette.sand[200],
    borderRadius: radius.md - 2,
  },
  noteText: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    lineHeight: 15,
    color: colors.textMuted,
  },
});
