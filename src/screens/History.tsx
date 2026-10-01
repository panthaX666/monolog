import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { getDb } from '../data/db';
import { useToday } from '../data/hooks';
import { addDays, weekday } from '../domain/dates';
import { isEligible } from '../domain/records';
import { streakSegments } from '../domain/streak';
import type { DayKey, Session } from '../domain/types';
import { formatDuration, formatTime, formatWeekday, plural } from '../lib/format';
import { href, navigate } from '../lib/route';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const pad2 = (n: number) => String(n).padStart(2, '0');

interface SessionRow {
  session: Session;
  exercises: string[];
  sets: number;
  records: number;
}

function monthDays(year: number, month: number): (DayKey | null)[] {
  const first = `${year}-${pad2(month + 1)}-01`;
  const count = new Date(year, month + 1, 0).getDate();
  const lead = (weekday(first) + 6) % 7; // Monday-first
  const cells: (DayKey | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 0; d < count; d++) cells.push(addDays(first, d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

/** History (SPEC N8): month calendar with joined streak bars, then that month's workouts. */
export function History() {
  const today = useToday();
  const [ym, setYm] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const [selected, setSelected] = useState<DayKey | null>(null);

  const data = useLiveQuery(async () => {
    const db = getDb();
    const [sessions, sets, exercises, events, restDays] = await Promise.all([
      db.sessions.toArray(),
      db.sets.where('loggedAt').above('').toArray(),
      db.exercises.toArray(),
      db.recordEvents.toArray(),
      db.restDays.toArray(),
    ]);
    const exName = new Map(exercises.map((e) => [e.id, e.name]));
    const trained = new Set<DayKey>();
    const bySession = new Map<string, { exIds: string[]; sets: number }>();
    for (const s of sets) {
      if (isEligible(s)) trained.add(s.dayKey);
      const g = bySession.get(s.sessionId) ?? { exIds: [], sets: 0 };
      if (!g.exIds.includes(s.exerciseId)) g.exIds.push(s.exerciseId);
      if (s.kind === 'working') g.sets += 1;
      bySession.set(s.sessionId, g);
    }
    const recordsBySession = new Map<string, number>();
    const setSession = new Map(sets.map((s) => [s.id, s.sessionId]));
    for (const e of events) {
      const sid = setSession.get(e.setId);
      if (sid) recordsBySession.set(sid, (recordsBySession.get(sid) ?? 0) + 1);
    }
    const rows: SessionRow[] = sessions
      .filter((s) => s.endedAt !== null)
      .map((session) => {
        const g = bySession.get(session.id) ?? { exIds: [], sets: 0 };
        return {
          session,
          exercises: g.exIds.map((id) => exName.get(id) ?? '—'),
          sets: g.sets,
          records: recordsBySession.get(session.id) ?? 0,
        };
      })
      .sort((a, b) => (a.session.startedAt < b.session.startedAt ? 1 : -1));
    const rest = new Set(restDays.map((r) => r.dayKey));
    const segments = streakSegments({ trainedDays: trained, restDays: rest, today });
    // Day → its streak segment (only runs of 3+ are drawn as bars, D12).
    const inRun = new Map<DayKey, { start: DayKey; end: DayKey }>();
    for (const seg of segments) {
      if (seg.length < 3) continue;
      for (let d = seg.start; d <= seg.end; d = addDays(d, 1)) inRun.set(d, seg);
    }
    return { rows, trained, rest, inRun };
  }, [today]);

  const cells = monthDays(ym.y, ym.m);
  const monthPrefix = `${ym.y}-${pad2(ym.m + 1)}`;
  const isCurrentMonth = today.startsWith(monthPrefix);
  const shift = (dir: 1 | -1) => {
    setSelected(null);
    setYm(({ y, m }) => {
      const n = m + dir;
      return n < 0 ? { y: y - 1, m: 11 } : n > 11 ? { y: y + 1, m: 0 } : { y, m: n };
    });
  };
  const monthLabel = new Date(ym.y, ym.m, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const rows = (data?.rows ?? []).filter((r) =>
    selected ? r.session.dayKey === selected : r.session.dayKey.startsWith(monthPrefix),
  );
  const restInView = [...(data?.rest ?? [])]
    .filter((d) => (selected ? d === selected : d.startsWith(monthPrefix)))
    .filter((d) => !data?.trained.has(d));

  // Interleave workouts and rest days, newest first.
  const items: ({ kind: 'session'; row: SessionRow } | { kind: 'rest'; day: DayKey })[] = [
    ...rows.map((row) => ({ kind: 'session' as const, row })),
    ...restInView.map((day) => ({ kind: 'rest' as const, day })),
  ].sort((a, b) => {
    const da = a.kind === 'session' ? a.row.session.dayKey : a.day;
    const dbk = b.kind === 'session' ? b.row.session.dayKey : b.day;
    return da === dbk ? 0 : da < dbk ? 1 : -1;
  });

  return (
    <main className="screen">
      <h1 className="t-title">History</h1>

      <section className="card calendar" aria-label="Calendar">
        <div className="row">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month">
            ‹
          </button>
          <span className="t-h2">{monthLabel}</span>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month" disabled={isCurrentMonth}>
            ›
          </button>
        </div>
        <div className="cal-grid" role="grid">
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="cal-head">
              {d}
            </span>
          ))}
          {cells.map((day, i) => {
            if (!day) return <span key={`x${i}`} />;
            const col = i % 7;
            const status = data?.trained.has(day) ? 'trained' : data?.rest.has(day) ? 'rest' : 'empty';
            const run = data?.inRun.get(day);
            const runCls = run
              ? `run ${day === run.start || col === 0 ? 'run-l' : ''} ${day === run.end || col === 6 ? 'run-r' : ''}`
              : '';
            const future = day > today;
            return (
              <button
                key={day}
                className={`cal-day ${runCls} ${selected === day ? 'sel' : ''}`}
                onClick={() => setSelected(selected === day ? null : day)}
                disabled={future}
                aria-label={`${formatWeekday(day)}${status !== 'empty' ? `, ${status}` : ''}`}
                aria-pressed={selected === day}
              >
                <span className={`cal-dot ${status} ${day === today ? 'today' : ''}`}>{Number(day.slice(8))}</span>
              </button>
            );
          })}
        </div>
        <div className="t-meta cal-legend">● trained&nbsp;&nbsp;○ rest&nbsp;&nbsp;▬ streak of 3+</div>
      </section>

      <div className="row list-label">
        <span className="t-label">{selected ? formatWeekday(selected) : monthLabel}</span>
        {selected && (
          <button className="chip" onClick={() => setSelected(null)}>
            Show month
          </button>
        )}
      </div>

      {data && items.length === 0 && (
        <p className="t-meta">{selected ? 'Nothing logged this day.' : 'No workouts this month.'}</p>
      )}

      {items.map((it) =>
        it.kind === 'rest' ? (
          <div key={`r${it.day}`} className="list-item rest-row">
            <span>
              Rest day
              <br />
              <small>{formatWeekday(it.day)}</small>
            </span>
            <span className="cal-dot rest small" aria-hidden="true" />
          </div>
        ) : (
          <button
            key={it.row.session.id}
            className="card history-card"
            onClick={() => navigate(href.session(it.row.session.id))}
            aria-label={`Workout ${formatWeekday(it.row.session.dayKey)}`}
          >
            <div className="row">
              <b>{formatWeekday(it.row.session.dayKey)}</b>
              <span className="t-meta">
                {formatTime(it.row.session.startedAt)} ·{' '}
                {formatDuration((Date.parse(it.row.session.endedAt!) - Date.parse(it.row.session.startedAt)) / 1000)}
                {it.row.records > 0 && <span className="star"> ★{it.row.records}</span>}
              </span>
            </div>
            <div className="t-meta" style={{ marginTop: 4 }}>
              {it.row.exercises.slice(0, 3).join(' · ')}
              {it.row.exercises.length > 3 && ` · +${it.row.exercises.length - 3} more`}
              {' · '}
              {plural(it.row.sets, 'set')}
            </div>
          </button>
        ),
      )}
    </main>
  );
}
