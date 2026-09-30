// Test helpers (imported only by *.test.ts files).
import type { WorkoutSet } from './types';
import { toKg } from './units';

let seq = 0;

export function mkSet(p: Partial<WorkoutSet> & { exerciseId: string; dayKey: string }): WorkoutSet {
  seq += 1;
  const unit = p.unit ?? 'kg';
  const weight = p.weight ?? null;
  return {
    id: p.id ?? `s${String(seq).padStart(4, '0')}`,
    sessionExerciseId: p.sessionExerciseId ?? `se-${p.exerciseId}-${p.dayKey}`,
    sessionId: p.sessionId ?? `sess-${p.dayKey}`,
    order: p.order ?? seq,
    kind: p.kind ?? 'working',
    toFailure: p.toFailure ?? false,
    weightKg: p.weightKg !== undefined ? p.weightKg : weight == null ? null : toKg(weight, unit),
    reps: p.reps ?? null,
    durationSec: p.durationSec ?? null,
    distanceM: p.distanceM ?? null,
    note: p.note ?? '',
    loggedAt: p.loggedAt !== undefined ? p.loggedAt : `${p.dayKey}T10:${String(seq % 60).padStart(2, '0')}:00.000Z`,
    ...p,
    unit,
    weight,
  };
}

/** Shorthand: working set `weight × reps` on `dayKey`. */
export function wr(exerciseId: string, dayKey: string, weight: number, reps: number, extra: Partial<WorkoutSet> = {}) {
  return mkSet({ exerciseId, dayKey, weight, reps, ...extra });
}
