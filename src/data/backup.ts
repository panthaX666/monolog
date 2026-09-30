import { isValidDayKey, toDayKey } from '../domain/dates';
import {
  DEFAULT_SETTINGS,
  type BodyEntry,
  type Exercise,
  type RecordEvent,
  type RestDay,
  type Session,
  type SessionExercise,
  type Settings,
  type WorkoutSet,
} from '../domain/types';
import { SCHEMA_VERSION, type MonologDB } from './db';
import { recomputeRecords, RepoError } from './repo';

// Backup file — docs/SPEC.md §6.5.

export interface BackupData {
  settings: Settings[];
  exercises: Exercise[];
  sessions: Session[];
  sessionExercises: SessionExercise[];
  sets: WorkoutSet[];
  restDays: RestDay[];
  bodyEntries: BodyEntry[];
  recordEvents: RecordEvent[];
}

export interface Backup {
  app: 'monolog';
  schemaVersion: number;
  exportedAt: string;
  data: BackupData;
}

const TABLES: (keyof BackupData)[] = [
  'settings',
  'exercises',
  'sessions',
  'sessionExercises',
  'sets',
  'restDays',
  'bodyEntries',
  'recordEvents',
];

/** Upgrades a backup from version n to n+1. Add one entry per schema change. */
export type BackupMigration = (data: Record<string, unknown[]>) => Record<string, unknown[]>;
export const BACKUP_MIGRATIONS: Record<number, BackupMigration> = {};

// ───────────────────────── Export ─────────────────────────

export async function exportBackup(db: MonologDB, now: Date = new Date()): Promise<Backup> {
  const data = await db.transaction('r', db.allTables, async () => ({
    settings: await db.settings.toArray(),
    exercises: await db.exercises.toArray(),
    sessions: await db.sessions.toArray(),
    sessionExercises: await db.sessionExercises.toArray(),
    sets: await db.sets.toArray(),
    restDays: await db.restDays.toArray(),
    bodyEntries: await db.bodyEntries.toArray(),
    recordEvents: await db.recordEvents.toArray(),
  }));
  return { app: 'monolog', schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), data };
}

export function backupFileName(now: Date = new Date()): string {
  return `monolog-backup-${toDayKey(now)}.json`;
}

/** Record a successful export (resets the "back up your data" reminder). */
export async function markBackedUp(db: MonologDB, now: Date = new Date()): Promise<void> {
  const current = { ...DEFAULT_SETTINGS, ...(await db.settings.get('app')) };
  await db.settings.put({ ...current, lastBackupAt: now.toISOString(), workoutsSinceBackup: 0 });
}

// ───────────────────────── Parse, validate, migrate ─────────────────────────

const fail = (msg: string): never => {
  throw new RepoError('invalid', `Not a valid Monolog backup: ${msg}`);
};
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => typeof v === 'string' && v.length > 0;

export function parseBackup(
  text: string,
  migrations: Record<number, BackupMigration> = BACKUP_MIGRATIONS,
  currentVersion: number = SCHEMA_VERSION,
): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail('the file is not JSON');
  }
  if (!isObj(raw) || raw.app !== 'monolog') return fail('this file is not from Monolog');
  const version = raw.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return fail('unknown version');
  if (version > currentVersion) return fail('it was made by a newer version of Monolog — update the app first');
  if (!isObj(raw.data)) return fail('missing data');

  let data = raw.data as Record<string, unknown[]>;
  for (let v = version; v < currentVersion; v++) {
    const step = migrations[v];
    if (!step) return fail(`no upgrade path from version ${v}`);
    data = step(data);
  }
  for (const t of TABLES) {
    if (data[t] === undefined) data[t] = [];
    if (!Array.isArray(data[t])) fail(`“${t}” is not a list`);
  }
  const backup: Backup = {
    app: 'monolog',
    schemaVersion: currentVersion,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    data: data as unknown as BackupData,
  };
  validate(backup.data);
  return backup;
}

function validate(d: BackupData): void {
  const ids = (rows: { id?: unknown }[], table: string) => {
    const set = new Set<string>();
    for (const r of rows) {
      if (!isObj(r) || !str(r.id)) fail(`a row in ${table} has no id`);
      if (set.has(r.id as string)) fail(`duplicate id in ${table}`);
      set.add(r.id as string);
    }
    return set;
  };
  const exercises = ids(d.exercises, 'exercises');
  const sessions = ids(d.sessions, 'sessions');
  const ses = ids(d.sessionExercises, 'sessionExercises');
  ids(d.sets, 'sets');
  ids(d.bodyEntries, 'bodyEntries');

  const names = new Set<string>();
  for (const e of d.exercises) {
    if (!str(e.name) || !str(e.nameKey)) fail('an exercise has no name');
    if (names.has(e.nameKey)) fail(`two exercises are named “${e.name}”`);
    names.add(e.nameKey);
  }
  for (const s of d.sessions) if (!isValidDayKey(s.dayKey)) fail('a workout has an invalid date');
  for (const se of d.sessionExercises)
    if (!sessions.has(se.sessionId) || !exercises.has(se.exerciseId)) fail('a workout refers to a missing exercise');
  for (const s of d.sets) {
    if (!ses.has(s.sessionExerciseId) || !sessions.has(s.sessionId) || !exercises.has(s.exerciseId))
      fail('a set refers to a missing workout or exercise');
    if (!isValidDayKey(s.dayKey)) fail('a set has an invalid date');
  }
  for (const r of d.restDays) if (!isObj(r) || !isValidDayKey(r.dayKey)) fail('a rest day has an invalid date');
  for (const b of d.bodyEntries) if (!isValidDayKey(b.dayKey)) fail('a body entry has an invalid date');
}

export interface BackupPreview {
  exportedAt: string;
  workouts: number;
  sets: number;
  exercises: number;
  customExercises: number;
  restDays: number;
  bodyEntries: number;
}

export function previewBackup(b: Backup): BackupPreview {
  return {
    exportedAt: b.exportedAt,
    workouts: b.data.sessions.length,
    sets: b.data.sets.filter((s) => s.loggedAt != null).length,
    exercises: b.data.exercises.length,
    customExercises: b.data.exercises.filter((e) => e.isCustom).length,
    restDays: b.data.restDays.length,
    bodyEntries: b.data.bodyEntries.length,
  };
}

// ───────────────────────── Restore ─────────────────────────

/** Replace everything on this device with the backup, in one transaction (all or nothing). */
export async function restoreBackup(db: MonologDB, b: Backup): Promise<void> {
  const d = b.data;
  await db.transaction('rw', db.allTables, async () => {
    await Promise.all(db.allTables.map((t) => t.clear()));
    await db.settings.bulkPut(
      d.settings.length ? d.settings.map((s) => ({ ...DEFAULT_SETTINGS, ...s, id: 'app' as const })) : [DEFAULT_SETTINGS],
    );
    await db.exercises.bulkAdd(d.exercises);
    await db.sessions.bulkAdd(d.sessions);
    await db.sessionExercises.bulkAdd(d.sessionExercises);
    await db.sets.bulkAdd(d.sets);
    await db.restDays.bulkPut(d.restDays);
    await db.bodyEntries.bulkAdd(d.bodyEntries);
    // Records are derived: rebuild them rather than trusting the file.
    for (const e of d.exercises) await recomputeRecords(db, e.id);
  });
}
