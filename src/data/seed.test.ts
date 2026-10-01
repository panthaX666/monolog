import { describe, expect, it } from 'vitest';
import { EQUIPMENT, MUSCLES } from '../domain/muscles';
import { nameKey, seedExercises } from './seed';

const lib = seedExercises('2026-10-01T00:00:00.000Z');

describe('seed library', () => {
  it('has a useful starter set', () => {
    expect(lib.length).toBeGreaterThanOrEqual(80);
  });

  it('names and ids are unique', () => {
    expect(new Set(lib.map((e) => e.nameKey)).size).toBe(lib.length);
    expect(new Set(lib.map((e) => e.id)).size).toBe(lib.length);
  });

  it('uses only known muscles and equipment; strength exercises have a primary muscle', () => {
    for (const e of lib) {
      for (const m of [...e.primaryMuscles, ...e.secondaryMuscles]) expect(MUSCLES).toContain(m);
      for (const q of e.equipment) expect(EQUIPMENT).toContain(q);
      expect(e.equipment.length).toBeGreaterThan(0);
      if (e.type !== 'cardio') expect(e.primaryMuscles.length, e.name).toBeGreaterThan(0);
      // A muscle is either primary or secondary, never both.
      expect(e.primaryMuscles.filter((m) => e.secondaryMuscles.includes(m)), e.name).toEqual([]);
    }
  });

  it("includes the exercises from my old app", () => {
    const names = new Set(lib.map((e) => e.nameKey));
    for (const n of [
      'Bench Press', 'Pec Fly', 'Chest Press', 'Deadlift', 'Lat Pulldown', 'Seated Cable Row', 'Squat',
      'Smith Machine Squat', 'Leg Press', 'Dumbbell Lateral Raise', 'Shoulder Press', 'Front Raise',
      'Barbell Curl', 'Dumbbell Curl', 'Tricep Pushdown', 'Rope Tricep Pushdown', 'Cable Lateral Raise',
      'Plank', 'Sit-up', 'Decline Crunch',
    ]) {
      expect(names.has(nameKey(n)), n).toBe(true);
    }
  });

  it('nameKey normalises case and spacing', () => {
    expect(nameKey('  Bench   PRESS ')).toBe('bench press');
  });
});
