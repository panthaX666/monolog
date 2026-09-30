import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { exportBackup, backupFileName, markBackedUp, parseBackup, previewBackup, restoreBackup } from './backup';
import { MonologDB, SCHEMA_VERSION } from './db';
import {
  addExerciseToSession,
  createExercise,
  ensureReady,
  finishSession,
  getSettings,
  logRestDay,
  logSet,
  saveBodyEntry,
  startSession,
  updateSet,
} from './repo';

const at = (day: string, hh = 10, mm = 0) => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, hh, mm);
};

let db: MonologDB;
const dbs: MonologDB[] = [];
const fresh = async () => {
  const d = new MonologDB(`test-${crypto.randomUUID()}`);
  dbs.push(d);
  await ensureReady(d, at('2026-09-01'));
  return d;
};

async function populate(d: MonologDB) {
  const custom = await createExercise(d, { name: 'Cable Y Raise', type: 'weight_reps', primaryMuscles: ['side_delts'] });
  for (const [day, reps] of [
    ['2026-09-28', 10],
    ['2026-09-30', 11],
  ] as const) {
    const s = await startSession(d, at(day, 9));
    const { sets } = await addExerciseToSession(d, s.id, 'seed:rope-tricep-pushdown');
    await updateSet(d, sets[0]!.id, { weight: 45, reps, note: day === '2026-09-28' ? 'elbow felt tight' : '' });
    await logSet(d, sets[0]!.id, at(day, 10));
    const y = await addExerciseToSession(d, s.id, custom.id);
    await updateSet(d, y.sets[0]!.id, { weight: 5, reps: 12 });
    await logSet(d, y.sets[0]!.id, at(day, 10, 5));
    await finishSession(d, s.id, at(day, 11));
  }
  await logRestDay(d, '2026-09-29', at('2026-09-29', 20));
  await saveBodyEntry(d, '2026-09-30', { weightKg: 82.4, bodyFatPct: 18.2 });
}

beforeEach(async () => {
  db = await fresh();
});
afterEach(async () => {
  for (const d of dbs.splice(0)) {
    d.close();
    await d.delete();
  }
});

describe('backup', () => {
  it('round-trips everything through JSON into a fresh device', async () => {
    await populate(db);
    const json = JSON.stringify(await exportBackup(db, at('2026-09-30', 21)));

    const other = await fresh();
    const parsed = parseBackup(json);
    expect(previewBackup(parsed)).toMatchObject({ workouts: 2, sets: 4, customExercises: 1, restDays: 1, bodyEntries: 1 });
    await restoreBackup(other, parsed);

    for (const t of ['exercises', 'sessions', 'sessionExercises', 'sets', 'restDays', 'bodyEntries', 'recordEvents'] as const) {
      const a = await db[t].toArray();
      const b = await other[t].toArray();
      const key = (r: object) => JSON.stringify(r);
      expect(b.map(key).sort(), t).toEqual(a.map(key).sort());
    }
    expect(await other.recordEvents.count()).toBe(1); // 45×11 rep record, rebuilt on restore
    expect((await other.sets.toArray()).some((s) => s.note === 'elbow felt tight')).toBe(true);
  });

  it('restore replaces existing data rather than merging', async () => {
    await populate(db);
    const backup = parseBackup(JSON.stringify(await exportBackup(db)));
    const other = await fresh();
    await createExercise(other, { name: 'Only On This Phone', type: 'weight_reps' });
    await restoreBackup(other, backup);
    expect(await other.exercises.where('nameKey').equals('only on this phone').count()).toBe(0);
  });

  it('rejects files that are not valid Monolog backups', async () => {
    const good = await exportBackup(db);
    const bad = (mutate: (b: typeof good) => unknown) => JSON.stringify(mutate(structuredClone(good)));
    expect(() => parseBackup('not json')).toThrow(/not JSON/);
    expect(() => parseBackup('{"app":"other"}')).toThrow(/not from Monolog/);
    expect(() => parseBackup(bad((b) => ({ ...b, schemaVersion: SCHEMA_VERSION + 1 })))).toThrow(/newer version/);
    expect(() =>
      parseBackup(
        bad((b) => {
          b.data.sets.push({ ...structuredClone(b.data.sets[0]!), id: 'x', exerciseId: 'ghost' } as never);
          return b;
        }),
      ),
    ).toThrow();
    expect(() =>
      parseBackup(
        bad((b) => {
          b.data.exercises.push({ ...b.data.exercises[0]!, id: 'dupe-name' });
          return b;
        }),
      ),
    ).toThrow(/named/);
  });

  it('a rejected restore leaves existing data untouched', async () => {
    await populate(db);
    const before = await db.sets.count();
    const backup = parseBackup(JSON.stringify(await exportBackup(db)));
    backup.data.sets.push(backup.data.sets[0]!); // duplicate primary key → bulkAdd fails mid-transaction
    await expect(restoreBackup(db, backup)).rejects.toBeTruthy();
    expect(await db.sets.count()).toBe(before);
  });

  it('migration harness: older backups are upgraded step by step', () => {
    const v1 = { app: 'monolog', schemaVersion: 1, exportedAt: '', data: { exercises: [], legacy: [1] } };
    const migrations = {
      1: (d: Record<string, unknown[]>) => ({ ...d, v2marker: ['from1'] }),
      2: (d: Record<string, unknown[]>) => {
        const rest = { ...d };
        delete rest.legacy;
        return { ...rest, v3marker: ['from2'] };
      },
    };
    const out = parseBackup(JSON.stringify(v1), migrations, 3);
    const data = out.data as unknown as Record<string, unknown[]>;
    expect(out.schemaVersion).toBe(3);
    expect(data.v2marker).toEqual(['from1']);
    expect(data.v3marker).toEqual(['from2']);
    expect(data.legacy).toBeUndefined();
    expect(() => parseBackup(JSON.stringify(v1), { 1: migrations[1] }, 3)).toThrow(/no upgrade path/);
  });

  it('file name and backup reminder reset', async () => {
    expect(backupFileName(at('2026-09-30'))).toBe('monolog-backup-2026-09-30.json');
    await populate(db);
    expect((await getSettings(db)).workoutsSinceBackup).toBe(2);
    await markBackedUp(db, at('2026-09-30', 22));
    expect(await getSettings(db)).toMatchObject({ workoutsSinceBackup: 0 });
    expect((await getSettings(db)).lastBackupAt).not.toBeNull();
  });
});
