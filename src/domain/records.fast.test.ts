import { describe, expect, it } from 'vitest';
import { compareChrono, computeRecords, detectRecord, isEligible } from './records';
import { mkSet } from './testkit';
import type { ExerciseType, WorkoutSet } from './types';

// computeRecords keeps running bests instead of re-scanning history. It must give exactly the same
// records as checking every set against all earlier ones (the rule as written).

function slow(type: ExerciseType, sets: WorkoutSet[]) {
  const ordered = sets.filter(isEligible).sort(compareChrono);
  return ordered.flatMap((set, i) => {
    const hit = detectRecord(type, ordered.slice(0, i), set);
    return hit ? [{ setId: set.id, kind: hit.kind, before: hit.before.id, value: hit.after }] : [];
  });
}

/** Deterministic pseudo-random numbers. */
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

function history(type: ExerciseType, seed: number, n: number): WorkoutSet[] {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const day = new Date(Date.UTC(2024, 0, 1 + Math.floor(i / 6))).toISOString().slice(0, 10);
    const weight = Math.round(r() * 24) * 2.5;
    return mkSet({
      exerciseId: 'x',
      dayKey: day,
      weight: type === 'timed' && r() < 0.5 ? 0 : weight,
      reps: type === 'timed' ? null : 1 + Math.floor(r() * 15),
      durationSec: type === 'timed' ? 10 + Math.floor(r() * 120) : null,
      kind: r() < 0.15 ? 'warmup' : 'working',
      loggedAt: r() < 0.05 ? null : `${day}T10:${String(i % 60).padStart(2, '0')}:00.000Z`,
    });
  });
}

describe('fast records match the slow rule', () => {
  for (const type of ['weight_reps', 'bodyweight_reps', 'timed'] as const)
    for (const seed of [1, 7, 42, 99])
      it(`${type}, seed ${seed}`, () => {
        const sets = history(type, seed, 1500);
        const fast = computeRecords('x', type, sets).map((e) => ({
          setId: e.setId,
          kind: e.kind,
          before: e.before.setId,
          value: e.after.value,
        }));
        expect(fast).toEqual(slow(type, sets));
        expect(fast.length).toBeGreaterThan(5);
      });
});
