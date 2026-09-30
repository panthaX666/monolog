import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { getDb } from '../data/db';
import { createExercise, RepoError } from '../data/repo';
import { formatDay } from '../lib/format';
import { EQUIPMENT_LABEL, GROUP_LABEL, MUSCLE_GROUP, type MuscleGroup } from '../domain/muscles';
import type { Equipment, Exercise, ExerciseType } from '../domain/types';
import { Sheet } from './Sheet';

// Exercise picker (SPEC N3): search, tag filters, Recent, A–Z, create.

const GROUP_CHIPS: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
const EQUIP_CHIPS: Equipment[] = ['machine', 'cable', 'barbell', 'dumbbell', 'bodyweight', 'smith'];
/** Types the workout screen supports so far. Timed & cardio inputs arrive in M4. */
export const LOGGABLE: ExerciseType[] = ['weight_reps', 'bodyweight_reps'];

type Filter = { kind: 'group'; value: MuscleGroup } | { kind: 'equip'; value: Equipment } | null;

function matches(e: Exercise, words: string[], filter: Filter): boolean {
  if (filter?.kind === 'group' && ![...e.primaryMuscles, ...e.secondaryMuscles].some((m) => MUSCLE_GROUP[m] === filter.value))
    return false;
  if (filter?.kind === 'equip' && !e.equipment.includes(filter.value)) return false;
  return words.every((w) => e.nameKey.includes(w));
}

function subtitle(e: Exercise): string {
  const groups = [...new Set(e.primaryMuscles.map((m) => GROUP_LABEL[MUSCLE_GROUP[m]]))];
  return [...groups, ...e.equipment.map((q) => EQUIPMENT_LABEL[q])].join(' · ') || 'Cardio';
}

export function ExercisePicker({
  onPick,
  onClose,
  excludeIds,
}: {
  onPick: (exerciseId: string) => void;
  onClose: () => void;
  excludeIds: Set<string>;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>(null);
  const [error, setError] = useState<string | null>(null);

  const data = useLiveQuery(async () => {
    const db = getDb();
    const exercises = (await db.exercises.toArray()).filter((e) => !e.archivedAt);
    // Last logged day per exercise, for "Recent".
    const last = new Map<string, string>();
    await db.sets.where('loggedAt').above('').each((s) => {
      const prev = last.get(s.exerciseId);
      if (!prev || s.dayKey > prev) last.set(s.exerciseId, s.dayKey);
    });
    return { exercises, last };
  }, []);

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const { recent, all } = useMemo(() => {
    if (!data) return { recent: [], all: [] };
    const hits = data.exercises.filter((e) => matches(e, words, filter)).sort((a, b) => a.name.localeCompare(b.name));
    const recent =
      words.length || filter
        ? []
        : data.exercises
            .filter((e) => data.last.has(e.id))
            .sort((a, b) => (data.last.get(b.id)! > data.last.get(a.id)! ? 1 : -1))
            .slice(0, 6);
    return { recent, all: hits };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, query, filter]);

  const exact = data?.exercises.some((e) => e.nameKey === words.join(' '));

  const create = async () => {
    setError(null);
    try {
      const name = query.trim().replace(/\b\p{Ll}/gu, (c) => c.toUpperCase());
      const primary = filter?.kind === 'group' ? GROUP_DEFAULT_MUSCLE[filter.value] : undefined;
      const ex = await createExercise(getDb(), {
        name,
        type: 'weight_reps',
        primaryMuscles: primary ? [primary] : [],
        equipment: filter?.kind === 'equip' ? [filter.value] : ['other'],
      });
      onPick(ex.id);
    } catch (e) {
      setError(e instanceof RepoError ? e.message : 'Could not create exercise');
    }
  };

  const item = (e: Exercise) => {
    const supported = LOGGABLE.includes(e.type);
    const added = excludeIds.has(e.id);
    return (
      <button
        key={e.id}
        className="list-item"
        disabled={!supported}
        onClick={() => onPick(e.id)}
        aria-label={e.name}
      >
        <span>
          {e.name}
          <br />
          <small>{supported ? subtitle(e) : 'Timed & cardio logging arrives in M4'}</small>
        </span>
        <small>{added ? 'In workout' : data?.last.has(e.id) ? formatDay(data.last.get(e.id)!) : ''}</small>
      </button>
    );
  };

  const toggle = (f: NonNullable<Filter>) =>
    setFilter((cur) => (cur && cur.kind === f.kind && cur.value === f.value ? null : f));

  return (
    <Sheet onClose={onClose} tall label="Add exercise">
      <div className="sheet-head">
        <span className="t-h2">Add exercise</span>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div style={{ padding: '12px 16px 0' }}>
        <input
          className="search"
          type="search"
          placeholder="Search exercises…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search exercises"
          enterKeyHint="search"
        />
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
      </div>
      <div className="sheet-scroll">
        {recent.length > 0 && (
          <>
            <div className="t-label list-label">Recent</div>
            {recent.map(item)}
          </>
        )}
        <div className="t-label list-label">
          {words.length || filter ? `${all.length} result${all.length === 1 ? '' : 's'}` : 'All A–Z'}
        </div>
        {all.map(item)}
        {words.length > 0 && !exact && (
          <button className="list-item create" onClick={() => void create()}>
            ＋ Create “{query.trim()}”
          </button>
        )}
        {error && <p className="t-meta" style={{ color: 'var(--danger)' }}>{error}</p>}
      </div>
    </Sheet>
  );
}

const GROUP_DEFAULT_MUSCLE = {
  chest: 'chest',
  back: 'lats',
  legs: 'quads',
  shoulders: 'side_delts',
  arms: 'biceps',
  core: 'abs',
} as const;
