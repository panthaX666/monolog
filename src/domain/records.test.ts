import { describe, expect, it } from 'vitest';
import { bestRepsAt, bests, computeRecords, estimate1RM } from './records';
import { mkSet, wr } from './testkit';

const PUSH = 'rope-tricep-pushdown';
const RAISE = 'cable-lat-raise';

// My real Rope Tricep Pushdown history from the old app (Sept 2026).
const pushdownHistory = () => [
  wr(PUSH, '2026-09-16', 50, 9),
  wr(PUSH, '2026-09-16', 50, 4),
  wr(PUSH, '2026-09-18', 40, 10),
  wr(PUSH, '2026-09-18', 40, 12),
  wr(PUSH, '2026-09-22', 50, 8),
  wr(PUSH, '2026-09-22', 50, 9),
  wr(PUSH, '2026-09-24', 40, 12),
  wr(PUSH, '2026-09-24', 40, 12),
  wr(PUSH, '2026-09-28', 45, 10),
  wr(PUSH, '2026-09-28', 45, 8),
];
const eventFor = (events: ReturnType<typeof computeRecords>, setId: string) => events.find((e) => e.setId === setId);

describe('records: weight × reps', () => {
  it('the first ever set is not a record (nothing to beat)', () => {
    expect(computeRecords(PUSH, 'weight_reps', [wr(PUSH, '2026-09-01', 40, 10)])).toEqual([]);
  });

  it('matching last session is not a record; one more rep at or above that weight is', () => {
    const today = [wr(PUSH, '2026-09-30', 45, 10, { id: 'a' }), wr(PUSH, '2026-09-30', 45, 11, { id: 'b' })];
    const events = computeRecords(PUSH, 'weight_reps', [...pushdownHistory(), ...today]);
    expect(eventFor(events, 'a')).toBeUndefined();
    expect(eventFor(events, 'b')).toMatchObject({ kind: 'reps', before: { value: 10 }, after: { value: 11 }, atWeightKg: 45 });
  });

  it('reps only beat sets at the same weight or heavier (45×9 is not a record after 50×9)', () => {
    const events = computeRecords(PUSH, 'weight_reps', [...pushdownHistory(), wr(PUSH, '2026-09-30', 45, 9, { id: 'x' })]);
    expect(eventFor(events, 'x')).toBeUndefined();
  });

  it('more reps at a lighter weight than ever done is a record only if it beats heavier sets too', () => {
    // 42.5 × 11: heavier sets top out at 10 reps (45×10) → record.
    const events = computeRecords(PUSH, 'weight_reps', [...pushdownHistory(), wr(PUSH, '2026-09-30', 42.5, 11, { id: 'y' })]);
    expect(eventFor(events, 'y')).toMatchObject({ kind: 'reps', before: { value: 10 } });
  });

  it('heavier than ever is a weight record (and wins over a rep record)', () => {
    const events = computeRecords(PUSH, 'weight_reps', [...pushdownHistory(), wr(PUSH, '2026-09-30', 52.5, 12, { id: 'h' })]);
    expect(eventFor(events, 'h')).toMatchObject({ kind: 'weight', before: { value: 50 }, after: { value: 52.5 } });
  });

  it('ignores warm-ups and pre-filled (unlogged) sets entirely', () => {
    const sets = [
      ...pushdownHistory(),
      wr(PUSH, '2026-09-30', 60, 5, { kind: 'warmup', id: 'warm' }),
      wr(PUSH, '2026-09-30', 55, 5, { loggedAt: null, id: 'ghost' }),
      wr(PUSH, '2026-09-30', 52.5, 5, { id: 'real' }),
    ];
    const events = computeRecords(PUSH, 'weight_reps', sets);
    expect(eventFor(events, 'warm')).toBeUndefined();
    expect(eventFor(events, 'ghost')).toBeUndefined();
    // The 60 kg warm-up must not raise the bar: 52.5 is still a weight record over 50.
    expect(eventFor(events, 'real')).toMatchObject({ kind: 'weight', before: { value: 50 } });
  });

  it('REGRESSION (old app bug): never compares against another exercise', () => {
    // Old app: logging Cable Lat Raise 20×7 showed "NEW RECORD 24.0 → 56.25 kg". The 56.25 came from
    // Rope Tricep Pushdown 45×10. Mixed input must produce no lat-raise record here.
    const raise = [
      wr(RAISE, '2025-11-03', 20, 8),
      wr(RAISE, '2026-01-06', 15, 15),
      wr(RAISE, '2026-09-24', 20, 6),
      wr(RAISE, '2026-09-24', 15, 12),
      wr(RAISE, '2026-09-30', 20, 7, { id: 'raise-today' }),
    ];
    const mixed = [...pushdownHistory(), wr(PUSH, '2026-09-30', 45, 11), ...raise];
    const raiseEvents = computeRecords(RAISE, 'weight_reps', mixed);
    // 20×7 is below the 20×8 best, no record today.
    expect(eventFor(raiseEvents, 'raise-today')).toBeUndefined();
    // Only lat-raise sets ever appear as "before"/"after", nothing near the pushdown's 45 kg.
    expect(raiseEvents.every((e) => e.exerciseId === RAISE && (e.atWeightKg ?? 0) <= 20)).toBe(true);
    // The one genuine lat-raise record: 15×15 in Jan beat 8 reps at ≥15 kg.
    expect(raiseEvents.map((e) => [e.kind, e.after.value])).toEqual([['reps', 15]]);
    const pushEvents = computeRecords(PUSH, 'weight_reps', mixed);
    expect(pushEvents.every((e) => e.exerciseId === PUSH)).toBe(true);
  });

  it('compares in kg regardless of the unit typed', () => {
    const sets = [wr(PUSH, '2026-09-01', 45, 8), wr(PUSH, '2026-09-02', 100, 5, { unit: 'lb', id: 'lb' })];
    // 100 lb = 45.36 kg > 45 kg
    expect(eventFor(computeRecords(PUSH, 'weight_reps', sets), 'lb')).toMatchObject({ kind: 'weight', before: { value: 45 } });
  });

  it('orders by training day, so a set added later to an old session compares against its own past', () => {
    const sets = [
      wr(PUSH, '2026-09-20', 40, 10, { id: 'old', loggedAt: '2026-09-20T10:00:00Z' }),
      wr(PUSH, '2026-09-25', 40, 12, { id: 'mid', loggedAt: '2026-09-25T10:00:00Z' }),
      // Edited on the 30th, but belongs to the 21st, before 'mid'.
      wr(PUSH, '2026-09-21', 40, 11, { id: 'edit', loggedAt: '2026-09-30T10:00:00Z' }),
    ];
    const events = computeRecords(PUSH, 'weight_reps', sets);
    expect(eventFor(events, 'edit')).toMatchObject({ kind: 'reps', before: { value: 10 } });
    expect(eventFor(events, 'mid')).toMatchObject({ kind: 'reps', before: { value: 11 } });
  });

  it('recomputes cleanly after a record set is deleted', () => {
    const a = wr(PUSH, '2026-09-01', 40, 10, { id: 'a' });
    const b = wr(PUSH, '2026-09-02', 40, 12, { id: 'b' });
    const c = wr(PUSH, '2026-09-03', 40, 11, { id: 'c' });
    expect(computeRecords(PUSH, 'weight_reps', [a, b, c]).map((e) => e.setId)).toEqual(['b']);
    // Delete b → c now beats a.
    expect(computeRecords(PUSH, 'weight_reps', [a, c]).map((e) => e.setId)).toEqual(['c']);
  });

  it('ids are deterministic (one record per set)', () => {
    const events = computeRecords(PUSH, 'weight_reps', [...pushdownHistory(), wr(PUSH, '2026-09-30', 45, 11, { id: 'z' })]);
    expect(eventFor(events, 'z')?.id).toBe('rec:z');
  });
});

describe('records: bodyweight, timed, cardio', () => {
  const PULL = 'pull-up';
  it('bodyweight: more reps at +0, then added weight', () => {
    const sets = [
      mkSet({ exerciseId: PULL, dayKey: '2026-09-01', weight: 0, reps: 8 }),
      mkSet({ exerciseId: PULL, dayKey: '2026-09-02', weight: 0, reps: 10, id: 'more' }),
      mkSet({ exerciseId: PULL, dayKey: '2026-09-03', weight: 5, reps: 5, id: 'added' }),
      mkSet({ exerciseId: PULL, dayKey: '2026-09-04', weight: null, reps: 11, id: 'nullAdded' }),
    ];
    const events = computeRecords(PULL, 'bodyweight_reps', sets);
    expect(eventFor(events, 'more')?.kind).toBe('reps');
    expect(eventFor(events, 'added')).toMatchObject({ kind: 'weight', before: { value: 0 }, after: { value: 5 } });
    expect(eventFor(events, 'nullAdded')).toMatchObject({ kind: 'reps', before: { value: 10 } }); // null added = 0
  });

  it('timed: longer hold at the same or heavier weight', () => {
    const PLANK = 'plank';
    const sets = [
      mkSet({ exerciseId: PLANK, dayKey: '2026-09-01', durationSec: 60 }),
      mkSet({ exerciseId: PLANK, dayKey: '2026-09-02', durationSec: 90, id: 'longer' }),
      mkSet({ exerciseId: PLANK, dayKey: '2026-09-03', durationSec: 80, id: 'shorter' }),
    ];
    const events = computeRecords(PLANK, 'timed', sets);
    expect(eventFor(events, 'longer')).toMatchObject({ kind: 'duration', before: { value: 60 }, after: { value: 90 } });
    expect(eventFor(events, 'shorter')).toBeUndefined();
  });

  it('cardio: distance, then pace (vs efforts at least as long), then time', () => {
    const RUN = 'treadmill';
    const sets = [
      mkSet({ exerciseId: RUN, dayKey: '2026-09-01', distanceM: 5000, durationSec: 1800 }), // 6:00/km
      mkSet({ exerciseId: RUN, dayKey: '2026-09-02', distanceM: 6000, durationSec: 2400, id: 'far' }),
      mkSet({ exerciseId: RUN, dayKey: '2026-09-03', distanceM: 5000, durationSec: 1650, id: 'fast' }), // 5:30/km
      mkSet({ exerciseId: RUN, dayKey: '2026-09-04', distanceM: 1000, durationSec: 240, id: 'shortFast' }), // 4:00/km but short
      mkSet({ exerciseId: RUN, dayKey: '2026-09-05', durationSec: 2700, id: 'long' }), // time only
    ];
    const events = computeRecords(RUN, 'cardio', sets);
    expect(eventFor(events, 'far')?.kind).toBe('distance');
    expect(eventFor(events, 'fast')).toMatchObject({ kind: 'pace', before: { value: 0.36 } });
    // Never before covered ≥ 1 km faster than 5:30/km → a genuine pace record for that distance.
    expect(eventFor(events, 'shortFast')).toMatchObject({ kind: 'pace', after: { value: 0.24 } });
    expect(eventFor(events, 'long')).toMatchObject({ kind: 'duration', before: { value: 2400 } });
  });
});

describe('bests & helpers', () => {
  it('max weight (with its reps) and max reps (with its weight)', () => {
    const b = bests(PUSH, pushdownHistory());
    expect([b.maxWeight?.weightKg, b.maxWeight?.reps]).toEqual([50, 9]);
    expect([b.maxReps?.reps, b.maxReps?.weightKg]).toEqual([12, 40]);
  });

  it('best reps at an exact weight', () => {
    expect(bestRepsAt(PUSH, pushdownHistory(), 45)).toBe(10);
    expect(bestRepsAt(PUSH, pushdownHistory(), 47.5)).toBeNull();
  });

  it('Epley 1RM', () => {
    expect(estimate1RM(45, 10)).toBeCloseTo(60, 6);
    expect(estimate1RM(100, 1)).toBe(100);
  });
});
