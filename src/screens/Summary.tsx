import { useLiveQuery } from 'dexie-react-hooks';
import { getDb } from '../data/db';
import { useSettings } from '../data/hooks';
import { getStreak } from '../data/repo';
import { GROUP_LABEL, GROUPS, MUSCLE_GROUP } from '../domain/muscles';
import { displayWeight } from '../domain/units';
import { weightText } from '../components/ExerciseCard';
import { formatDuration, formatWeekday, plural } from '../lib/format';
import { navigate } from '../lib/route';

/** Workout summary (SPEC N7). */
export function Summary({ sessionId }: { sessionId: string }) {
  const settings = useSettings();
  const data = useLiveQuery(async () => {
    const db = getDb();
    const session = await db.sessions.get(sessionId);
    if (!session) return null;
    const sets = (await db.sets.where('sessionId').equals(sessionId).toArray()).filter((s) => s.loggedAt);
    const ses = await db.sessionExercises.where('sessionId').equals(sessionId).sortBy('order');
    const exercises = await db.exercises.bulkGet(ses.map((s) => s.exerciseId));
    const records = await db.recordEvents.where('setId').anyOf(sets.map((s) => s.id)).toArray();
    const streak = await getStreak(db);
    return { session, sets, ses, exercises, records, streak };
  }, [sessionId]);

  if (data === undefined) return <main className="screen" />;
  if (data === null)
    return (
      <main className="screen">
        <p className="t-meta">This workout no longer exists.</p>
        <button className="btn btn-primary" onClick={() => navigate('#/', true)}>
          Home
        </button>
      </main>
    );

  const { session, sets, exercises, records, streak } = data;
  const unit = settings.unit;
  const exById = new Map(exercises.filter(Boolean).map((e) => [e!.id, e!]));
  const duration = session.endedAt ? (Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 1000 : 0;
  const working = sets.filter((s) => s.kind === 'working');
  const volume = working.reduce((sum, s) => sum + (displayWeight(s.weight ?? 0, s.unit, unit) ?? 0) * (s.reps ?? 0), 0);
  const groups = GROUPS.filter((g) =>
    working.some((s) => exById.get(s.exerciseId)?.primaryMuscles.some((m) => MUSCLE_GROUP[m] === g)),
  );
  const setById = new Map(sets.map((s) => [s.id, s]));

  return (
    <main className="screen stack summary">
      <header>
        <div className="t-meta">{formatWeekday(session.dayKey)}</div>
        <h1 className="t-title">Workout complete</h1>
      </header>

      <section className="card stats">
        <div>
          <div className="big">{formatDuration(duration)}</div>
          <div className="t-meta">time</div>
        </div>
        <div>
          <div className="big">{data.ses.length}</div>
          <div className="t-meta">{data.ses.length === 1 ? 'exercise' : 'exercises'}</div>
        </div>
        <div>
          <div className="big">{working.length}</div>
          <div className="t-meta">sets</div>
        </div>
        <div>
          <div className="big">{Math.round(volume).toLocaleString()}</div>
          <div className="t-meta">{unit} volume</div>
        </div>
      </section>

      {records.length > 0 && (
        <section className="card">
          <div className="t-label">
            <span className="star">★</span> {plural(records.length, 'record')}
          </div>
          {records.map((r) => {
            const s = setById.get(r.setId)!;
            const ex = exById.get(r.exerciseId);
            const bw = ex?.type === 'bodyweight_reps';
            return (
              <div className="kv" key={r.id}>
                <span>{ex?.name}</span>
                <span>
                  {weightText(s, unit, bw)} × {s.reps} · {r.kind === 'weight' ? 'weight' : 'reps'}
                </span>
              </div>
            );
          })}
        </section>
      )}

      <section className="card">
        <div className="t-label">Exercises</div>
        {data.ses.map((se) => {
          const ex = exById.get(se.exerciseId);
          const mine = sets.filter((s) => s.sessionExerciseId === se.id && s.kind === 'working');
          const bw = ex?.type === 'bodyweight_reps';
          return (
            <div className="kv" key={se.id}>
              <span>{ex?.name}</span>
              <span>{mine.map((s) => `${weightText(s, unit, bw)}×${s.reps}`).join(' · ') || 'warm-ups'}</span>
            </div>
          );
        })}
      </section>

      <section className="card">
        {groups.length > 0 && (
          <div className="kv">
            <span>Muscles</span>
            <span>{groups.map((g) => GROUP_LABEL[g]).join(' · ')}</span>
          </div>
        )}
        <div className="kv">
          <span>Streak</span>
          <span>
            <b style={{ color: 'var(--accent)' }}>{plural(streak.current, 'day')}</b>
          </span>
        </div>
        <div className="kv">
          <span>Volume</span>
          <span>
            {Math.round(volume).toLocaleString()} {unit}
          </span>
        </div>
      </section>

      <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('#/', true)}>
        Done
      </button>
    </main>
  );
}
