import { describe, expect, it } from 'vitest';
import { inRange, niceTicks, progressSeries, weeklySetsByGroup } from './progress';
import { mkSet, wr } from './testkit';
import type { Exercise, RecordEvent } from './types';

const P = 'push';
const sets = [
  wr(P, '2026-09-20', 40, 10, { sessionId: 'a' }),
  wr(P, '2026-09-20', 45, 6, { sessionId: 'a' }),
  wr(P, '2026-09-20', 60, 5, { sessionId: 'a', kind: 'warmup' }), // ignored
  wr(P, '2026-09-27', 45, 10, { sessionId: 'b', id: 'rec-set' }),
  wr(P, '2026-09-27', 45, 8, { sessionId: 'b' }),
];
const records = [{ setId: 'rec-set' } as RecordEvent];

describe('progressSeries', () => {
  it('one point per workout; warm-ups ignored; record workouts flagged', () => {
    const top = progressSeries('top', sets, records, 'kg');
    expect(top.map((p) => [p.day, p.value, p.record])).toEqual([
      ['2026-09-20', 45, false],
      ['2026-09-27', 45, true],
    ]);
  });

  it('Epley e1RM, volume, in the display unit', () => {
    expect(progressSeries('e1rm', sets, [], 'kg').map((p) => p.value)).toEqual([54, 60]); // 45×6 (54.0) beats 40×10 (53.3)
    expect(progressSeries('volume', sets, [], 'kg').map((p) => p.value)).toEqual([670, 810]);
    expect(progressSeries('top', sets, [], 'lb')[0]!.value).toBe(99.2);
  });

  it('timed, cardio and bodyweight metrics', () => {
    const t = [mkSet({ exerciseId: 'plank', dayKey: '2026-09-01', durationSec: 60, sessionId: 's1' }), mkSet({ exerciseId: 'plank', dayKey: '2026-09-01', durationSec: 75, sessionId: 's1' })];
    expect(progressSeries('hold', t, [], 'kg').map((p) => p.value)).toEqual([75]);
    expect(progressSeries('time', t, [], 'kg').map((p) => p.value)).toEqual([135]);
    const c = [
      mkSet({ exerciseId: 'run', dayKey: '2026-09-01', distanceM: 5000, durationSec: 1800, sessionId: 'r1' }),
      mkSet({ exerciseId: 'run', dayKey: '2026-09-03', durationSec: 1200, sessionId: 'r2' }), // time only
    ];
    expect(progressSeries('distance', c, [], 'kg').map((p) => p.value)).toEqual([5000]);
    expect(progressSeries('pace', c, [], 'kg').map((p) => p.value)).toEqual([0.36]);
    expect(progressSeries('time', c, [], 'kg').map((p) => p.value)).toEqual([1800, 1200]);
    const b = [mkSet({ exerciseId: 'pu', dayKey: '2026-09-01', reps: 8, weight: 0, sessionId: 'p' }), mkSet({ exerciseId: 'pu', dayKey: '2026-09-01', reps: 6, weight: 0, sessionId: 'p' })];
    expect(progressSeries('reps', b, [], 'kg')[0]!.value).toBe(8);
    expect(progressSeries('totalReps', b, [], 'kg')[0]!.value).toBe(14);
  });

  it('range filter', () => {
    const pts = [{ day: '2025-01-01' }, { day: '2026-08-01' }, { day: '2026-09-30' }];
    expect(inRange(pts, '3M', '2026-10-01')).toHaveLength(2);
    expect(inRange(pts, 'All', '2026-10-01')).toHaveLength(3);
  });
});

describe('weeklySetsByGroup', () => {
  const ex = (id: string, primaryMuscles: Exercise['primaryMuscles'], secondaryMuscles: Exercise['secondaryMuscles'] = []) =>
    [id, { id, primaryMuscles, secondaryMuscles } as Exercise] as const;
  const exercises = new Map([ex('bench', ['chest'], ['triceps']), ex('push', ['triceps'])]);
  it('counts working sets this week: primary 1, secondary ½', () => {
    const s = [
      wr('bench', '2026-09-28', 60, 8),
      wr('bench', '2026-09-28', 60, 8),
      wr('push', '2026-09-30', 40, 10),
      wr('bench', '2026-09-27', 60, 8), // last week
      wr('bench', '2026-09-29', 40, 8, { kind: 'warmup' }),
    ];
    const by = Object.fromEntries(weeklySetsByGroup(s, exercises, '2026-09-30').map((g) => [g.group, g.sets]));
    expect(by).toMatchObject({ chest: 2, arms: 2, back: 0 }); // arms: 1 (push) + ½ + ½ (bench)
  });
});

describe('niceTicks', () => {
  it('covers the range with round steps', () => {
    expect(niceTicks(52, 61, 4)).toEqual([50, 52.5, 55, 57.5, 60, 62.5]);
    expect(niceTicks(0, 1000, 4)).toEqual([0, 250, 500, 750, 1000]);
    const t = niceTicks(82.4, 82.4);
    expect(t[0]!).toBeLessThanOrEqual(82.4);
    expect(t[t.length - 1]!).toBeGreaterThanOrEqual(82.4);
  });
});
