import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { MonologDB, SCHEMA_VERSION } from './db';

// Schema guard: when SCHEMA_VERSION changes, add a test here that writes version n-1 data with the
// old schema, opens it with the new one and checks the upgrade (SPEC §6.6).
describe('database schema', () => {
  it(`opens at version ${SCHEMA_VERSION} with every table`, async () => {
    const db = new MonologDB(`test-${crypto.randomUUID()}`);
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect(db.tables.map((t) => t.name).sort()).toEqual(
      ['bodyEntries', 'exercises', 'recordEvents', 'restDays', 'sessionExercises', 'sessions', 'sets', 'settings'].sort(),
    );
    expect(db.allTables).toHaveLength(db.tables.length);
    db.close();
    await db.delete();
  });

  it('enforces unique exercise names and one body entry per day', async () => {
    const db = new MonologDB(`test-${crypto.randomUUID()}`);
    const ex = { name: 'A', nameKey: 'a', type: 'weight_reps' } as never;
    await db.exercises.add({ ...(ex as object), id: '1' } as never);
    await expect(db.exercises.add({ ...(ex as object), id: '2' } as never)).rejects.toBeTruthy();
    await db.bodyEntries.add({ id: 'b1', dayKey: '2026-09-30' } as never);
    await expect(db.bodyEntries.add({ id: 'b2', dayKey: '2026-09-30' } as never)).rejects.toBeTruthy();
    db.close();
    await db.delete();
  });
});
