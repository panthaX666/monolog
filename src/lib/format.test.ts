import { describe, expect, it } from 'vitest';
import { formatClock, formatDay, formatDuration, formatWeekday, plural } from './format';

describe('format', () => {
  it('dates use fixed short English names', () => {
    expect(formatDay('2026-09-30')).toBe('30 Sep');
    expect(formatDay('2025-11-03', '2026-10-01')).toBe('3 Nov 2025');
    expect(formatWeekday('2026-09-30')).toBe('Wed 30 Sep');
  });
  it('clock and durations', () => {
    expect(formatClock(95)).toBe('1:35');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatDuration(3120)).toBe('52 min');
    expect(formatDuration(4500)).toBe('1 h 15 min');
    expect(plural(1, 'set')).toBe('1 set');
    expect(plural(2, 'entry', 'entries')).toBe('2 entries');
  });
});
