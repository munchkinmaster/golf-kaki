/**
 * Calendar-day helpers for a multi-round tournament's schedule (MR2/MR2c).
 * Round dates are plain local calendar days stored as YYYY-MM-DD
 * (tournament_rounds.round_date), never instants — so nothing here goes
 * through toISOString(), which would roll an SGT morning back to the
 * previous UTC day. Pure, no imports.
 */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Default gap between rounds — MR2's sample schedule is fortnightly (11 Jul, 25 Jul, 8 Aug). */
export const DEFAULT_ROUND_GAP_DAYS = 14;

/** A local Date as YYYY-MM-DD. */
export function localDateString(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** YYYY-MM-DD → a Date at local midnight. */
export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

export function addDays(value: string, days: number): string {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

/** "Sat 11 Jul" — MR2's date chip and MR2c's CTA. */
export function formatRoundDate(value: string): string {
  const date = parseLocalDate(value);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** "11 Jul" — MR13's date range ("11 Jul – 8 Aug"). */
export function formatDayMonth(value: string): string {
  const date = parseLocalDate(value);
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** "July 2026" — MR2c's month header. */
export function formatMonthTitle(year: number, month: number): string {
  return `${MONTHS_LONG[month]} ${year}`;
}

/** The coming Saturday (today, if today is one) — weekend golf is the default. */
export function nextSaturday(today: string): string {
  const day = parseLocalDate(today).getDay();
  return addDays(today, (6 - day + 7) % 7);
}

/**
 * Resizes a schedule to `count` rounds. Existing dates are kept; new rounds
 * are added a fortnight after the one before (the first defaults to the
 * coming Saturday).
 */
export function resizeRoundDates(dates: string[], count: number, today: string): string[] {
  const next = dates.slice(0, count);
  while (next.length < count) {
    const prev = next[next.length - 1];
    next.push(prev === undefined ? nextSaturday(today) : addDays(prev, DEFAULT_ROUND_GAP_DAYS));
  }
  return next;
}

/**
 * Sets round `index` (0-based) to `date`, then pushes any later round that's
 * no longer after its predecessor out to a fortnight past it — rounds stay in
 * date order without the host having to re-pick every one.
 */
export function setRoundDate(dates: string[], index: number, date: string): string[] {
  const next = [...dates];
  next[index] = date;
  for (let i = index + 1; i < next.length; i++) {
    if (next[i]! <= next[i - 1]!) next[i] = addDays(next[i - 1]!, DEFAULT_ROUND_GAP_DAYS);
  }
  return next;
}

/** The earliest date round `index` (0-based) may take: today for Round 1, else the day after the previous round. */
export function minRoundDate(dates: string[], index: number, today: string): string {
  return index === 0 ? today : addDays(dates[index - 1]!, 1);
}

/**
 * One month as Monday-first weeks (MR2c's grid) — each cell a YYYY-MM-DD, or
 * null for the blanks before the 1st and after the last day.
 */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (first.getDay() + 6) % 7; // Mon = 0
  const cells: (string | null)[] = Array.from({ length: leadingBlanks }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(localDateString(new Date(year, month, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
