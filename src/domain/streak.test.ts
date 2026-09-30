import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { canLogRestDay, computeStreak } from './streak';

const TODAY = '2026-09-30';

/** Build a history ending at `end` from a pattern, oldest first: T = trained, R = rest, . = empty. */
function history(pattern: string, end: string) {
  const trainedDays: string[] = [];
  const restDays: string[] = [];
  [...pattern].forEach((c, i) => {
    const day = addDays(end, i - (pattern.length - 1));
    if (c === 'T') trainedDays.push(day);
    if (c === 'R') restDays.push(day);
  });
  return { trainedDays, restDays };
}
const streakOf = (pattern: string, today = TODAY) => computeStreak({ ...history(pattern, today), today });

describe('streak', () => {
  it('no data → no streak', () => {
    expect(computeStreak({ trainedDays: [], restDays: [], today: TODAY })).toMatchObject({ current: 0, best: 0 });
  });

  it('counts consecutive trained days including today', () => {
    expect(streakOf('.TTT')).toMatchObject({ current: 3, todayDone: true, startDay: '2026-09-28' });
  });

  it('rest days extend the streak', () => {
    expect(streakOf('TTRT')).toMatchObject({ current: 4, restRun: 0 });
    expect(streakOf('TTRR')).toMatchObject({ current: 4, restRun: 2 });
  });

  it('3 rest days in a row are allowed; the 4th breaks the streak', () => {
    expect(streakOf('TTRRR')).toMatchObject({ current: 5, restRun: 3 });
    expect(streakOf('TTRRRR')).toMatchObject({ current: 0, best: 5 });
  });

  it('after a 4-rest break, the next trained day starts a new streak (extra rest days do not count)', () => {
    expect(streakOf('TTRRRRRT')).toMatchObject({ current: 1, best: 5, startDay: TODAY });
  });

  it('today being empty never breaks the streak', () => {
    expect(streakOf('TTT.')).toMatchObject({ current: 3, todayDone: false, yesterdayPending: false });
  });

  it('yesterday empty is still in its grace window (pending, not broken)', () => {
    expect(streakOf('TTT..')).toMatchObject({ current: 3, yesterdayPending: true });
    expect(streakOf('TTT.T')).toMatchObject({ current: 4, yesterdayPending: true });
  });

  it('an empty day older than yesterday breaks it', () => {
    expect(streakOf('TTT...')).toMatchObject({ current: 0, best: 3, yesterdayPending: false });
    expect(streakOf('TT.TT')).toMatchObject({ current: 2, best: 2 });
  });

  it('a day with both a workout and a rest day counts as trained (resets the rest run)', () => {
    const { trainedDays, restDays } = history('TRRR', TODAY);
    restDays.push(addDays(TODAY, -1)); // yesterday: rest…
    trainedDays.push(addDays(TODAY, -1)); // …but also trained
    expect(computeStreak({ trainedDays, restDays, today: TODAY })).toMatchObject({ current: 4, restRun: 1 });
  });

  it('ignores future-dated entries', () => {
    const s = computeStreak({ trainedDays: [TODAY, addDays(TODAY, 1)], restDays: [], today: TODAY });
    expect(s.current).toBe(1);
  });

  it('matches the Home mockup: 9-day streak with one rest day', () => {
    expect(streakOf('.TT.TTTRTTTTT')).toMatchObject({ current: 9, best: 9 });
  });
});

describe('canLogRestDay', () => {
  const trained = new Set(['2026-09-28']);
  it('allows today and yesterday only', () => {
    expect(canLogRestDay(TODAY, TODAY, trained)).toBe(true);
    expect(canLogRestDay('2026-09-29', TODAY, trained)).toBe(true);
    expect(canLogRestDay('2026-09-27', TODAY, trained)).toBe(false);
    expect(canLogRestDay('2026-10-01', TODAY, trained)).toBe(false);
  });
  it('not on a day that already has a workout', () => {
    expect(canLogRestDay('2026-09-28', '2026-09-29', trained)).toBe(false);
  });
});
