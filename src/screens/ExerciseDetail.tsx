import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { weightText } from '../components/ExerciseCard';
import { getDb } from '../data/db';
import { useSettings } from '../data/hooks';
import { updateExercise } from '../data/repo';
import { EQUIPMENT_LABEL, MUSCLE_LABEL } from '../domain/muscles';
import { bests, compareChrono, estimate1RM, isEligible } from '../domain/records';
import type { RecordEvent, Unit, WorkoutSet } from '../domain/types';
import { displayWeight, formatWeight, fromKg } from '../domain/units';
import { formatClock, formatDay, formatWeekday, plural } from '../lib/format';
import { href, navigate } from '../lib/route';

type Tab = 'records' | 'history' | 'notes';
const REST_STEPS = [30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300];
const TYPE_LABEL = {
  weight_reps: 'Weight × reps',
  bodyweight_reps: 'Bodyweight',
  timed: 'Timed',
  cardio: 'Cardio',
} as const;

/** Exercise detail (SPEC N11): Records · History · Notes, pinned note, unit and rest length. */
export function ExerciseDetail({ id }: { id: string }) {
  const settings = useSettings();
  const [tab, setTab] = useState<Tab>('records');
  const data = useLiveQuery(async () => {
    const db = getDb();
    const exercise = await db.exercises.get(id);
    if (!exercise) return null;
    const sets = (await db.sets.where('exerciseId').equals(id).toArray()).filter((s) => s.loggedAt).sort(compareChrono);
    const events = (await db.recordEvents.where('exerciseId').equals(id).toArray()).sort((a, b) =>
      a.dayKey === b.dayKey ? (a.at < b.at ? 1 : -1) : a.dayKey < b.dayKey ? 1 : -1,
    );
    return { exercise, sets, events };
  }, [id]);

  if (data === undefined) return <main className="screen" />;
  if (data === null)
    return (
      <main className="screen">
        <p className="t-meta">This exercise no longer exists.</p>
        <button className="btn btn-primary" onClick={() => navigate('#/exercises', true)}>
          Exercises
        </button>
      </main>
    );

  const { exercise: ex, sets, events } = data;
  const unit: Unit = ex.unit ?? settings.unit;
  const bw = ex.type === 'bodyweight_reps';
  const db = getDb();
  const setById = new Map(sets.map((s) => [s.id, s]));
  const w = (s: WorkoutSet) => weightText(s, unit, bw);
  const restIdx = REST_STEPS.indexOf(ex.restSec ?? settings.restDefaultSec);
  const stepRest = (dir: 1 | -1) => {
    const i = Math.min(REST_STEPS.length - 1, Math.max(0, (restIdx < 0 ? 4 : restIdx) + dir));
    void updateExercise(db, ex.id, { restSec: REST_STEPS[i]! === settings.restDefaultSec ? null : REST_STEPS[i]! });
  };

  return (
    <main className="screen stack">
      <header className="row">
        <button className="chip" onClick={() => navigate('#/exercises')} aria-label="Back to Exercises">
          ‹ Exercises
        </button>
        <button className="chip" onClick={() => navigate(href.exerciseEdit(ex.id))} aria-label="Edit exercise">
          ✎ Edit
        </button>
      </header>

      <div>
        <h1 className="t-title">{ex.name}</h1>
        <p className="t-meta" style={{ margin: '6px 0 0' }}>
          {[
            ex.primaryMuscles.map((m) => MUSCLE_LABEL[m]).join(', '),
            ex.equipment.map((q) => EQUIPMENT_LABEL[q]).join(', '),
            TYPE_LABEL[ex.type],
            ...ex.tags,
          ]
            .filter(Boolean)
            .join(' · ')}
          {ex.secondaryMuscles.length > 0 && (
            <>
              <br />
              Also works: {ex.secondaryMuscles.map((m) => MUSCLE_LABEL[m]).join(', ')}
            </>
          )}
          {ex.archivedAt && (
            <>
              <br />
              <b>Archived</b> — hidden from the exercise picker.
            </>
          )}
        </p>
      </div>

      <section className="card">
        <label className="field" style={{ margin: 0 }}>
          <span className="t-label">📌 Pinned note</span>
          <input
            key={ex.pinnedNote}
            defaultValue={ex.pinnedNote}
            placeholder="e.g. Seat 4, rope attachment"
            maxLength={120}
            onBlur={(e) => {
              if (e.target.value.trim() !== ex.pinnedNote) void updateExercise(db, ex.id, { pinnedNote: e.target.value.trim() });
            }}
          />
        </label>
        <div className="menu-row">
          <span>Unit</span>
          <div className="seg">
            {(['kg', 'lb'] as const).map((u) => (
              <button
                key={u}
                className={unit === u ? 'on' : ''}
                onClick={() => void updateExercise(db, ex.id, { unit: u === settings.unit ? null : u })}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
        <div className="menu-row">
          <span>
            Rest
            {ex.restSec == null && <span className="t-meta"> (default)</span>}
          </span>
          <div className="stepper">
            <button onClick={() => stepRest(-1)} aria-label="Shorter rest">
              −
            </button>
            <span className="mono">{formatClock(ex.restSec ?? settings.restDefaultSec)}</span>
            <button onClick={() => stepRest(1)} aria-label="Longer rest">
              +
            </button>
          </div>
        </div>
      </section>

      <div className="seg seg-wide" role="tablist">
        {(['records', 'history', 'notes'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t[0]!.toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'records' && <RecordsTab sets={sets} events={events} setById={setById} unit={unit} w={w} exerciseId={ex.id} />}
      {tab === 'history' && <HistoryTab sets={sets} unit={unit} w={w} />}
      {tab === 'notes' && <NotesTab sets={sets} />}
    </main>
  );
}

function RecordsTab({
  sets,
  events,
  setById,
  unit,
  w,
  exerciseId,
}: {
  sets: WorkoutSet[];
  events: RecordEvent[];
  setById: Map<string, WorkoutSet>;
  unit: Unit;
  w: (s: WorkoutSet) => string;
  exerciseId: string;
}) {
  const { maxWeight, maxReps } = bests(exerciseId, sets);
  const working = sets.filter(isEligible).filter((s) => s.reps);
  const best1rm = working.reduce<{ v: number; s: WorkoutSet } | null>((top, s) => {
    const v = estimate1RM(s.weightKg ?? 0, s.reps!);
    return !top || v > top.v ? { v, s } : top;
  }, null);
  const sessions = new Set(sets.map((s) => s.sessionId)).size;

  if (!maxWeight || !maxReps)
    return <p className="t-meta">No working sets logged yet. Records appear after your first workout with this exercise.</p>;

  return (
    <>
      <section className="card">
        <div className="pop-row">
          <span className="t-meta">Max weight</span>
          <span>
            <b>
              {w(maxWeight)} {unit} × {maxWeight.reps}
            </b>
            <br />
            <small className="t-meta">{formatDay(maxWeight.dayKey)}</small>
          </span>
        </div>
        <div className="pop-row">
          <span className="t-meta">Max reps</span>
          <span>
            <b>
              {maxReps.reps} @ {w(maxReps)} {unit}
            </b>
            <br />
            <small className="t-meta">{formatDay(maxReps.dayKey)}</small>
          </span>
        </div>
        {best1rm && (
          <div className="pop-row">
            <span className="t-meta">Est. 1-rep max</span>
            <span>
              <b>
                {formatWeight(Math.round(fromKg(best1rm.v, unit) * 10) / 10)} {unit}
              </b>
              <br />
              <small className="t-meta">
                from {w(best1rm.s)} × {best1rm.s.reps}
              </small>
            </span>
          </div>
        )}
        <div className="pop-row">
          <span className="t-meta">Workouts</span>
          <span>
            <b>{sessions}</b>
          </span>
        </div>
      </section>

      <div className="t-label list-label">Record timeline</div>
      {events.length === 0 && <p className="t-meta">No records beaten yet — your first workout set the baseline.</p>}
      {events.map((e) => {
        const s = setById.get(e.setId);
        if (!s) return null;
        return (
          <button key={e.id} className="list-item" onClick={() => navigate(href.session(s.sessionId))}>
            <span>
              <span className="star">★</span> {e.kind === 'weight' ? 'Weight record' : 'Rep record'}
              <br />
              <small>
                {w(s)} × {s.reps}
                {e.kind === 'reps' ? ` · was ${e.before.value} reps` : ` · was ${formatWeight(Math.round(fromKg(e.before.value, unit) * 10) / 10)} ${unit}`}
              </small>
            </span>
            <small>{formatDay(e.dayKey)}</small>
          </button>
        );
      })}
    </>
  );
}

function HistoryTab({ sets, unit, w }: { sets: WorkoutSet[]; unit: Unit; w: (s: WorkoutSet) => string }) {
  const bySession = new Map<string, WorkoutSet[]>();
  for (const s of sets) bySession.set(s.sessionId, [...(bySession.get(s.sessionId) ?? []), s]);
  const groups = [...bySession.values()]
    .map((g) => g.sort((a, b) => a.order - b.order))
    .sort((a, b) => (a[0]!.dayKey < b[0]!.dayKey ? 1 : -1));
  if (!groups.length) return <p className="t-meta">No workouts with this exercise yet.</p>;
  return (
    <>
      {groups.map((g) => {
        const working = g.filter((s) => s.kind === 'working');
        const volume = working.reduce((v, s) => v + (displayWeight(s.weight ?? 0, s.unit, unit) ?? 0) * (s.reps ?? 0), 0);
        return (
          <button key={g[0]!.sessionId} className="card history-card" onClick={() => navigate(href.session(g[0]!.sessionId))}>
            <div className="row">
              <b>{formatWeekday(g[0]!.dayKey)}</b>
              <span className="t-meta">
                {Math.round(volume).toLocaleString()} {unit}
              </span>
            </div>
            <div className="t-meta" style={{ marginTop: 4 }}>
              {g.map((s) => `${s.kind === 'warmup' ? 'W ' : ''}${w(s)}×${s.reps}${s.toFailure ? ' F' : ''}`).join(' · ')}
            </div>
          </button>
        );
      })}
    </>
  );
}

function NotesTab({ sets }: { sets: WorkoutSet[] }) {
  const noted = sets.filter((s) => s.note.trim()).reverse();
  if (!noted.length) return <p className="t-meta">No notes yet. Tap ✎ on a set during a workout to add one.</p>;
  const setNumber = (s: WorkoutSet) =>
    sets.filter((x) => x.sessionId === s.sessionId && x.kind === 'working' && x.order <= s.order).length;
  return (
    <>
      {noted.map((s) => (
        <button key={s.id} className="list-item" onClick={() => navigate(href.session(s.sessionId))}>
          <span>
            “{s.note.trim()}”
            <br />
            <small>
              {formatDay(s.dayKey)} · {s.kind === 'warmup' ? 'warm-up' : `set ${setNumber(s)}`}
            </small>
          </span>
        </button>
      ))}
      <p className="t-meta">{plural(noted.length, 'note')}</p>
    </>
  );
}
