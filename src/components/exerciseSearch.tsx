import { useLiveQuery } from 'dexie-react-hooks';
import { getDb } from '../data/db';
import { EQUIPMENT_LABEL, GROUP_LABEL, MUSCLE_GROUP, type MuscleGroup } from '../domain/muscles';
import type { DayKey, Equipment, Exercise } from '../domain/types';

// Shared by the exercise picker (workout) and the Exercises tab.

export const GROUP_CHIPS: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
export const EQUIP_CHIPS: Equipment[] = ['machine', 'cable', 'barbell', 'dumbbell', 'bodyweight', 'smith'];

export type Filter = { kind: 'group'; value: MuscleGroup } | { kind: 'equip'; value: Equipment } | null;

export function searchWords(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

export function matches(e: Exercise, words: string[], filter: Filter): boolean {
  if (
    filter?.kind === 'group' &&
    ![...e.primaryMuscles, ...e.secondaryMuscles].some((m) => MUSCLE_GROUP[m] === filter.value)
  )
    return false;
  if (filter?.kind === 'equip' && !e.equipment.includes(filter.value)) return false;
  return words.every((w) => e.nameKey.includes(w));
}

export function subtitle(e: Exercise): string {
  const groups = [...new Set(e.primaryMuscles.map((m) => GROUP_LABEL[MUSCLE_GROUP[m]]))];
  return [...groups, ...e.equipment.map((q) => EQUIPMENT_LABEL[q])].join(' · ') || 'Cardio';
}

/**
 * All exercises plus the last day each was logged. Read from workouts and their exercise lists, not
 * every set: finished workouts only keep exercises with logged sets (finish/tidy remove the rest),
 * so only the open workout needs a look at its sets.
 */
export function useExerciseIndex(): { exercises: Exercise[]; last: Map<string, DayKey> } | undefined {
  return useLiveQuery(async () => {
    const db = getDb();
    const [exercises, sessions, ses] = await Promise.all([
      db.exercises.toArray(),
      db.sessions.toArray(),
      db.sessionExercises.toArray(),
    ]);
    const open = sessions.filter((s) => s.endedAt === null).map((s) => s.id);
    const openLogged = new Set(
      (await db.sets.where('sessionId').anyOf(open).toArray()).filter((s) => s.loggedAt).map((s) => s.sessionExerciseId),
    );
    const dayOf = new Map(sessions.map((s) => [s.id, s.dayKey]));
    const isOpen = new Set(open);
    const last = new Map<string, DayKey>();
    for (const se of ses) {
      if (isOpen.has(se.sessionId) && !openLogged.has(se.id)) continue;
      const day = dayOf.get(se.sessionId);
      const prev = last.get(se.exerciseId);
      if (day && (!prev || day > prev)) last.set(se.exerciseId, day);
    }
    return { exercises, last };
  }, []);
}

export function FilterChips({ filter, onChange }: { filter: Filter; onChange: (f: Filter) => void }) {
  const toggle = (f: NonNullable<Filter>) =>
    onChange(filter && filter.kind === f.kind && filter.value === f.value ? null : f);
  return (
    <div className="chips">
      {GROUP_CHIPS.map((g) => (
        <button
          key={g}
          className={`chip ${filter?.kind === 'group' && filter.value === g ? 'on' : ''}`}
          onClick={() => toggle({ kind: 'group', value: g })}
        >
          {GROUP_LABEL[g]}
        </button>
      ))}
      {EQUIP_CHIPS.map((q) => (
        <button
          key={q}
          className={`chip ${filter?.kind === 'equip' && filter.value === q ? 'on' : ''}`}
          onClick={() => toggle({ kind: 'equip', value: q })}
        >
          {EQUIPMENT_LABEL[q]}
        </button>
      ))}
    </div>
  );
}
