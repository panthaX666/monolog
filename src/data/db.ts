import { Dexie, type EntityTable } from 'dexie';
import type {
  BodyEntry,
  Exercise,
  RecordEvent,
  RestDay,
  Session,
  SessionExercise,
  Settings,
  WorkoutSet,
} from '../domain/types';

// IndexedDB schema — docs/SPEC.md §6. Every schema change = a new `this.version(n)` block with an
// upgrade function AND a test that runs it against data from version n-1 (SPEC §6.6).

/** Unique name: all GitHub Pages sites under panthax666.github.io share one storage origin. */
export const DB_NAME = 'monolog.panthax666';
export const SCHEMA_VERSION = 1;

export class MonologDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  sessionExercises!: EntityTable<SessionExercise, 'id'>;
  sets!: EntityTable<WorkoutSet, 'id'>;
  restDays!: EntityTable<RestDay, 'dayKey'>;
  bodyEntries!: EntityTable<BodyEntry, 'id'>;
  recordEvents!: EntityTable<RecordEvent, 'id'>;
  settings!: EntityTable<Settings, 'id'>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(SCHEMA_VERSION).stores({
      exercises: 'id, &nameKey, archivedAt',
      sessions: 'id, dayKey, startedAt, endedAt',
      sessionExercises: 'id, sessionId, exerciseId',
      sets: 'id, sessionExerciseId, sessionId, exerciseId, dayKey, loggedAt',
      restDays: 'dayKey',
      bodyEntries: 'id, &dayKey',
      recordEvents: 'id, exerciseId, setId, dayKey',
      settings: 'id',
    });
  }

  /** Every table, in dependency order (used by backup/restore). */
  get allTables() {
    return [
      this.settings,
      this.exercises,
      this.sessions,
      this.sessionExercises,
      this.sets,
      this.restDays,
      this.bodyEntries,
      this.recordEvents,
    ];
  }
}

let instance: MonologDB | null = null;

/** The app's database (lazily opened). Tests create their own `new MonologDB(name)`. */
export function getDb(): MonologDB {
  instance ??= new MonologDB();
  return instance;
}
