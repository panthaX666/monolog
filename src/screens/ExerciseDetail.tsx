import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { ChartCard, LegendDot, LineChart } from '../components/Chart';
import { bestRows } from '../components/RecordsPopover';
import { getDb } from '../data/db';
import { useSettings, useToday } from '../data/hooks';
import { updateExercise } from '../data/repo';
import { formatKm, formatPace, formatSeconds, formatSet } from '../domain/measure';
import { EQUIPMENT_LABEL, MUSCLE_LABEL } from '../domain/muscles';
import {
  inRange,
  LOWER_IS_BETTER,
  METRICS_BY_TYPE,
  progressSeries,
  RANGES,
  type ProgressMetric,
  type Range,
} from '../domain/progress';
import { compareChrono, estimate1RM, isEligible } from '../domain/records';
import type { Exercise, RecordEvent, Unit, WorkoutSet } from '../domain/types';
import { displayWeight, formatWeight, fromKg } from '../domain/units';
import { formatClock, formatDay, formatWeekday, plural } from '../lib/format';
import { href, navigate } from '../lib/route';

type Tab = 'records' | 'chart' | 'history' | 'notes';
const RECORD_TITLE = {
  weight: 'Weight record',
  reps: 'Rep record',
  duration: 'Time record',
  distance: 'Distance record',
  pace: 'Pace record',
} as const;
const REST_STEPS = [30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300];
const TYPE_LABEL = {
  weight_reps: 'Weight × reps',
  bodyweight_reps: 'Bodyweight',
  timed: 'Timed',
  cardio: 'Cardio',
} as const;

/** Exercise detail (SPEC N11): Records · Chart · History · Notes, pinned note, unit and rest length. */
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
  const db = getDb();
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
        {ex.type !== 'cardio' && (
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
        )}
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
        {(['records', 'chart', 'history', 'notes'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t[0]!.toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'records' && <RecordsTab ex={ex} sets={sets} events={events} unit={unit} />}
      {tab === 'chart' && <ChartTab ex={ex} sets={sets} events={events} unit={unit} />}
      {tab === 'history' && <HistoryTab ex={ex} sets={sets} unit={unit} />}
      {tab === 'notes' && <NotesTab sets={sets} />}
    </main>
  );
}

function recordValue(e: RecordEvent, unit: Unit): string {
  switch (e.kind) {
    case 'weight':
      return `${formatWeight(Math.round(fromKg(e.before.value, unit) * 10) / 10)} ${unit}`;
    case 'reps':
      return `${e.before.value} reps`;
    case 'duration':
      return formatSeconds(e.before.value);
    case 'distance':
      return formatKm(e.before.value);
    case 'pace':
      return formatPace(e.before.value);
  }
}

function RecordsTab({ ex, sets, events, unit }: { ex: Exercise; sets: WorkoutSet[]; events: RecordEvent[]; unit: Unit }) {
  const rows = bestRows(ex.id, ex.type, sets, unit);
  const setById = new Map(sets.map((s) => [s.id, s]));
  const working = sets.filter(isEligible).filter((s) => s.reps);
  const best1rm =
    ex.type === 'weight_reps'
      ? working.reduce<{ v: number; s: WorkoutSet } | null>((topSet, s) => {
          const v = estimate1RM(s.weightKg ?? 0, s.reps!);
          return !topSet || v > topSet.v ? { v, s } : topSet;
        }, null)
      : null;
  const sessions = new Set(sets.map((s) => s.sessionId)).size;

  if (!rows.length)
    return <p className="t-meta">No working sets logged yet. Records appear after your first workout with this exercise.</p>;

  return (
    <>
      <section className="card">
        {rows.map((r) => (
          <div className="pop-row" key={r.label}>
            <span className="t-meta">{r.label}</span>
            <span>
              <b>{r.value}</b>
              {r.day && (
                <>
                  <br />
                  <small className="t-meta">{formatDay(r.day)}</small>
                </>
              )}
            </span>
          </div>
        ))}
        {best1rm && (
          <div className="pop-row">
            <span className="t-meta">Est. 1-rep max</span>
            <span>
              <b>
                {formatWeight(Math.round(fromKg(best1rm.v, unit) * 10) / 10)} {unit}
              </b>
              <br />
              <small className="t-meta">from {formatSet(best1rm.s, ex.type, unit)}</small>
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
              <span className="star">★</span> {RECORD_TITLE[e.kind]}
              <br />
              <small>
                {formatSet(s, ex.type, unit)} · was {recordValue(e, unit)}
              </small>
            </span>
            <small>{formatDay(e.dayKey)}</small>
          </button>
        );
      })}
    </>
  );
}

function metricFormat(metric: ProgressMetric): (v: number) => string {
  switch (metric) {
    case 'e1rm':
    case 'top':
      return (v) => `${formatWeight(v)}`;
    case 'volume':
      return (v) => Math.round(v).toLocaleString();
    case 'reps':
    case 'totalReps':
      return (v) => String(Math.round(v));
    case 'hold':
    case 'time':
      return (v) => formatSeconds(v);
    case 'distance':
      return (v) => (v / 1000).toFixed(1);
    case 'pace':
      return (v) => formatSeconds(v * 1000);
  }
}

function metricUnit(metric: ProgressMetric, unit: Unit): string {
  return { e1rm: unit, top: unit, volume: unit, reps: 'reps', totalReps: 'reps', hold: '', time: '', distance: 'km', pace: '/km' }[metric];
}

function ChartTab({ ex, sets, events, unit }: { ex: Exercise; sets: WorkoutSet[]; events: RecordEvent[]; unit: Unit }) {
  const today = useToday();
  const options = METRICS_BY_TYPE[ex.type];
  const [metric, setMetric] = useState<ProgressMetric>(options[0]!.key);
  const [range, setRange] = useState<Range>('6M');
  const all = progressSeries(metric, sets, events, unit);
  const points = inRange(all, range, today);
  const fmt = metricFormat(metric);
  const u = metricUnit(metric, unit);
  const label = options.find((o) => o.key === metric)!.label;
  const withUnit = (v: number) => `${fmt(v)}${u ? ` ${u}` : ''}`;

  return (
    <ChartCard
      title={`${label}${u ? ` (${u})` : ''} per workout`}
      controls={
        <>
          <div className="range-chips" role="group" aria-label="Measure">
            {options.map((o) => (
              <button key={o.key} className={`chip ${metric === o.key ? 'on' : ''}`} onClick={() => setMetric(o.key)}>
                {o.label}
              </button>
            ))}
          </div>
          <div className="range-chips" role="group" aria-label="Time range">
            {RANGES.map((r) => (
              <button key={r} className={`chip ${range === r ? 'on' : ''}`} onClick={() => setRange(r)}>
                {r}
              </button>
            ))}
          </div>
        </>
      }
      legend={points.some((p) => p.record) ? <LegendDot tone="record">Workout with a record</LegendDot> : undefined}
      table={{
        head: ['Date', u ? `${label} (${u})` : label, 'Record'],
        rows: points.map((p) => [formatDay(p.day), fmt(p.value), p.record ? '★' : '']),
      }}
    >
      <LineChart
        label={`${ex.name}: ${label} per workout, ${range}`}
        points={points}
        format={fmt}
        invert={LOWER_IS_BETTER.includes(metric)}
      />
      {points.length > 0 && (
        <p className="t-meta" style={{ margin: '8px 0 0' }}>
          Latest {withUnit(points[points.length - 1]!.value)} · {plural(points.length, 'workout')}
          {LOWER_IS_BETTER.includes(metric) && ' · faster is higher'}
        </p>
      )}
    </ChartCard>
  );
}

function HistoryTab({ ex, sets, unit }: { ex: Exercise; sets: WorkoutSet[]; unit: Unit }) {
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
        const volume =
          ex.type === 'weight_reps'
            ? working.reduce((v, s) => v + (displayWeight(s.weight ?? 0, s.unit, unit) ?? 0) * (s.reps ?? 0), 0)
            : null;
        return (
          <button key={g[0]!.sessionId} className="card history-card" onClick={() => navigate(href.session(g[0]!.sessionId))}>
            <div className="row">
              <b>{formatWeekday(g[0]!.dayKey)}</b>
              {volume != null && (
                <span className="t-meta">
                  {Math.round(volume).toLocaleString()} {unit}
                </span>
              )}
            </div>
            <div className="t-meta" style={{ marginTop: 4 }}>
              {g.map((s) => `${s.kind === 'warmup' ? 'W ' : ''}${formatSet(s, ex.type, unit)}${s.toFailure ? ' F' : ''}`).join(' · ')}
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
