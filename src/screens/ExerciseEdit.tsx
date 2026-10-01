import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { getDb } from '../data/db';
import { createExercise, RepoError, setArchived, updateExercise } from '../data/repo';
import { EQUIPMENT, EQUIPMENT_LABEL, GROUP_LABEL, GROUPS, MUSCLE_GROUP, MUSCLE_LABEL, MUSCLES } from '../domain/muscles';
import type { Equipment, Exercise, ExerciseType, Muscle } from '../domain/types';
import { href, navigate } from '../lib/route';

const TYPES: { value: ExerciseType; label: string; hint: string }[] = [
  { value: 'weight_reps', label: 'Weight × reps', hint: 'Barbell, dumbbell, cable, machine' },
  { value: 'bodyweight_reps', label: 'Bodyweight', hint: 'Reps, with optional added weight' },
  { value: 'timed', label: 'Timed', hint: 'Holds like a plank — logging arrives in M4' },
  { value: 'cardio', label: 'Cardio', hint: 'Distance and/or time — logging arrives in M4' },
];
const STANDARD_TAGS = ['compound', 'isolation', 'full_body'];
const TAG_LABEL: Record<string, string> = { compound: 'Compound', isolation: 'Isolation', full_body: 'Full body' };

interface Draft {
  name: string;
  type: ExerciseType;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  equipment: Equipment[];
  tags: string[];
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function MuscleChips({
  selected,
  disabled,
  onToggle,
  label,
}: {
  selected: Muscle[];
  disabled: Muscle[];
  onToggle: (m: Muscle) => void;
  label: string;
}) {
  return (
    <div className="field">
      <span className="t-label">{label}</span>
      {GROUPS.map((g) => (
        <div key={g} className="chip-group">
          <span className="t-meta">{GROUP_LABEL[g]}</span>
          <div className="chip-wrap">
            {MUSCLES.filter((m) => MUSCLE_GROUP[m] === g).map((m) => (
              <button
                key={m}
                className={`chip ${selected.includes(m) ? 'on' : ''}`}
                disabled={disabled.includes(m)}
                aria-pressed={selected.includes(m)}
                onClick={() => onToggle(m)}
              >
                {MUSCLE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Create or edit an exercise (SPEC N12). `id === null` creates a new one. */
export function ExerciseEdit({ id }: { id: string | null }) {
  const db = getDb();
  const loaded = useLiveQuery(async () => {
    if (!id) return { exercise: null as Exercise | null, logged: 0 };
    const exercise = (await db.exercises.get(id)) ?? null;
    const logged = await db.sets.where('exerciseId').equals(id).filter((s) => s.loggedAt != null).count();
    return { exercise, logged };
  }, [id]);

  if (!loaded) return <main className="screen" />;
  if (id && !loaded.exercise)
    return (
      <main className="screen">
        <p className="t-meta">This exercise no longer exists.</p>
      </main>
    );
  return <ExerciseForm existing={loaded.exercise} logged={loaded.logged} />;
}

function ExerciseForm({ existing, logged }: { existing: Exercise | null; logged: number }) {
  const db = getDb();
  const [draft, setDraft] = useState<Draft>(() =>
    existing
      ? {
          name: existing.name,
          type: existing.type,
          primaryMuscles: existing.primaryMuscles,
          secondaryMuscles: existing.secondaryMuscles,
          equipment: existing.equipment,
          tags: existing.tags,
        }
      : { name: '', type: 'weight_reps', primaryMuscles: [], secondaryMuscles: [], equipment: [], tags: [] },
  );
  const [customTag, setCustomTag] = useState('');
  const [error, setError] = useState<string | null>(null);
  const typeLocked = !!existing && logged > 0;
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const back = () => navigate(existing ? href.exercise(existing.id) : '#/exercises');

  const save = async () => {
    setError(null);
    try {
      const payload = { ...draft, equipment: draft.equipment.length ? draft.equipment : (['other'] as Equipment[]) };
      if (existing) {
        await updateExercise(db, existing.id, payload);
        navigate(href.exercise(existing.id), true);
      } else {
        const created = await createExercise(db, payload);
        navigate(href.exercise(created.id), true);
      }
    } catch (e) {
      setError(e instanceof RepoError ? e.message : 'Could not save');
    }
  };

  const addCustomTag = () => {
    const t = customTag.trim().toLowerCase();
    if (t && !draft.tags.includes(t)) set({ tags: [...draft.tags, t] });
    setCustomTag('');
  };

  return (
    <main className="screen stack exercise-edit">
      <header className="row">
        <button className="chip" onClick={back}>
          Cancel
        </button>
        <h1 className="t-h2">{existing ? 'Edit exercise' : 'New exercise'}</h1>
        <button className="chip on" onClick={() => void save()} disabled={!draft.name.trim()}>
          Save
        </button>
      </header>

      {error && (
        <p className="t-meta" role="alert" style={{ color: 'var(--danger)', margin: 0 }}>
          {error}
        </p>
      )}

      <label className="field">
        <span className="t-label">Name</span>
        <input
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="e.g. Cable Y Raise"
          maxLength={80}
          aria-label="Exercise name"
          autoFocus={!existing}
        />
      </label>

      <div className="field">
        <span className="t-label">Type</span>
        {typeLocked && <p className="t-meta" style={{ margin: '4px 0' }}>Locked — this exercise already has logged sets.</p>}
        {TYPES.map((t) => (
          <button
            key={t.value}
            className={`menu-item ${draft.type === t.value ? 'on' : ''}`}
            disabled={typeLocked && draft.type !== t.value}
            onClick={() => set({ type: t.value })}
            aria-pressed={draft.type === t.value}
          >
            <span>
              {t.label}
              <br />
              <small className="t-meta">{t.hint}</small>
            </span>
            {draft.type === t.value && <span aria-hidden="true">✓</span>}
          </button>
        ))}
      </div>

      <MuscleChips
        label="Primary muscles"
        selected={draft.primaryMuscles}
        disabled={[]}
        onToggle={(m) =>
          set({
            primaryMuscles: toggle(draft.primaryMuscles, m),
            secondaryMuscles: draft.secondaryMuscles.filter((x) => x !== m),
          })
        }
      />
      <MuscleChips
        label="Secondary muscles (count ½ toward weekly coverage)"
        selected={draft.secondaryMuscles}
        disabled={draft.primaryMuscles}
        onToggle={(m) => set({ secondaryMuscles: toggle(draft.secondaryMuscles, m) })}
      />

      <div className="field">
        <span className="t-label">Equipment</span>
        <div className="chip-wrap">
          {EQUIPMENT.map((q) => (
            <button
              key={q}
              className={`chip ${draft.equipment.includes(q) ? 'on' : ''}`}
              aria-pressed={draft.equipment.includes(q)}
              onClick={() => set({ equipment: toggle(draft.equipment, q) })}
            >
              {EQUIPMENT_LABEL[q]}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="t-label">Tags</span>
        <div className="chip-wrap">
          {[...STANDARD_TAGS, ...draft.tags.filter((t) => !STANDARD_TAGS.includes(t))].map((t) => (
            <button
              key={t}
              className={`chip ${draft.tags.includes(t) ? 'on' : ''}`}
              aria-pressed={draft.tags.includes(t)}
              onClick={() => set({ tags: toggle(draft.tags, t) })}
            >
              {TAG_LABEL[t] ?? t}
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <input
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustomTag()}
            placeholder="Add a custom tag"
            maxLength={24}
            aria-label="Custom tag"
          />
          <button className="chip" onClick={addCustomTag}>
            Add
          </button>
        </div>
      </div>

      <button className="btn btn-primary" onClick={() => void save()} disabled={!draft.name.trim()}>
        Save
      </button>

      {existing && (
        <button
          className={`btn ${existing.archivedAt ? 'btn-secondary' : 'btn-danger'}`}
          onClick={() => void setArchived(db, existing.id, !existing.archivedAt).then(() => navigate('#/exercises', true))}
        >
          {existing.archivedAt ? 'Unarchive' : 'Archive exercise'}
        </button>
      )}
      {existing && !existing.archivedAt && (
        <p className="t-meta" style={{ margin: 0 }}>
          Archiving hides it from the exercise picker. Its history and records are kept.
        </p>
      )}
    </main>
  );
}
