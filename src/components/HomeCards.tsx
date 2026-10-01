import { useLiveQuery } from 'dexie-react-hooks';
import { getDb } from '../data/db';
import { useSettings } from '../data/hooks';
import { getCoverage, recentRecords } from '../data/repo';
import { change, checkInDue, latest, rollingAverage, series } from '../domain/body';
import { WEEKLY_TARGET } from '../domain/coverage';
import { weekday, weekStart } from '../domain/dates';
import { formatSet } from '../domain/measure';
import { GROUP_LABEL } from '../domain/muscles';
import { weeklySetsByGroup } from '../domain/progress';
import type { DayKey } from '../domain/types';
import { fromKg } from '../domain/units';
import { formatDay } from '../lib/format';
import { href, navigate } from '../lib/route';
import { formatDelta, useBodyEntries } from '../screens/Body';
import { BarChart } from './Chart';
import { Sheet } from './Sheet';

// Home dashboard cards (SPEC N1): weekly coverage, body weight, recent records, check-in banner.

const fmtSessions = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** This week's sessions per muscle group against the ×2 target. */
export function CoverageCard({ today, onOpen }: { today: DayKey; onOpen: () => void }) {
  const cov = useLiveQuery(() => getCoverage(getDb()), [today]);
  return (
    <button className="card home-card" onClick={onOpen} aria-label="This week's muscle coverage">
      <span className="t-label">This week</span>
      {(cov ?? []).map((g) => (
        <span className="cov-row" key={g.group}>
          <span>{GROUP_LABEL[g.group]}</span>
          <span className="cov-bar" aria-hidden="true">
            {Array.from({ length: WEEKLY_TARGET }, (_, i) => (
              <i key={i} className={g.sessions >= i + 1 ? 'on' : g.sessions > i ? 'half' : ''} />
            ))}
          </span>
          <span className="cov-n">{fmtSessions(g.sessions)}</span>
        </span>
      ))}
    </button>
  );
}

export function CoverageSheet({ today, onClose }: { today: DayKey; onClose: () => void }) {
  const data = useLiveQuery(async () => {
    const db = getDb();
    const [cov, sets, exercises] = await Promise.all([
      getCoverage(db),
      db.sets.where('dayKey').aboveOrEqual(weekStart(today)).toArray(), // the week can start last month
      db.exercises.toArray(),
    ]);
    return { cov, sets: weeklySetsByGroup(sets, new Map(exercises.map((e) => [e.id, e])), today) };
  }, [today]);
  return (
    <Sheet onClose={onClose} label="Weekly coverage">
      <div className="sheet-body">
        <div className="t-h2">This week (Mon–Sun)</div>
        <p className="t-meta" style={{ margin: 0 }}>
          Target: each muscle group {WEEKLY_TARGET}× a week. A secondary muscle counts ½.
        </p>
        {data && (
          <>
            <div className="t-label" style={{ marginTop: 8 }}>
              Working sets
            </div>
            <BarChart
              label="Working sets this week by muscle group"
              rows={data.sets.map((g) => ({ label: GROUP_LABEL[g.group], value: g.sets }))}
              format={fmtSessions}
            />
            <div className="t-label" style={{ marginTop: 8 }}>
              Sessions · last trained
            </div>
            {data.cov.map((g) => (
              <div className="kv" key={g.group}>
                <span>
                  {GROUP_LABEL[g.group]} · {fmtSessions(g.sessions)} / {WEEKLY_TARGET}
                </span>
                <span>
                  {g.daysSince == null ? 'not yet' : g.daysSince === 0 ? 'today' : g.daysSince === 1 ? 'yesterday' : `${g.daysSince} days ago`}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </Sheet>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * 100).toFixed(1)},${(36 - ((v - min) / (max - min || 1)) * 32).toFixed(1)}`)
    .join(' ');
  return (
    <span className="sparkline-wrap" aria-hidden="true">
      <svg className="sparkline" viewBox="0 0 100 40" preserveAspectRatio="none">
        <polyline points={pts} />
      </svg>
    </span>
  );
}

export function BodyWeightCard({ onCheckIn }: { onCheckIn: () => void }) {
  const settings = useSettings();
  const entries = useBodyEntries();
  const unit = settings.unit;
  const weight = series(entries ?? [], 'weightKg');
  const last = latest(weight);
  if (!entries) return <section className="card home-card" />;
  if (!last)
    return (
      <button className="card home-card" onClick={onCheckIn} aria-label="Log your body weight">
        <span className="t-label">Body weight</span>
        <span className="t-meta" style={{ marginTop: 10 }}>
          Not logged yet.
        </span>
        <span className="chip" style={{ marginTop: 'auto', alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center' }}>
          Check in
        </span>
      </button>
    );
  const avg = rollingAverage(weight).slice(-30).map((p) => fromKg(p.value, unit));
  const delta = formatDelta('weightKg', change(weight, 7), unit);
  return (
    <button className="card home-card" onClick={() => navigate('#/body')} aria-label="Body weight">
      <span className="t-label">Body weight</span>
      <span style={{ marginTop: 8 }}>
        <span className="card-num">{fromKg(last.value, unit).toFixed(1)}</span> <span className="t-meta">{unit}</span>
      </span>
      <span className="t-meta">{delta ? `${delta} this week` : formatDay(last.day)}</span>
      <Sparkline values={avg} />
    </button>
  );
}

export function RecordsCard() {
  const settings = useSettings();
  const data = useLiveQuery(async () => {
    const db = getDb();
    const recs = await recentRecords(db, 3);
    return Promise.all(
      recs.map(async (r) => ({ r, ex: await db.exercises.get(r.exerciseId), set: await db.sets.get(r.setId) })),
    );
  }, []);
  if (!data?.length) return null;
  return (
    <section className="card" aria-label="Recent records">
      <span className="t-label">Recent records</span>
      {data.map(({ r, ex, set }) =>
        ex && set ? (
          <button key={r.id} className="rec-row" onClick={() => navigate(href.exercise(ex.id))}>
            <span>
              <span className="star">★</span> {ex.name}
            </span>
            <span className="t-meta">
              {formatSet(set, ex.type, ex.unit ?? settings.unit)} · {formatDay(r.dayKey)}
            </span>
          </button>
        ) : null,
      )}
    </section>
  );
}

export function CheckInBanner({ today, onCheckIn }: { today: DayKey; onCheckIn: () => void }) {
  const settings = useSettings();
  const entries = useBodyEntries();
  if (!entries || !checkInDue(entries, today, settings.checkInDay, weekday(today))) return null;
  return (
    <section className="card banner row">
      <span className="t-meta">ⓘ Weekly check-in due</span>
      <button className="chip" onClick={onCheckIn}>
        Check in
      </button>
    </section>
  );
}
