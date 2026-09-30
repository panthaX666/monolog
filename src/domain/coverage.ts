import { addDays, daysBetween, weekStart } from './dates';
import { GROUPS, MUSCLE_GROUP, type MuscleGroup } from './muscles';
import type { DayKey, Muscle } from './types';

// Weekly coverage — SPEC §6.3. Week = Monday–Sunday. Per session and group: 1 if any exercise hits
// the group as a primary muscle, else ½ if only as a secondary muscle. Counted per session, not per set.

export const WEEKLY_TARGET = 2;

export interface CoverageSession {
  dayKey: DayKey;
  /** Exercises in the session that have at least one logged working set. */
  exercises: { primaryMuscles: Muscle[]; secondaryMuscles: Muscle[] }[];
}

export interface GroupCoverage {
  group: MuscleGroup;
  /** Sessions this week (primary = 1, secondary-only = ½). */
  sessions: number;
  /** Most recent day the group was trained as a primary muscle (any week), or null. */
  lastTrained: DayKey | null;
  daysSince: number | null;
}

function sessionScore(s: CoverageSession, group: MuscleGroup): number {
  let score = 0;
  for (const ex of s.exercises) {
    if (ex.primaryMuscles.some((m) => MUSCLE_GROUP[m] === group)) return 1;
    if (ex.secondaryMuscles.some((m) => MUSCLE_GROUP[m] === group)) score = 0.5;
  }
  return score;
}

export function computeCoverage(sessions: CoverageSession[], today: DayKey): GroupCoverage[] {
  const from = weekStart(today);
  const to = addDays(from, 6);
  return GROUPS.map((group) => {
    let count = 0;
    let lastTrained: DayKey | null = null;
    for (const s of sessions) {
      if (s.dayKey > today) continue;
      const score = sessionScore(s, group);
      if (s.dayKey >= from && s.dayKey <= to) count += score;
      if (score === 1 && (lastTrained == null || s.dayKey > lastTrained)) lastTrained = s.dayKey;
    }
    return { group, sessions: count, lastTrained, daysSince: lastTrained ? daysBetween(lastTrained, today) : null };
  });
}
