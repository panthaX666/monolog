import { addDays, daysBetween } from './dates';
import type { DayKey } from './types';

// Streak rules, docs/SPEC.md §6.2 (decisions D12, D22).
// A day is trained (≥1 logged working set) › rest (rest day logged) › empty.
// Trained or rest days extend the streak. An empty day breaks it once its grace window has passed
// (a day can still be filled in until the end of the next day). A 4th consecutive rest day breaks it.

export const MAX_REST_RUN = 3;

export type DayStatus = 'trained' | 'rest' | 'empty';

export interface StreakInput {
  trainedDays: Iterable<DayKey>;
  restDays: Iterable<DayKey>;
  today: DayKey;
}

export interface Streak {
  /** Current streak length in days (0 = none). */
  current: number;
  /** Longest streak ever, including the current one. */
  best: number;
  /** First day of the current streak, or null. */
  startDay: DayKey | null;
  /** Consecutive rest days at the end of the current streak (0…3). */
  restRun: number;
  /** Yesterday is empty but still fillable. Log it (workout or rest day) or the streak breaks tonight. */
  yesterdayPending: boolean;
  /** Today already counts toward the streak. */
  todayDone: boolean;
}

export function dayStatus(day: DayKey, trained: Set<DayKey>, rest: Set<DayKey>): DayStatus {
  if (trained.has(day)) return 'trained';
  if (rest.has(day)) return 'rest';
  return 'empty';
}

export function computeStreak({ trainedDays, restDays, today }: StreakInput): Streak {
  const trained = new Set(trainedDays);
  const rest = new Set(restDays);
  const yesterday = addDays(today, -1);

  // Only history up to today matters (future-dated entries are ignored).
  const known = [...trained, ...rest].filter((d) => d <= today).sort();
  const result: Streak = {
    current: 0,
    best: 0,
    startDay: null,
    restRun: 0,
    yesterdayPending: false,
    todayDone: false,
  };
  if (known.length === 0) return result;

  let cur = 0;
  let restRun = 0;
  let start: DayKey | null = null;
  const total = daysBetween(known[0]!, today);
  for (let i = 0; i <= total; i++) {
    const day = addDays(known[0]!, i);
    const status = dayStatus(day, trained, rest);

    if (status === 'empty') {
      // Today is never a break; yesterday is still inside its grace window.
      if (day === today) continue;
      if (day === yesterday) {
        result.yesterdayPending = cur > 0;
        continue;
      }
      cur = 0;
      restRun = 0;
      start = null;
      continue;
    }

    if (status === 'trained') {
      restRun = 0;
      if (cur === 0) start = day;
      cur += 1;
    } else {
      restRun += 1;
      if (restRun > MAX_REST_RUN) {
        cur = 0;
        start = null;
      } else {
        if (cur === 0) start = day;
        cur += 1;
      }
    }
    result.best = Math.max(result.best, cur);
  }

  result.current = cur;
  result.startDay = cur > 0 ? start : null;
  result.restRun = cur > 0 ? restRun : 0;
  result.todayDone = cur > 0 && (trained.has(today) || rest.has(today));
  if (cur === 0) result.yesterdayPending = false;
  return result;
}

export interface StreakSegment {
  start: DayKey;
  end: DayKey;
  length: number;
}

/**
 * Every streak run in history, oldest first, under the same rules as computeStreak: an empty day
 * (outside the grace window) ends a run, and rest days past the 3rd don't belong to any run.
 * Used to draw the joined streak bars on the History calendar.
 */
export function streakSegments({ trainedDays, restDays, today }: StreakInput): StreakSegment[] {
  const trained = new Set(trainedDays);
  const rest = new Set(restDays);
  const yesterday = addDays(today, -1);
  const known = [...trained, ...rest].filter((d) => d <= today).sort();
  if (!known.length) return [];

  const segments: StreakSegment[] = [];
  let cur: StreakSegment | null = null;
  let restRun = 0;
  const close = () => {
    if (cur) segments.push(cur);
    cur = null;
    restRun = 0;
  };

  for (let day = known[0]!; day <= today; day = addDays(day, 1)) {
    const status = dayStatus(day, trained, rest);
    if (status === 'empty') {
      if (day === today || day === yesterday) continue; // still fillable, not a break yet
      close();
      continue;
    }
    if (status === 'rest') {
      restRun += 1;
      if (restRun > MAX_REST_RUN) {
        // The 4th rest day breaks the run; extra rest days don't start a new one.
        if (cur) segments.push(cur);
        cur = null;
        continue;
      }
    } else {
      restRun = 0;
    }
    if (!cur) cur = { start: day, end: day, length: 0 };
    cur.end = day;
    cur.length += 1;
  }
  close();
  return segments;
}

/** Can a rest day be logged for `day`? Only today, or yesterday until the end of today (D22). */
export function canLogRestDay(day: DayKey, today: DayKey, trained: Set<DayKey>): boolean {
  if (trained.has(day)) return false;
  return day === today || day === addDays(today, -1);
}
