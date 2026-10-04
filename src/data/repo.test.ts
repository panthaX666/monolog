import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MonologDB } from './db';
import {
  addExerciseToSession,
  addSet,
  clearBodyMetric,
  createExercise,
  deleteSet,
  discardSession,
  ensureReady,
  finishSession,
  getCoverage,
  getOpenSession,
  getSettings,
  getStreak,
  logRestDay,
  logSet,
  recentRecords,
  removeExerciseFromSession,
  reorderSessionExercises,
  repeatSession,
  RepoError,
  restoreSet,
  saveBodyEntry,
  setArchived,
  startSession,
  tidySession,
  unlogSet,
  updateExercise,
  updateSet,
} from './repo';

let db: MonologDB;
const PUSH = 'seed:rope-tricep-pushdown';
const RAISE = 'seed:cable-lateral-raise';
const PLANK = 'seed:plank';

/** Local time on a given day (keeps dayKey stable in any timezone). */
const at = (day: string, hh = 10, mm = 0) => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, hh, mm);
};

/** Run a whole workout: exercise → [[weight, reps], …], all logged. */
async function workout(day: string, plan: Record<string, [number, number][]>) {
  const session = await startSession(db, at(day, 9));
  let minute = 0;
  for (const [exerciseId, sets] of Object.entries(plan)) {
    const { sessionExercise } = await addExerciseToSession(db, session.id, exerciseId);
    let current = (await db.sets.where('sessionExerciseId').equals(sessionExercise.id).sortBy('order'))[0]!;
    for (let i = 0; i < sets.length; i++) {
      const [weight, reps] = sets[i]!;
      await updateSet(db, current.id, { weight, reps });
      const res = await logSet(db, current.id, at(day, 10, minute++));
      current = res.appended!;
    }
  }
  await finishSession(db, session.id, at(day, 11));
  return session;
}

beforeEach(async () => {
  db = new MonologDB(`test-${crypto.randomUUID()}`);
  await ensureReady(db, at('2026-09-01'));
});
afterEach(async () => {
  db.close();
  await db.delete();
});

describe('setup', () => {
  it('seeds settings and the library once, and adds new library exercises later without duplicates', async () => {
    const n = await db.exercises.count();
    expect(n).toBeGreaterThanOrEqual(80);
    expect((await getSettings(db)).unit).toBe('kg');
    await db.exercises.delete('seed:plank');
    await ensureReady(db);
    expect(await db.exercises.count()).toBe(n);
  });
});

describe('exercises', () => {
  it('creates custom exercises with unique names (case-insensitive)', async () => {
    const ex = await createExercise(db, { name: '  Cable  Y Raise ', type: 'weight_reps', primaryMuscles: ['side_delts'] });
    expect(ex).toMatchObject({ name: 'Cable Y Raise', nameKey: 'cable y raise', isCustom: true });
    await expect(createExercise(db, { name: 'cable y raise', type: 'weight_reps' })).rejects.toMatchObject({
      code: 'duplicate_name',
    });
    await expect(createExercise(db, { name: 'bench press', type: 'weight_reps' })).rejects.toBeInstanceOf(RepoError);
  });

  it('locks the type once sets are logged; archiving keeps history', async () => {
    await workout('2026-09-10', { [PUSH]: [[40, 10]] });
    await expect(updateExercise(db, PUSH, { type: 'timed' })).rejects.toMatchObject({ code: 'type_locked' });
    await setArchived(db, PUSH, true);
    expect((await db.exercises.get(PUSH))!.archivedAt).not.toBeNull();
    expect(await db.sets.where('exerciseId').equals(PUSH).count()).toBe(1);
  });
});

describe('workout flow', () => {
  it('pre-fills from the last session, appends a set after the last one is logged, drops ghosts on finish', async () => {
    await workout('2026-09-28', { [PUSH]: [[45, 10], [45, 8]] });

    const s = await startSession(db, at('2026-09-30', 9));
    const { sessionExercise, sets } = await addExerciseToSession(db, s.id, PUSH);
    expect(sets.map((x) => [x.weight, x.reps, x.loggedAt])).toEqual([
      [45, 10, null],
      [45, 8, null],
    ]);

    const r1 = await logSet(db, sets[0]!.id, at('2026-09-30', 10));
    expect(r1.appended).toBeNull(); // set 2 already exists
    await updateSet(db, sets[1]!.id, { reps: 11 });
    const r2 = await logSet(db, sets[1]!.id, at('2026-09-30', 10, 3));
    expect(r2.record).toMatchObject({ kind: 'reps', before: { value: 10 }, after: { value: 11 } });
    expect(r2.appended).toMatchObject({ weight: 45, reps: 11, loggedAt: null, order: 2 });

    await finishSession(db, s.id, at('2026-09-30', 11));
    const left = await db.sets.where('sessionExerciseId').equals(sessionExercise.id).toArray();
    expect(left).toHaveLength(2);
    expect(left.every((x) => x.loggedAt != null)).toBe(true);
    expect((await db.sessions.get(s.id))!.endedAt).not.toBeNull();
    expect((await getSettings(db)).workoutsSinceBackup).toBe(2);
  });

  it('only one open workout at a time; an empty workout is discarded on finish', async () => {
    const s = await startSession(db, at('2026-09-30'));
    await expect(startSession(db, at('2026-09-30'))).rejects.toMatchObject({ code: 'session_open' });
    await addExerciseToSession(db, s.id, PUSH);
    expect(await finishSession(db, s.id)).toEqual({ kept: false });
    expect(await db.sessions.count()).toBe(0);
    expect(await db.sets.count()).toBe(0);
  });

  it('discard deletes the workout, its sets and its records, leaving history intact', async () => {
    await workout('2026-09-28', { [PUSH]: [[45, 10]] });
    const s = await startSession(db, at('2026-09-30', 9));
    const { sets } = await addExerciseToSession(db, s.id, PUSH);
    await updateSet(db, sets[0]!.id, { reps: 12 });
    await logSet(db, sets[0]!.id, at('2026-09-30', 10));
    expect(await db.recordEvents.count()).toBe(1);

    expect(await discardSession(db, s.id)).toEqual({ deletedLoggedSets: 1 });
    expect(await db.sessions.get(s.id)).toBeUndefined();
    expect(await db.sets.where('sessionId').equals(s.id).count()).toBe(0);
    expect(await db.sessionExercises.where('sessionId').equals(s.id).count()).toBe(0);
    expect(await db.recordEvents.count()).toBe(0); // the 45×12 record went with it
    expect(await db.sets.count()).toBe(1); // 28 Sep untouched
    expect(await getOpenSession(db)).toBeUndefined();
    await expect(startSession(db, at('2026-09-30', 12))).resolves.toBeTruthy(); // can start again
  });

  it('discarding an empty workout', async () => {
    const s = await startSession(db, at('2026-09-30'));
    expect(await discardSession(db, s.id)).toEqual({ deletedLoggedSets: 0 });
    expect(await db.sessions.count()).toBe(0);
  });

  it('an open workout with exercises but nothing logged stays open until finished or discarded', async () => {
    const s = await startSession(db, at('2026-09-30'));
    await addExerciseToSession(db, s.id, PUSH);
    expect((await getOpenSession(db))?.id).toBe(s.id);
  });

  it('refuses to log an incomplete set', async () => {
    const s = await startSession(db, at('2026-09-30'));
    const { sets } = await addExerciseToSession(db, s.id, PUSH); // first time: one blank set
    await expect(logSet(db, sets[0]!.id)).rejects.toMatchObject({ code: 'incomplete_set' });
    const plank = await addExerciseToSession(db, s.id, PLANK);
    await updateSet(db, plank.sets[0]!.id, { durationSec: 60 });
    await expect(logSet(db, plank.sets[0]!.id)).resolves.toBeTruthy();
  });

  it('stores weight as typed and normalises to kg for comparisons', async () => {
    const s = await startSession(db, at('2026-09-30'));
    const { sets } = await addExerciseToSession(db, s.id, PUSH);
    const saved = await updateSet(db, sets[0]!.id, { weight: 100, unit: 'lb', reps: 8 });
    expect(saved).toMatchObject({ weight: 100, unit: 'lb' });
    expect(saved.weightKg).toBeCloseTo(45.359, 3);
  });

  it('uses the per-exercise unit for new sets', async () => {
    await updateExercise(db, RAISE, { unit: 'lb' });
    const s = await startSession(db, at('2026-09-30'));
    const { sets } = await addExerciseToSession(db, s.id, RAISE);
    expect(sets[0]!.unit).toBe('lb');
  });
});

describe('records in the database', () => {
  it('REGRESSION: logging one exercise never produces a record from another', async () => {
    await workout('2025-11-03', { [RAISE]: [[20, 8]] });
    await workout('2026-09-28', { [PUSH]: [[45, 10], [45, 8]] });
    const s = await startSession(db, at('2026-09-30', 9));
    const push = await addExerciseToSession(db, s.id, PUSH);
    await logSet(db, push.sets[0]!.id, at('2026-09-30', 10)); // 45×10
    const raise = await addExerciseToSession(db, s.id, RAISE);
    await updateSet(db, raise.sets[0]!.id, { weight: 20, reps: 7 });
    const res = await logSet(db, raise.sets[0]!.id, at('2026-09-30', 10, 5));
    expect(res.record).toBeNull();
    expect(await db.recordEvents.where('exerciseId').equals(RAISE).count()).toBe(0);
  });

  it('un-logging, deleting and undoing recompute records', async () => {
    await workout('2026-09-28', { [PUSH]: [[45, 10]] });
    const s = await startSession(db, at('2026-09-30', 9));
    const { sets } = await addExerciseToSession(db, s.id, PUSH);
    await updateSet(db, sets[0]!.id, { reps: 12 });
    const { record } = await logSet(db, sets[0]!.id, at('2026-09-30', 10));
    expect(record?.kind).toBe('reps');
    expect(await db.recordEvents.count()).toBe(1);

    await unlogSet(db, sets[0]!.id);
    expect(await db.recordEvents.count()).toBe(0);

    await logSet(db, sets[0]!.id, at('2026-09-30', 10, 1));
    const removed = await deleteSet(db, sets[0]!.id);
    expect(await db.recordEvents.count()).toBe(0);

    await restoreSet(db, removed);
    expect(await db.recordEvents.count()).toBe(1);
    expect((await db.sets.get(removed.id))!.order).toBe(0);
  });

  it('editing a logged set recomputes; warm-ups never count', async () => {
    await workout('2026-09-28', { [PUSH]: [[45, 10]] });
    const s = await startSession(db, at('2026-09-30', 9));
    const { sets } = await addExerciseToSession(db, s.id, PUSH);
    await updateSet(db, sets[0]!.id, { weight: 60, reps: 5 });
    expect((await logSet(db, sets[0]!.id, at('2026-09-30', 10))).record?.kind).toBe('weight');
    await updateSet(db, sets[0]!.id, { kind: 'warmup', toFailure: true });
    expect(await db.recordEvents.count()).toBe(0);
    expect((await db.sets.get(sets[0]!.id))!.toFailure).toBe(false); // warm-ups can't be "to failure"
  });

  it('removing an exercise card recomputes its records; recent records are newest first', async () => {
    await workout('2026-09-20', { [PUSH]: [[40, 10]], [RAISE]: [[10, 10]] });
    await workout('2026-09-24', { [RAISE]: [[12.5, 10]] });
    await workout('2026-09-26', { [PUSH]: [[40, 12]] });
    expect((await recentRecords(db)).map((r) => r.exerciseId)).toEqual([PUSH, RAISE]);

    // Remove the 26 Sep pushdown card (the 40×12 record) → no pushdown records remain.
    const lastPushSession = (await db.sessions.where('dayKey').equals('2026-09-26').first())!;
    const card = (await db.sessionExercises.where('sessionId').equals(lastPushSession.id).first())!;
    await removeExerciseFromSession(db, card.id);
    expect(await db.recordEvents.where('exerciseId').equals(PUSH).count()).toBe(0);
    expect(await db.recordEvents.where('exerciseId').equals(RAISE).count()).toBe(1);
  });

  it('reorders the exercises in a workout and refuses a stale list', async () => {
    const s = await startSession(db, at('2026-09-30'));
    const a = (await addExerciseToSession(db, s.id, PUSH)).sessionExercise;
    const b = (await addExerciseToSession(db, s.id, RAISE)).sessionExercise;
    await reorderSessionExercises(db, s.id, [b.id, a.id]);
    const order = (await db.sessionExercises.where('sessionId').equals(s.id).sortBy('order')).map((x) => x.id);
    expect(order).toEqual([b.id, a.id]);
    await expect(reorderSessionExercises(db, s.id, [a.id])).rejects.toThrow(/changed/);
  });

  it('"＋ Add set" copies the last set as a working set', async () => {
    const s = await startSession(db, at('2026-09-30'));
    const { sessionExercise, sets } = await addExerciseToSession(db, s.id, PUSH);
    await updateSet(db, sets[0]!.id, { weight: 20, reps: 12, kind: 'warmup' });
    const added = await addSet(db, sessionExercise.id);
    expect(added).toMatchObject({ weight: 20, reps: 12, kind: 'working', order: 1, loggedAt: null });
  });
});

describe('streak, rest days, coverage', () => {
  it('rest days: today or yesterday only, never on a trained day; streak counts them', async () => {
    await workout('2026-09-27', { [PUSH]: [[40, 10]] });
    await workout('2026-09-28', { [PUSH]: [[40, 10]] });
    const now = at('2026-09-30', 20);
    await expect(logRestDay(db, '2026-09-28', now)).rejects.toMatchObject({ code: 'rest_day_not_allowed' });
    await expect(logRestDay(db, '2026-09-26', now)).rejects.toMatchObject({ code: 'rest_day_not_allowed' });
    await logRestDay(db, '2026-09-29', now); // yesterday, within grace
    await logRestDay(db, '2026-09-30', now);
    expect(await getStreak(db, now)).toMatchObject({ current: 4, restRun: 2, todayDone: true });
  });

  it('warm-up-only days do not count as trained', async () => {
    const s = await startSession(db, at('2026-09-30', 9));
    const { sets } = await addExerciseToSession(db, s.id, PUSH);
    await updateSet(db, sets[0]!.id, { weight: 20, reps: 10, kind: 'warmup' });
    await logSet(db, sets[0]!.id, at('2026-09-30', 10));
    expect((await getStreak(db, at('2026-09-30', 20))).current).toBe(0);
  });

  it('weekly coverage from logged sessions', async () => {
    await workout('2026-09-28', { 'seed:bench-press': [[60, 8]], [PUSH]: [[40, 10]] });
    await workout('2026-09-30', { 'seed:squat': [[80, 5]] });
    const cov = Object.fromEntries((await getCoverage(db, at('2026-09-30', 20))).map((c) => [c.group, c.sessions]));
    expect(cov).toMatchObject({ chest: 1, arms: 1, legs: 1, shoulders: 0.5, back: 0.5, core: 0 });
  });
});

describe('body entries', () => {
  it('one entry per day; saving again merges', async () => {
    await saveBodyEntry(db, '2026-09-30', { weightKg: 82.4 });
    await saveBodyEntry(db, '2026-09-30', { bodyFatPct: 18.2 });
    const all = await db.bodyEntries.toArray();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ weightKg: 82.4, bodyFatPct: 18.2 });
    await expect(saveBodyEntry(db, '2026-09-30', { bodyFatPct: 120 })).rejects.toMatchObject({ code: 'invalid' });
  });
});

describe('editing the past & repeat', () => {
  it('adding an exercise to an old workout pre-fills from the session before it, not a later one', async () => {
    const old = await workout('2026-09-20', { [PUSH]: [[40, 10]] });
    await workout('2026-09-10', { [RAISE]: [[10, 12]] });
    await workout('2026-09-28', { [RAISE]: [[15, 8]] });
    const { sets } = await addExerciseToSession(db, old.id, RAISE);
    expect(sets.map((s) => [s.weight, s.reps])).toEqual([[10, 12]]);
  });

  it('tidySession drops un-logged sets and empty cards, and deletes a workout left empty', async () => {
    const s = await workout('2026-09-20', { [PUSH]: [[40, 10]] });
    const { sessionExercise } = await addExerciseToSession(db, s.id, RAISE); // ghost only
    expect(await tidySession(db, s.id)).toEqual({ kept: true });
    expect(await db.sessionExercises.get(sessionExercise.id)).toBeUndefined();
    expect(await db.sets.where('sessionId').equals(s.id).count()).toBe(1);

    const only = (await db.sets.where('sessionId').equals(s.id).first())!;
    await deleteSet(db, only.id);
    expect(await tidySession(db, s.id)).toEqual({ kept: false });
    expect(await db.sessions.get(s.id)).toBeUndefined();
  });

  it('tidySession never touches the live workout', async () => {
    const s = await startSession(db, at('2026-09-30'));
    await addExerciseToSession(db, s.id, PUSH);
    expect(await tidySession(db, s.id)).toEqual({ kept: true });
    expect(await db.sets.where('sessionId').equals(s.id).count()).toBe(1);
  });

  it('repeat copies exercises in order with that session’s sets as pre-fill', async () => {
    const from = await workout('2026-09-20', { [RAISE]: [[10, 12], [10, 10]], [PUSH]: [[40, 10]] });
    await workout('2026-09-25', { [PUSH]: [[50, 5]] }); // later numbers must NOT be used
    const s = await repeatSession(db, from.id, at('2026-09-30', 9));
    expect(s.repeatedFrom).toBe(from.id);
    const ses = await db.sessionExercises.where('sessionId').equals(s.id).sortBy('order');
    expect(ses.map((x) => x.exerciseId)).toEqual([RAISE, PUSH]);
    const pushSets = await db.sets.where('sessionExerciseId').equals(ses[1]!.id).toArray();
    expect(pushSets.map((x) => [x.weight, x.reps, x.loggedAt])).toEqual([[40, 10, null]]);
    await expect(repeatSession(db, from.id)).rejects.toMatchObject({ code: 'session_open' });
  });
});

describe('clearBodyMetric', () => {
  it('clears one metric, and deletes the check-in when it becomes empty', async () => {
    const e = await saveBodyEntry(db, '2026-09-30', { weightKg: 82.4, bodyFatPct: 18 });
    await clearBodyMetric(db, e.id, 'bodyFatPct');
    expect(await db.bodyEntries.get(e.id)).toMatchObject({ weightKg: 82.4, bodyFatPct: null });
    await clearBodyMetric(db, e.id, 'weightKg');
    expect(await db.bodyEntries.get(e.id)).toBeUndefined();
  });
});
