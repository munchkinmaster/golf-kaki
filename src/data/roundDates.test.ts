import { describe, expect, it } from 'vitest';

import { addDays, formatDayMonth, formatMonthTitle, formatRoundDate, minRoundDate, monthGrid, nextSaturday, resizeRoundDates, setRoundDate } from './roundDates';

describe('roundDates', () => {
  it('formats a round date like the MR2 chip', () => {
    expect(formatRoundDate('2026-07-11')).toBe('Sat 11 Jul');
    expect(formatMonthTitle(2026, 6)).toBe('July 2026');
    expect(formatDayMonth('2026-08-08')).toBe('8 Aug');
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-07-25', 14)).toBe('2026-08-08');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('defaults to the coming Saturday, or today on a Saturday', () => {
    expect(nextSaturday('2026-10-29')).toBe('2026-10-31'); // Thursday
    expect(nextSaturday('2026-10-31')).toBe('2026-10-31');
  });

  it('grows a schedule fortnightly and keeps existing dates', () => {
    expect(resizeRoundDates([], 3, '2026-07-09')).toEqual(['2026-07-11', '2026-07-25', '2026-08-08']);
    expect(resizeRoundDates(['2026-07-11', '2026-07-18'], 3, '2026-07-09')).toEqual(['2026-07-11', '2026-07-18', '2026-08-01']);
    expect(resizeRoundDates(['2026-07-11', '2026-07-25', '2026-08-08'], 2, '2026-07-09')).toEqual(['2026-07-11', '2026-07-25']);
  });

  it('pushes later rounds out when an earlier one moves past them', () => {
    expect(setRoundDate(['2026-07-11', '2026-07-25', '2026-08-08'], 0, '2026-07-30')).toEqual(['2026-07-30', '2026-08-13', '2026-08-27']);
    expect(setRoundDate(['2026-07-11', '2026-07-25', '2026-08-08'], 1, '2026-07-18')).toEqual(['2026-07-11', '2026-07-18', '2026-08-08']);
  });

  it('only allows a round after the one before it', () => {
    expect(minRoundDate(['2026-07-11', '2026-07-25'], 0, '2026-07-01')).toBe('2026-07-01');
    expect(minRoundDate(['2026-07-11', '2026-07-25'], 1, '2026-07-01')).toBe('2026-07-12');
  });

  it('lays a month out Monday-first like MR2c (July 2026 starts on a Wednesday)', () => {
    const weeks = monthGrid(2026, 6);
    expect(weeks[0]).toEqual([null, null, '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05']);
    expect(weeks[weeks.length - 1]).toEqual(['2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31', null, null]);
  });
});
