import { computeCoverage, type CoverageSession, type GroupCoverage } from '../domain/coverage';
import { addDays, isValidDayKey, toDayKey } from '../domain/dates';
import { computeRecords, isEligible } from '../domain/records';
import { canLogRestDay, computeStreak, type Streak } from '../domain/streak';
import {
  DEFAULT_SETTINGS,
  type BodyEntry,
  type DayKey,
  type Equipment,
  type Exercise,
  type ExerciseType,
  type ID,
  type Muscle,
  type RecordEvent,
  type Session,
  type SessionExercise,
  type Settings,
  type Unit,
  type WorkoutSet,
} from '../domain/types';
import { toKg } from '../domain/units';
import type { MonologDB } from './db';
import { nameKey, seedExercises } from './seed';

// Data access. Every function takes the db and (where time matters) `now`, so it can be tested.
// Anything that changes logged sets recomputes that exercise's records in the same transaction.

export type RepoErrorCode =
  | 'not_found'
  | 'duplicate_name'
  | 'invalid'
  | 'incomplete_set'
  | 'rest_day_not_allowed'
  | 'session_open'
  | 'type_locked';

export class RepoError extends Error {
  constructor(
    readonly code: RepoErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RepoError';
  }
}

const uuid = () => crypto.randomUUID();
const iso = (d: Date) => d.toISOString();

async function must<T>(value: Promise<T | undefined>, what: string): Promise<T> {
  const v = await value;
  if (v === undefined) throw new RepoError('not_found', `${what} not found`);
  return v;
}

// ───────────────────────── Setup & settings ─────────────────────────

/** First run: default settings + starter library. Later runs: add any new library exercises. */
export async function ensureReady(db: MonologDB, now: Date = new Date()): Promise<void> {
  await db.transaction('rw', db.settings, db.exercises, async () => {
    if (!(await db.settings.get('app'))) await db.settings.put({ ...DEFAULT_SETTINGS });
    const existing = await db.exercises.toArray();
    const ids = new Set(existing.map((e) => e.id));
    const names = new Set(existing.map((e) => e.nameKey));
    const missing = seedExercises(iso(now)).filter((e) => !ids.has(e.id) && !names.has(e.nameKey));
    if (missing.length) await db.exercises.bulkAdd(missing);
  });
}

export async function getSettings(db: MonologDB): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await db.settings.get('app')) };
}

export async function updateSettings(db: MonologDB, patch: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
  const next = { ...(await getSettings(db)), ...patch, id: 'app' as const };
  await db.settings.put(next);
  return next;
}

// ───────────────────────── Exercises ─────────────────────────

export interface ExerciseInput {
  name: string;
  type: ExerciseType;
  primaryMuscles?: Muscle[];
  secondaryMuscles?: Muscle[];
  equipment?: Equipment[];
  tags?: string[];
  unit?: Unit | null;
  restSec?: number | null;
  pinnedNote?: string;
}

function cleanName(name: string): string {
  const n = name.trim().replace(/\s+/g, ' ');
  if (!n) throw new RepoError('invalid', 'Exercise name is required');
  if (n.length > 80) throw new RepoError('invalid', 'Exercise name is too long');
  return n;
}

export async function createExercise(db: MonologDB, input: ExerciseInput, now: Date = new Date()): Promise<Exercise> {
  const name = cleanName(input.name);
  const key = nameKey(name);
  return db.transaction('rw', db.exercises, async () => {
    if (await db.exercises.where('nameKey').equals(key).first())
      throw new RepoError('duplicate_name', `“${name}” already exists`);
    const ex: Exercise = {
      id: uuid(),
      name,
      nameKey: key,
      type: input.type,
      primaryMuscles: input.primaryMuscles ?? [],
      secondaryMuscles: (input.secondaryMuscles ?? []).filter((m) => !(input.primaryMuscles ?? []).includes(m)),
      equipment: input.equipment?.length ? input.equipment : ['other'],
      tags: input.tags ?? [],
      unit: input.unit ?? null,
      restSec: input.restSec ?? null,
      pinnedNote: input.pinnedNote ?? '',
      isCustom: true,
      archivedAt: null,
      createdAt: iso(now),
    };
    await db.exercises.add(ex);
    return ex;
  });
}

export async function updateExercise(
  db: MonologDB,
  id: ID,
  patch: Partial<Omit<Exercise, 'id' | 'nameKey' | 'isCustom' | 'createdAt'>>,
): Promise<Exercise> {
  return db.transaction('rw', db.exercises, db.sets, db.recordEvents, async () => {
    const ex = await must(db.exercises.get(id), 'Exercise');
    const next: Exercise = { ...ex, ...patch };
    if (patch.name !== undefined) {
      next.name = cleanName(patch.name);
      next.nameKey = nameKey(next.name);
      const clash = await db.exercises.where('nameKey').equals(next.nameKey).first();
      if (clash && clash.id !== id) throw new RepoError('duplicate_name', `“${next.name}” already exists`);
    }
    if (patch.type !== undefined && patch.type !== ex.type) {
      const logged = await db.sets.where('exerciseId').equals(id).filter((s) => s.loggedAt != null).count();
      if (logged) throw new RepoError('type_locked', 'Type can’t change once sets are logged');
    }
    next.secondaryMuscles = next.secondaryMuscles.filter((m) => !next.primaryMuscles.includes(m));
    await db.exercises.put(next);
    return next;
  });
}

/** Archived exercises leave the picker but keep their history. */
export async function setArchived(db: MonologDB, id: ID, archived: boolean, now: Date = new Date()) {
  return updateExercise(db, id, { archivedAt: archived ? iso(now) : null });
}

// ───────────────────────── Sessions ─────────────────────────

export async function getOpenSession(db: MonologDB): Promise<Session | undefined> {
  return db.sessions.filter((s) => s.endedAt === null).first();
}

export async function startSession(db: MonologDB, now: Date = new Date(), repeatedFrom: ID | null = null): Promise<Session> {
  return db.transaction('rw', db.sessions, async () => {
    if (await getOpenSession(db)) throw new RepoError('session_open', 'A workout is already in progress');
    const s: Session = { id: uuid(), dayKey: toDayKey(now), startedAt: iso(now), endedAt: null, repeatedFrom };
    await db.sessions.add(s);
    return s;
  });
}

/**
 * Finish: drop un-logged sets and empty exercises. A session with nothing logged is deleted.
 * `endAt` defaults to now (pass the last set's time for a forgotten workout).
 */
export async function finishSession(
  db: MonologDB,
  sessionId: ID,
  now: Date = new Date(),
  endAt?: Date,
): Promise<{ kept: boolean }> {
  return db.transaction('rw', [db.sessions, db.sessionExercises, db.sets, db.settings], async () => {
    const session = await must(db.sessions.get(sessionId), 'Session');
    const sets = await db.sets.where('sessionId').equals(sessionId).toArray();
    await db.sets.bulkDelete(sets.filter((s) => s.loggedAt == null).map((s) => s.id));
    const loggedSe = new Set(sets.filter((s) => s.loggedAt != null).map((s) => s.sessionExerciseId));
    const ses = await db.sessionExercises.where('sessionId').equals(sessionId).sortBy('order');
    await db.sessionExercises.bulkDelete(ses.filter((se) => !loggedSe.has(se.id)).map((se) => se.id));
    const kept = ses.filter((se) => loggedSe.has(se.id));
    await Promise.all(kept.map((se, i) => db.sessionExercises.update(se.id, { order: i })));

    if (kept.length === 0) {
      await db.sessions.delete(sessionId);
      return { kept: false };
    }
    await db.sessions.put({ ...session, endedAt: iso(endAt ?? now) });
    const settings = await getSettings(db);
    await db.settings.put({ ...settings, workoutsSinceBackup: settings.workoutsSinceBackup + 1 });
    return { kept: true };
  });
}

/**
 * Discard: delete the workout and everything in it. Records that came from its sets are rebuilt
 * from what remains. Returns how many logged sets were deleted.
 */
export async function discardSession(db: MonologDB, sessionId: ID): Promise<{ deletedLoggedSets: number }> {
  return db.transaction('rw', [db.sessions, db.sessionExercises, db.sets, db.exercises, db.recordEvents], async () => {
    await must(db.sessions.get(sessionId), 'Session');
    const sets = await db.sets.where('sessionId').equals(sessionId).toArray();
    const logged = sets.filter((s) => s.loggedAt != null);
    await db.sets.bulkDelete(sets.map((s) => s.id));
    await db.sessionExercises.where('sessionId').equals(sessionId).delete();
    await db.sessions.delete(sessionId);
    for (const exerciseId of new Set(logged.map((s) => s.exerciseId))) await recomputeRecords(db, exerciseId);
    return { deletedLoggedSets: logged.length };
  });
}

/**
 * After editing a past workout: drop un-logged sets and empty exercise cards. A workout left with
 * nothing logged is deleted. Returns whether the session still exists.
 */
export async function tidySession(db: MonologDB, sessionId: ID): Promise<{ kept: boolean }> {
  return db.transaction('rw', [db.sessions, db.sessionExercises, db.sets], async () => {
    const session = await db.sessions.get(sessionId);
    if (!session) return { kept: false };
    if (session.endedAt === null) return { kept: true }; // never tidy the live workout
    const sets = await db.sets.where('sessionId').equals(sessionId).toArray();
    await db.sets.bulkDelete(sets.filter((s) => s.loggedAt == null).map((s) => s.id));
    const loggedSe = new Set(sets.filter((s) => s.loggedAt != null).map((s) => s.sessionExerciseId));
    const ses = await db.sessionExercises.where('sessionId').equals(sessionId).sortBy('order');
    await db.sessionExercises.bulkDelete(ses.filter((se) => !loggedSe.has(se.id)).map((se) => se.id));
    const kept = ses.filter((se) => loggedSe.has(se.id));
    await Promise.all(kept.map((se, i) => (se.order === i ? null : db.sessionExercises.update(se.id, { order: i }))));
    if (!kept.length) {
      await db.sessions.delete(sessionId);
      return { kept: false };
    }
    return { kept: true };
  });
}

/**
 * Repeat: start a new workout with the same exercises, in the same order, pre-filled with that
 * session's sets (SPEC F7).
 */
export async function repeatSession(db: MonologDB, fromSessionId: ID, now: Date = new Date()): Promise<Session> {
  return db.transaction(
    'rw',
    [db.sessions, db.sessionExercises, db.sets, db.exercises, db.settings],
    async () => {
      await must(db.sessions.get(fromSessionId), 'Session');
      const session = await startSession(db, now, fromSessionId);
      const ses = await db.sessionExercises.where('sessionId').equals(fromSessionId).sortBy('order');
      const unit = (await getSettings(db)).unit;
      for (const [i, from] of ses.entries()) {
        const ex = await db.exercises.get(from.exerciseId);
        if (!ex) continue;
        const se: SessionExercise = { id: uuid(), sessionId: session.id, exerciseId: ex.id, order: i };
        await db.sessionExercises.add(se);
        const src = (await db.sets.where('sessionExerciseId').equals(from.id).sortBy('order')).filter((s) => s.loggedAt);
        const sets = src.length
          ? src.map((p, j) => ghostFrom(p, blankSet(se, session.dayKey, j, ex.unit ?? unit)))
          : [blankSet(se, session.dayKey, 0, ex.unit ?? unit)];
        await db.sets.bulkAdd(sets);
      }
      return session;
    },
  );
}

// ───────────────────────── Exercises within a session ─────────────────────────

function blankSet(se: SessionExercise, dayKey: DayKey, order: number, unit: Unit): WorkoutSet {
  return {
    id: uuid(),
    sessionExerciseId: se.id,
    sessionId: se.sessionId,
    exerciseId: se.exerciseId,
    dayKey,
    order,
    kind: 'working',
    toFailure: false,
    weight: null,
    unit,
    weightKg: null,
    reps: null,
    durationSec: null,
    distanceM: null,
    note: '',
    loggedAt: null,
  };
}

/** Pre-fill values copied from a previous set (the "faded" numbers). Never copies notes or log state. */
function ghostFrom(src: WorkoutSet, base: WorkoutSet): WorkoutSet {
  return {
    ...base,
    kind: src.kind,
    weight: src.weight,
    unit: src.unit,
    weightKg: src.weightKg,
    reps: src.reps,
    durationSec: src.durationSec,
    distanceM: src.distanceM,
  };
}

/**
 * Logged sets from the most recent other session containing this exercise, on or before `onOrBefore`
 * (so editing an old workout pre-fills from the session before it, not from later ones).
 */
export async function lastSessionSets(
  db: MonologDB,
  exerciseId: ID,
  excludeSessionId?: ID,
  onOrBefore?: DayKey,
): Promise<WorkoutSet[]> {
  const logged = await db.sets
    .where('exerciseId')
    .equals(exerciseId)
    .filter((s) => s.loggedAt != null && s.sessionId !== excludeSessionId && (!onOrBefore || s.dayKey <= onOrBefore))
    .toArray();
  if (!logged.length) return [];
  const latest = logged.reduce((a, b) => (b.dayKey > a.dayKey || (b.dayKey === a.dayKey && b.loggedAt! > a.loggedAt!) ? b : a));
  return logged.filter((s) => s.sessionId === latest.sessionId).sort((a, b) => a.order - b.order);
}

/** Add an exercise to a session, pre-filled from its last session (SPEC F1 step 3). */
export async function addExerciseToSession(
  db: MonologDB,
  sessionId: ID,
  exerciseId: ID,
): Promise<{ sessionExercise: SessionExercise; sets: WorkoutSet[] }> {
  return db.transaction('rw', [db.sessions, db.sessionExercises, db.sets, db.exercises, db.settings], async () => {
    const session = await must(db.sessions.get(sessionId), 'Session');
    const ex = await must(db.exercises.get(exerciseId), 'Exercise');
    const order = await db.sessionExercises.where('sessionId').equals(sessionId).count();
    const se: SessionExercise = { id: uuid(), sessionId, exerciseId, order };
    await db.sessionExercises.add(se);

    const unit = ex.unit ?? (await getSettings(db)).unit;
    const previous = await lastSessionSets(db, exerciseId, sessionId, session.dayKey);
    const sets = previous.length
      ? previous.map((p, i) => ghostFrom(p, blankSet(se, session.dayKey, i, unit)))
      : [blankSet(se, session.dayKey, 0, unit)];
    await db.sets.bulkAdd(sets);
    return { sessionExercise: se, sets };
  });
}

export async function removeExerciseFromSession(db: MonologDB, sessionExerciseId: ID): Promise<void> {
  await db.transaction('rw', [db.sessionExercises, db.sets, db.exercises, db.recordEvents], async () => {
    const se = await must(db.sessionExercises.get(sessionExerciseId), 'Session exercise');
    const sets = await db.sets.where('sessionExerciseId').equals(se.id).toArray();
    await db.sets.bulkDelete(sets.map((s) => s.id));
    await db.sessionExercises.delete(se.id);
    const siblings = await db.sessionExercises.where('sessionId').equals(se.sessionId).sortBy('order');
    await Promise.all(siblings.map((s, i) => db.sessionExercises.update(s.id, { order: i })));
    if (sets.some((s) => s.loggedAt != null)) await recomputeRecords(db, se.exerciseId);
  });
}

// ───────────────────────── Sets ─────────────────────────

async function setsOf(db: MonologDB, sessionExerciseId: ID): Promise<WorkoutSet[]> {
  return db.sets.where('sessionExerciseId').equals(sessionExerciseId).sortBy('order');
}

/** "＋ Add set": a new pre-filled set copying the last set of this exercise card. */
export async function addSet(db: MonologDB, sessionExerciseId: ID): Promise<WorkoutSet> {
  return db.transaction('rw', [db.sessionExercises, db.sessions, db.sets, db.exercises, db.settings], async () => {
    const se = await must(db.sessionExercises.get(sessionExerciseId), 'Session exercise');
    const session = await must(db.sessions.get(se.sessionId), 'Session');
    const ex = await must(db.exercises.get(se.exerciseId), 'Exercise');
    const existing = await setsOf(db, se.id);
    const base = blankSet(se, session.dayKey, existing.length, ex.unit ?? (await getSettings(db)).unit);
    const last = existing[existing.length - 1];
    const set = last ? { ...ghostFrom(last, base), kind: 'working' as const } : base;
    await db.sets.add(set);
    return set;
  });
}

export type SetPatch = Partial<
  Pick<WorkoutSet, 'weight' | 'unit' | 'reps' | 'durationSec' | 'distanceM' | 'kind' | 'toFailure' | 'note'>
>;

function validNumber(v: number | null | undefined, field: string) {
  if (v == null) return;
  if (!Number.isFinite(v) || v < 0) throw new RepoError('invalid', `${field} must be a positive number`);
}

export async function updateSet(db: MonologDB, setId: ID, patch: SetPatch): Promise<WorkoutSet> {
  validNumber(patch.weight, 'Weight');
  validNumber(patch.reps, 'Reps');
  validNumber(patch.durationSec, 'Time');
  validNumber(patch.distanceM, 'Distance');
  return db.transaction('rw', [db.sets, db.exercises, db.recordEvents], async () => {
    const set = await must(db.sets.get(setId), 'Set');
    const next: WorkoutSet = { ...set, ...patch };
    if (next.reps != null) next.reps = Math.round(next.reps);
    if (next.kind === 'warmup') next.toFailure = false;
    next.weightKg = next.weight == null ? null : toKg(next.weight, next.unit);
    await db.sets.put(next);
    if (next.loggedAt != null) await recomputeRecords(db, next.exerciseId);
    return next;
  });
}

function isComplete(type: ExerciseType, s: WorkoutSet): boolean {
  switch (type) {
    case 'weight_reps':
      return s.weight != null && (s.reps ?? 0) > 0;
    case 'bodyweight_reps':
      return (s.reps ?? 0) > 0;
    case 'timed':
      return (s.durationSec ?? 0) > 0;
    case 'cardio':
      return (s.distanceM ?? 0) > 0 || (s.durationSec ?? 0) > 0;
  }
}

/**
 * Log a set (✓). Returns the record it set, if any — the caller shows the celebration.
 * If it was the last set of its card, a new pre-filled set is appended (D36).
 */
export async function logSet(
  db: MonologDB,
  setId: ID,
  now: Date = new Date(),
): Promise<{ set: WorkoutSet; record: RecordEvent | null; appended: WorkoutSet | null }> {
  return db.transaction('rw', [db.sets, db.exercises, db.recordEvents], async () => {
    const set = await must(db.sets.get(setId), 'Set');
    const ex = await must(db.exercises.get(set.exerciseId), 'Exercise');
    if (!isComplete(ex.type, set)) throw new RepoError('incomplete_set', 'Fill in the set before logging it');
    const logged: WorkoutSet = { ...set, loggedAt: iso(now) };
    await db.sets.put(logged);

    let appended: WorkoutSet | null = null;
    const siblings = await setsOf(db, set.sessionExerciseId);
    if (siblings[siblings.length - 1]?.id === set.id) {
      appended = {
        ...ghostFrom(logged, { ...logged, id: uuid(), order: set.order + 1, note: '', loggedAt: null, toFailure: false }),
        kind: 'working',
      };
      await db.sets.add(appended);
    }

    const events = await recomputeRecords(db, set.exerciseId);
    return { set: logged, record: events.find((e) => e.setId === set.id) ?? null, appended };
  });
}

export async function unlogSet(db: MonologDB, setId: ID): Promise<WorkoutSet> {
  return db.transaction('rw', [db.sets, db.exercises, db.recordEvents], async () => {
    const set = await must(db.sets.get(setId), 'Set');
    const next = { ...set, loggedAt: null };
    await db.sets.put(next);
    await recomputeRecords(db, set.exerciseId);
    return next;
  });
}

/** Delete a set (✕). Returns it so the UI can offer Undo via `restoreSet`. */
export async function deleteSet(db: MonologDB, setId: ID): Promise<WorkoutSet> {
  return db.transaction('rw', [db.sets, db.exercises, db.recordEvents], async () => {
    const set = await must(db.sets.get(setId), 'Set');
    await db.sets.delete(setId);
    const rest = await setsOf(db, set.sessionExerciseId);
    await Promise.all(rest.map((s, i) => (s.order === i ? null : db.sets.update(s.id, { order: i }))));
    if (set.loggedAt != null) await recomputeRecords(db, set.exerciseId);
    return set;
  });
}

export async function restoreSet(db: MonologDB, set: WorkoutSet): Promise<void> {
  await db.transaction('rw', [db.sets, db.sessionExercises, db.exercises, db.recordEvents], async () => {
    if (!(await db.sessionExercises.get(set.sessionExerciseId))) return; // card was removed meanwhile
    const rest = await setsOf(db, set.sessionExerciseId);
    const order = Math.min(set.order, rest.length);
    rest.splice(order, 0, { ...set, order });
    await db.sets.put({ ...set, order });
    await Promise.all(rest.map((s, i) => (s.order === i ? null : db.sets.update(s.id, { order: i }))));
    if (set.loggedAt != null) await recomputeRecords(db, set.exerciseId);
  });
}

// ───────────────────────── Records ─────────────────────────

/** Rebuild every RecordEvent for one exercise from its sets (cheap: one exercise's history). */
export async function recomputeRecords(db: MonologDB, exerciseId: ID): Promise<RecordEvent[]> {
  const ex = await db.exercises.get(exerciseId);
  const sets = await db.sets.where('exerciseId').equals(exerciseId).toArray();
  const events = ex ? computeRecords(exerciseId, ex.type, sets) : [];
  await db.recordEvents.where('exerciseId').equals(exerciseId).delete();
  if (events.length) await db.recordEvents.bulkPut(events);
  return events;
}

export async function recentRecords(db: MonologDB, limit = 5): Promise<RecordEvent[]> {
  const all = await db.recordEvents.toArray();
  return all.sort((a, b) => (a.dayKey === b.dayKey ? (a.at < b.at ? 1 : -1) : a.dayKey < b.dayKey ? 1 : -1)).slice(0, limit);
}

// ───────────────────────── Streak, rest days, coverage ─────────────────────────

/** Days with at least one logged working set. */
export async function trainedDays(db: MonologDB): Promise<Set<DayKey>> {
  const days = new Set<DayKey>();
  await db.sets.where('loggedAt').above('').each((s) => {
    if (isEligible(s)) days.add(s.dayKey);
  });
  return days;
}

export async function getStreak(db: MonologDB, now: Date = new Date()): Promise<Streak> {
  const [trained, rest] = await Promise.all([trainedDays(db), db.restDays.toArray()]);
  return computeStreak({ trainedDays: trained, restDays: rest.map((r) => r.dayKey), today: toDayKey(now) });
}

export async function logRestDay(db: MonologDB, dayKey: DayKey, now: Date = new Date()): Promise<void> {
  if (!isValidDayKey(dayKey)) throw new RepoError('invalid', 'Invalid date');
  await db.transaction('rw', db.sets, db.restDays, async () => {
    if (!canLogRestDay(dayKey, toDayKey(now), await trainedDays(db)))
      throw new RepoError('rest_day_not_allowed', 'Rest days can be logged for today, or yesterday until midnight');
    await db.restDays.put({ dayKey, createdAt: iso(now) });
  });
}

/** Undo a rest day — only while it could still be logged. */
export async function removeRestDay(db: MonologDB, dayKey: DayKey, now: Date = new Date()): Promise<void> {
  const today = toDayKey(now);
  if (dayKey !== today && dayKey !== addDays(today, -1))
    throw new RepoError('rest_day_not_allowed', 'Past rest days can’t be changed');
  await db.restDays.delete(dayKey);
}

export async function getCoverage(db: MonologDB, now: Date = new Date()): Promise<GroupCoverage[]> {
  const [sets, exercises] = await Promise.all([db.sets.where('loggedAt').above('').toArray(), db.exercises.toArray()]);
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const sessions = new Map<ID, { dayKey: DayKey; exIds: Set<ID> }>();
  for (const s of sets) {
    if (!isEligible(s)) continue;
    const entry = sessions.get(s.sessionId) ?? { dayKey: s.dayKey, exIds: new Set<ID>() };
    entry.exIds.add(s.exerciseId);
    sessions.set(s.sessionId, entry);
  }
  const input: CoverageSession[] = [...sessions.values()].map(({ dayKey, exIds }) => ({
    dayKey,
    exercises: [...exIds].flatMap((id) => {
      const e = byId.get(id);
      return e ? [{ primaryMuscles: e.primaryMuscles, secondaryMuscles: e.secondaryMuscles }] : [];
    }),
  }));
  return computeCoverage(input, toDayKey(now));
}

// ───────────────────────── Body ─────────────────────────

export type BodyInput = Partial<Pick<BodyEntry, 'weightKg' | 'bodyFatPct' | 'muscleMassKg' | 'waistCm' | 'note'>>;

/** One check-in per day: saving again on the same day updates it. */
export async function saveBodyEntry(db: MonologDB, dayKey: DayKey, input: BodyInput): Promise<BodyEntry> {
  if (!isValidDayKey(dayKey)) throw new RepoError('invalid', 'Invalid date');
  for (const [k, v] of Object.entries(input)) if (k !== 'note') validNumber(v as number | null, k);
  if (input.bodyFatPct != null && input.bodyFatPct > 100) throw new RepoError('invalid', 'Body fat must be ≤ 100%');
  return db.transaction('rw', db.bodyEntries, async () => {
    const existing = await db.bodyEntries.where('dayKey').equals(dayKey).first();
    const entry: BodyEntry = {
      id: existing?.id ?? uuid(),
      dayKey,
      weightKg: null,
      bodyFatPct: null,
      muscleMassKg: null,
      waistCm: null,
      note: '',
      ...existing,
      ...input,
    };
    await db.bodyEntries.put(entry);
    return entry;
  });
}

export async function deleteBodyEntry(db: MonologDB, id: ID): Promise<void> {
  await db.bodyEntries.delete(id);
}
