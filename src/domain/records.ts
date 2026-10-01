import type { ExerciseType, RecordEvent, RecordKind, WorkoutSet } from './types';
import { EPS } from './units';

// Record rules, docs/SPEC.md §6.1.
// Pure functions: given one exercise's sets, derive every RecordEvent deterministically. Because the
// result depends only on the stored sets, editing or deleting history just means recomputing.

/** Logged working sets only. Warm-ups and pre-filled sets never count. */
export function isEligible(s: WorkoutSet): boolean {
  return s.loggedAt != null && s.kind === 'working';
}

/** Chronological order: training day first, then the moment the set was logged. */
export function compareChrono(a: WorkoutSet, b: WorkoutSet): number {
  if (a.dayKey !== b.dayKey) return a.dayKey < b.dayKey ? -1 : 1;
  const la = a.loggedAt ?? '';
  const lb = b.loggedAt ?? '';
  if (la !== lb) return la < lb ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

const w = (s: WorkoutSet) => s.weightKg ?? 0;

interface Candidate {
  kind: RecordKind;
  before: WorkoutSet;
  beforeValue: number;
  after: number;
}

function best(sets: WorkoutSet[], value: (s: WorkoutSet) => number | null, better: (a: number, b: number) => boolean) {
  let top: { set: WorkoutSet; value: number } | null = null;
  for (const s of sets) {
    const v = value(s);
    if (v == null) continue;
    if (!top || better(v, top.value)) top = { set: s, value: v };
  }
  return top;
}
const higher = (a: number, b: number) => a > b + EPS;
const lower = (a: number, b: number) => a < b - EPS;

/** Heavier than ever, else more of `measure` at the same weight or heavier. */
function weightThen(
  prior: WorkoutSet[],
  set: WorkoutSet,
  measure: (s: WorkoutSet) => number | null,
  kind: 'reps' | 'duration',
): Candidate | null {
  const value = measure(set);
  if (value == null || value <= 0) return null;
  const heaviest = best(prior, (p) => (measure(p) != null ? w(p) : null), higher);
  if (!heaviest) return null; // first comparable set: nothing to beat
  if (higher(w(set), heaviest.value)) {
    return { kind: 'weight', before: heaviest.set, beforeValue: heaviest.value, after: w(set) };
  }
  const atOrAbove = prior.filter((p) => w(p) >= w(set) - EPS);
  const top = best(atOrAbove, measure, higher);
  if (top && higher(value, top.value)) return { kind, before: top.set, beforeValue: top.value, after: value };
  return null;
}

function cardio(prior: WorkoutSet[], set: WorkoutSet): Candidate | null {
  const dist = set.distanceM;
  const dur = set.durationSec;
  if (dist != null && dist > 0) {
    const far = best(prior, (p) => p.distanceM, higher);
    if (far && higher(dist, far.value)) return { kind: 'distance', before: far.set, beforeValue: far.value, after: dist };
    if (dur != null && dur > 0) {
      // Fastest pace (sec per metre) among efforts at least this long.
      const pace = dur / dist;
      const comparable = prior.filter((p) => p.distanceM != null && p.distanceM >= dist - EPS);
      const fast = best(comparable, (p) => (p.durationSec && p.distanceM ? p.durationSec / p.distanceM : null), lower);
      if (fast && lower(pace, fast.value)) return { kind: 'pace', before: fast.set, beforeValue: fast.value, after: pace };
    }
  }
  if (dur != null && dur > 0) {
    const long = best(prior, (p) => p.durationSec, higher);
    if (long && higher(dur, long.value)) return { kind: 'duration', before: long.set, beforeValue: long.value, after: dur };
  }
  return null;
}

/** Is `set` a record against `prior` (already filtered to eligible sets of the same exercise)? */
export function detectRecord(type: ExerciseType, prior: WorkoutSet[], set: WorkoutSet): Candidate | null {
  switch (type) {
    case 'weight_reps':
    case 'bodyweight_reps':
      return weightThen(prior, set, (s) => s.reps, 'reps');
    case 'timed':
      return weightThen(prior, set, (s) => s.durationSec, 'duration');
    case 'cardio':
      return cardio(prior, set);
  }
}

/**
 * All record events for one exercise. Sets of other exercises are ignored even if passed in.
 * The old app compared across exercises and showed false records; this can't.
 */
export function computeRecords(exerciseId: string, type: ExerciseType, sets: WorkoutSet[]): RecordEvent[] {
  const ordered = sets.filter((s) => s.exerciseId === exerciseId && isEligible(s)).sort(compareChrono);
  const events: RecordEvent[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const set = ordered[i]!;
    const hit = detectRecord(type, ordered.slice(0, i), set);
    if (!hit) continue;
    events.push({
      id: `rec:${set.id}`,
      setId: set.id,
      exerciseId,
      kind: hit.kind,
      before: { value: hit.beforeValue, setId: hit.before.id, dayKey: hit.before.dayKey },
      after: { value: hit.after },
      atWeightKg: hit.kind === 'weight' || hit.kind === 'reps' || hit.kind === 'duration' ? w(set) : null,
      dayKey: set.dayKey,
      at: set.loggedAt!,
    });
  }
  return events;
}

export interface Bests {
  maxWeight: WorkoutSet | null;
  /** Most reps ever, with the weight it was done at. */
  maxReps: WorkoutSet | null;
}

/** Numbers for the records popover (SPEC N2 trophy popover). */
export function bests(exerciseId: string, sets: WorkoutSet[]): Bests {
  const mine = sets.filter((s) => s.exerciseId === exerciseId && isEligible(s)).sort(compareChrono);
  let maxWeight: WorkoutSet | null = null;
  let maxReps: WorkoutSet | null = null;
  for (const s of mine) {
    if (s.reps == null) continue;
    if (!maxWeight || higher(w(s), w(maxWeight)) || (Math.abs(w(s) - w(maxWeight)) <= EPS && s.reps > (maxWeight.reps ?? 0)))
      maxWeight = s;
    if (!maxReps || s.reps > (maxReps.reps ?? 0) || (s.reps === maxReps.reps && higher(w(s), w(maxReps)))) maxReps = s;
  }
  return { maxWeight, maxReps };
}

/** Best reps ever at exactly this weight (kg), or null if never done. */
export function bestRepsAt(exerciseId: string, sets: WorkoutSet[], weightKg: number): number | null {
  let top: number | null = null;
  for (const s of sets) {
    if (s.exerciseId !== exerciseId || !isEligible(s) || s.reps == null) continue;
    if (Math.abs(w(s) - weightKg) > EPS) continue;
    if (top == null || s.reps > top) top = s.reps;
  }
  return top;
}

/** Epley estimated 1RM (charts only, SPEC A1). */
export function estimate1RM(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return weightKg * (1 + reps / 30);
}
