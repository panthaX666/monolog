import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, isValidDayKey, toDayKey, weekStart, weekday } from './dates';

describe('dates', () => {
  it('formats local calendar dates', () => {
    expect(toDayKey(new Date(2026, 8, 30, 23, 59))).toBe('2026-09-30');
    expect(toDayKey(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });

  it('adds days across month, year and DST boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30'); // EU DST switch
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02'); // US DST switch
  });

  it('counts days between', () => {
    expect(daysBetween('2026-09-28', '2026-09-30')).toBe(2);
    expect(daysBetween('2026-09-30', '2026-09-28')).toBe(-2);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('weeks start on Monday', () => {
    expect(weekday('2026-09-28')).toBe(1); // Monday
    expect(weekStart('2026-09-28')).toBe('2026-09-28');
    expect(weekStart('2026-09-30')).toBe('2026-09-28');
    expect(weekStart('2026-10-04')).toBe('2026-09-28'); // Sunday belongs to the week before
    expect(weekStart('2026-10-05')).toBe('2026-10-05');
  });

  it('validates day keys', () => {
    expect(isValidDayKey('2026-09-30')).toBe(true);
    expect(isValidDayKey('2026-02-30')).toBe(false);
    expect(isValidDayKey('2026-9-30')).toBe(false);
    expect(isValidDayKey(20260930)).toBe(false);
  });
});
