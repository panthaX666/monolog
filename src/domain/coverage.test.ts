import { describe, expect, it } from 'vitest';
import { computeCoverage, type CoverageSession } from './coverage';
import type { Muscle } from './types';

const ex = (primaryMuscles: Muscle[], secondaryMuscles: Muscle[] = []) => ({ primaryMuscles, secondaryMuscles });
const bench = ex(['chest'], ['triceps', 'front_delts']);
const pushdown = ex(['triceps']);
const squat = ex(['quads', 'glutes'], ['hamstrings', 'lower_back']);
const TODAY = '2026-09-30'; // Wednesday; week = Mon 28 Sep – Sun 4 Oct

const byGroup = (sessions: CoverageSession[]) =>
  Object.fromEntries(computeCoverage(sessions, TODAY).map((g) => [g.group, g]));

describe('coverage', () => {
  it('primary = 1 per session, however many exercises or sets hit it', () => {
    const c = byGroup([{ dayKey: '2026-09-28', exercises: [bench, bench, pushdown] }]);
    expect(c.chest!.sessions).toBe(1);
    expect(c.arms!.sessions).toBe(1); // pushdown primary beats bench's secondary triceps
  });

  it('secondary-only = ½', () => {
    const c = byGroup([{ dayKey: '2026-09-28', exercises: [bench] }]);
    expect(c.arms!.sessions).toBe(0.5);
    expect(c.shoulders!.sessions).toBe(0.5);
    expect(c.arms!.lastTrained).toBeNull(); // secondary work doesn't set "last trained"
  });

  it('only counts Monday–Sunday of the current week', () => {
    const c = byGroup([
      { dayKey: '2026-09-27', exercises: [bench] }, // last Sunday
      { dayKey: '2026-09-28', exercises: [bench] },
      { dayKey: '2026-09-30', exercises: [bench, squat] },
    ]);
    expect(c.chest!.sessions).toBe(2);
    expect(c.legs!.sessions).toBe(1);
    expect(c.back!.sessions).toBe(0.5); // lower_back secondary from squat
  });

  it('reports last trained and days since, across weeks', () => {
    const c = byGroup([
      { dayKey: '2026-09-21', exercises: [squat] },
      { dayKey: '2026-09-28', exercises: [bench] },
    ]);
    expect(c.legs).toMatchObject({ sessions: 0, lastTrained: '2026-09-21', daysSince: 9 });
    expect(c.chest).toMatchObject({ lastTrained: '2026-09-28', daysSince: 2 });
    expect(c.core).toMatchObject({ sessions: 0, lastTrained: null, daysSince: null });
  });
});
