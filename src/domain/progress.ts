import { addDays, weekStart } from './dates';
import { GROUPS, MUSCLE_GROUP, type MuscleGroup } from './muscles';
import { compareChrono, estimate1RM, isEligible } from './records';
import type { DayKey, Exercise, ExerciseType, RecordEvent, Unit, WorkoutSet } from './types';
import { fromKg } from './units';

// Per-workout progress series for the exercise chart (SPEC M4), and weekly sets per muscle group.

export type ProgressMetric = 'e1rm' | 'top' | 'volume' | 'reps' | 'totalReps' | 'hold' | 'distance' | 'time' | 'pace';

export const METRICS_BY_TYPE: Record<ExerciseType, { key: ProgressMetric; label: string }[]> = {
  weight_reps: [
    { key: 'e1rm', label: 'Est. 1RM' },
    { key: 'top', label: 'Top weight' },
    { key: 'volume', label: 'Volume' },
  ],
  bodyweight_reps: [
    { key: 'reps', label: 'Best set' },
    { key: 'totalReps', label: 'Total reps' },
  ],
  timed: [{ key: 'hold', label: 'Longest hold' }],
  cardio: [
    { key: 'distance', label: 'Distance' },
    { key: 'pace', label: 'Pace' },
    { key: 'time', label: 'Time' },
  ],
};

/** Lower is better for pace; higher for everything else. */
export const LOWER_IS_BETTER: ProgressMetric[] = ['pace'];

export interface ProgressPoint {
  day: DayKey;
  sessionId: string;
  value: number;
  /** A record was set in this workout. */
  record: boolean;
}

/** One point per workout (logged working sets only), oldest first. Weights are in `unit`. */
export function progressSeries(
  metric: ProgressMetric,
  sets: WorkoutSet[],
  records: RecordEvent[],
  unit: Unit,
): ProgressPoint[] {
  const recordSessions = new Set<string>();
  const setSession = new Map(sets.map((s) => [s.id, s.sessionId]));
  for (const r of records) {
    const sid = setSession.get(r.setId);
    if (sid) recordSessions.add(sid);
  }
  const bySession = new Map<string, WorkoutSet[]>();
  for (const s of sets.filter(isEligible).sort(compareChrono)) {
    bySession.set(s.sessionId, [...(bySession.get(s.sessionId) ?? []), s]);
  }
  const kg = (v: number) => Math.round(fromKg(v, unit) * 10) / 10;
  const out: ProgressPoint[] = [];
  for (const [sessionId, group] of bySession) {
    let value: number | null = null;
    const max = (f: (s: WorkoutSet) => number | null) =>
      group.reduce<number | null>((m, s) => {
        const v = f(s);
        return v == null ? m : m == null || v > m ? v : m;
      }, null);
    const sum = (f: (s: WorkoutSet) => number | null) => group.reduce((t, s) => t + (f(s) ?? 0), 0);
    switch (metric) {
      case 'e1rm': {
        const v = max((s) => (s.reps ? estimate1RM(s.weightKg ?? 0, s.reps) : null));
        value = v == null ? null : kg(v);
        break;
      }
      case 'top': {
        const v = max((s) => (s.reps ? (s.weightKg ?? 0) : null));
        value = v == null ? null : kg(v);
        break;
      }
      case 'volume':
        value = kg(sum((s) => (s.weightKg ?? 0) * (s.reps ?? 0)));
        break;
      case 'reps':
        value = max((s) => s.reps);
        break;
      case 'totalReps':
        value = sum((s) => s.reps);
        break;
      case 'hold':
      case 'time':
        value = metric === 'hold' ? max((s) => s.durationSec) : sum((s) => s.durationSec) || null;
        break;
      case 'distance':
        value = sum((s) => s.distanceM) || null;
        break;
      case 'pace': {
        const fastest = group.reduce<number | null>((m, s) => {
          const p = s.durationSec && s.distanceM ? s.durationSec / s.distanceM : null;
          return p == null ? m : m == null || p < m ? p : m;
        }, null);
        value = fastest;
        break;
      }
    }
    if (value == null || !Number.isFinite(value) || value <= 0) continue;
    out.push({ day: group[0]!.dayKey, sessionId, value, record: recordSessions.has(sessionId) });
  }
  return out;
}

export type Range = '1M' | '3M' | '6M' | '1Y' | 'All';
export const RANGES: Range[] = ['3M', '6M', '1Y', 'All'];
export const BODY_RANGES: Range[] = ['1M', '3M', '1Y', 'All'];

export function rangeStart(range: Range, today: DayKey): DayKey | null {
  const days = { '1M': 30, '3M': 91, '6M': 182, '1Y': 365, All: null }[range];
  return days == null ? null : addDays(today, -days);
}

export function inRange<T extends { day: DayKey }>(points: T[], range: Range, today: DayKey): T[] {
  const from = rangeStart(range, today);
  return from ? points.filter((p) => p.day >= from) : points;
}

/** Working sets this week per muscle group: primary = 1 per set, secondary-only = ½ per set. */
export function weeklySetsByGroup(
  sets: WorkoutSet[],
  exercises: Map<string, Exercise>,
  today: DayKey,
): { group: MuscleGroup; sets: number }[] {
  const from = weekStart(today);
  const to = addDays(from, 6);
  const totals = new Map<MuscleGroup, number>(GROUPS.map((g) => [g, 0]));
  for (const s of sets) {
    if (!isEligible(s) || s.dayKey < from || s.dayKey > to) continue;
    const ex = exercises.get(s.exerciseId);
    if (!ex) continue;
    const primary = new Set(ex.primaryMuscles.map((m) => MUSCLE_GROUP[m]));
    const secondary = new Set(ex.secondaryMuscles.map((m) => MUSCLE_GROUP[m]));
    for (const g of GROUPS) {
      if (primary.has(g)) totals.set(g, totals.get(g)! + 1);
      else if (secondary.has(g)) totals.set(g, totals.get(g)! + 0.5);
    }
  }
  return GROUPS.map((g) => ({ group: g, sets: totals.get(g)! }));
}

/** "Nice" axis ticks covering [min, max] — about `count` steps of 1/2/2.5/5×10ⁿ. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1;
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  if (ticks[ticks.length - 1]! < max) ticks.push(Math.round((ticks[ticks.length - 1]! + step) * 1e6) / 1e6);
  return ticks;
}
