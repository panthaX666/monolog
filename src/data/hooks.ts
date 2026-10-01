import { useLiveQuery } from 'dexie-react-hooks';
import { addDays, toDayKey } from '../domain/dates';
import { compareChrono } from '../domain/records';
import { dayStatus, type DayStatus } from '../domain/streak';
import {
  DEFAULT_SETTINGS,
  type Exercise,
  type RecordEvent,
  type Session,
  type SessionExercise,
  type Settings,
  type WorkoutSet,
} from '../domain/types';
import { getDb } from './db';
import { getOpenSession, getStreak, trainedDays } from './repo';

// Live queries: components re-render automatically when the data changes.

export function useSettings(): Settings {
  return useLiveQuery(async () => ({ ...DEFAULT_SETTINGS, ...(await getDb().settings.get('app')) }), [], DEFAULT_SETTINGS);
}

/** undefined while loading, null when no workout is open. */
export function useOpenSession(): Session | null | undefined {
  return useLiveQuery(async () => (await getOpenSession(getDb())) ?? null, [], undefined);
}

export interface CardData {
  se: SessionExercise;
  exercise: Exercise;
  sets: WorkoutSet[];
  /** Every set of this exercise ever (for records popover, last session). */
  history: WorkoutSet[];
  /** Logged sets from the most recent earlier session. */
  last: WorkoutSet[];
}

export interface WorkoutData {
  session: Session;
  cards: CardData[];
  /** Records set by sets in this session, by set id. */
  records: Map<string, RecordEvent>;
}

export function useWorkout(sessionId: string | undefined): WorkoutData | null | undefined {
  return useLiveQuery(
    async () => {
      if (!sessionId) return null;
      const db = getDb();
      const session = await db.sessions.get(sessionId);
      if (!session) return null;
      const ses = await db.sessionExercises.where('sessionId').equals(sessionId).sortBy('order');
      const sets = await db.sets.where('sessionId').equals(sessionId).toArray();
      const exIds = [...new Set(ses.map((s) => s.exerciseId))];
      const exercises = await db.exercises.bulkGet(exIds);
      const histories = await Promise.all(exIds.map((id) => db.sets.where('exerciseId').equals(id).toArray()));
      const exById = new Map(exIds.map((id, i) => [id, exercises[i]]));
      const histById = new Map(exIds.map((id, i) => [id, histories[i] ?? []]));
      const events = await db.recordEvents.where('setId').anyOf(sets.map((s) => s.id)).toArray();

      const cards: CardData[] = [];
      for (const se of ses) {
        const exercise = exById.get(se.exerciseId);
        if (!exercise) continue;
        const history = histById.get(se.exerciseId) ?? [];
        // "Last" = the most recent other session on or before this one's day (matters when editing the past).
        const earlier = history
          .filter((s) => s.loggedAt != null && s.sessionId !== sessionId && s.dayKey <= session.dayKey)
          .sort(compareChrono);
        const lastSessionId = earlier[earlier.length - 1]?.sessionId;
        cards.push({
          se,
          exercise,
          sets: sets.filter((s) => s.sessionExerciseId === se.id).sort((a, b) => a.order - b.order),
          history,
          last: earlier.filter((s) => s.sessionId === lastSessionId).sort((a, b) => a.order - b.order),
        });
      }
      return { session, cards, records: new Map(events.map((e) => [e.setId, e])) };
    },
    [sessionId],
    undefined,
  );
}

export interface HomeStreak {
  current: number;
  best: number;
  restRun: number;
  yesterdayPending: boolean;
  todayDone: boolean;
  /** Last 14 days, oldest first, with whether each belongs to the current streak. */
  days: { day: string; status: DayStatus; inStreak: boolean }[];
  todayStatus: DayStatus;
  yesterdayStatus: DayStatus;
}

export function useHomeStreak(today: string): HomeStreak | undefined {
  return useLiveQuery(async () => {
    const db = getDb();
    const now = new Date();
    const [streak, trained, rest] = await Promise.all([getStreak(db, now), trainedDays(db), db.restDays.toArray()]);
    const restSet = new Set(rest.map((r) => r.dayKey));
    const days = Array.from({ length: 14 }, (_, i) => {
      const day = addDays(today, i - 13);
      return {
        day,
        status: dayStatus(day, trained, restSet),
        inStreak: !!streak.startDay && day >= streak.startDay,
      };
    });
    return {
      ...streak,
      days,
      todayStatus: dayStatus(today, trained, restSet),
      yesterdayStatus: dayStatus(addDays(today, -1), trained, restSet),
    };
  }, [today]);
}

export function useToday(): string {
  return toDayKey(new Date());
}
