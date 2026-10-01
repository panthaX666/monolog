import { useState } from 'react';
import { BodyWeightCard, CheckInBanner, CoverageCard, CoverageSheet, RecordsCard } from '../components/HomeCards';
import { Sheet } from '../components/Sheet';
import { CheckInSheet } from './Body';
import { getDb } from '../data/db';
import { useHomeStreak, useOpenSession, useSettings, useToday } from '../data/hooks';
import { logRestDay, removeRestDay, startSession } from '../data/repo';
import { addDays } from '../domain/dates';
import { MAX_REST_RUN } from '../domain/streak';
import { useNow } from '../lib/clock';
import { formatClock, formatWeekday } from '../lib/format';
import { promptInstall, useInstallState } from '../lib/install';
import { navigate } from '../lib/route';

const BACKUP_EVERY = 10;

function InstallCard() {
  const state = useInstallState();
  if (state === 'installed') return null;
  return (
    <section className="card">
      <div className="t-label">Install</div>
      <p className="t-h2" style={{ marginTop: 8 }}>
        Get Monolog as an app
      </p>
      <p className="t-meta">Opens full-screen from your home screen and works offline.</p>
      {state === 'available' ? (
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => void promptInstall()}>
          Install Monolog
        </button>
      ) : (
        <p className="t-meta" style={{ marginBottom: 0 }}>
          Getting ready… if no button appears, use Chrome ⋮ → <b>Install app</b> (not “Create shortcut”).
        </p>
      )}
    </section>
  );
}

function StreakCard({ today }: { today: string }) {
  const s = useHomeStreak(today);
  if (!s) return <section className="card" style={{ minHeight: 150 }} />;

  const before = s.days.filter((d) => !d.inStreak);
  const run = s.days.filter((d) => d.inStreak);
  const dot = (d: (typeof s.days)[number]) => {
    const cls =
      d.day === today && d.status === 'empty' ? 'today' : d.status === 'trained' ? 't' : d.status === 'rest' ? 'r' : 'e';
    return <span key={d.day} className={`dot ${cls}`} title={d.day} />;
  };

  return (
    <section className="card" aria-label="Streak">
      <div className="row" style={{ alignItems: 'baseline' }}>
        <span className="t-label">Streak</span>
        {s.best > 0 && <span className="t-meta">best {s.best}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
        <span className="t-display" data-testid="streak-count">
          {s.current}
        </span>
        <span className="t-h2" style={{ color: 'var(--text-2)' }}>
          {s.current === 1 ? 'day' : 'days'}
        </span>
      </div>
      <div className="dots" aria-hidden="true">
        {before.map(dot)}
        {run.length > 0 && <span className={`streak-run ${s.current >= 3 ? 'lit' : ''}`}>{run.map(dot)}</span>}
      </div>
      <div className="t-meta">
        ● trained&nbsp;&nbsp;○ rest
        {s.current > 0 && (
          <>
            &nbsp;·&nbsp;Rest days in a row: {s.restRun} / {MAX_REST_RUN}
          </>
        )}
      </div>
      {s.yesterdayPending && (
        <p className="t-meta warn" style={{ marginBottom: 0 }}>
          Yesterday is empty — log a workout or rest day for it before midnight to keep the streak.
        </p>
      )}
      {s.current > 0 && s.restRun === MAX_REST_RUN && !s.todayDone && (
        <p className="t-meta warn" style={{ marginBottom: 0 }}>
          3 rest days in a row — train today to keep the streak.
        </p>
      )}
    </section>
  );
}

function RestDaySheet({ today, onClose }: { today: string; onClose: () => void }) {
  const s = useHomeStreak(today);
  const [error, setError] = useState<string | null>(null);
  if (!s) return null;
  const db = getDb();
  const yesterday = addDays(today, -1);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    }
  };

  const option = (day: string, label: string, status: typeof s.todayStatus) => {
    if (status === 'trained') return <p className="t-meta">{label}: already has a workout.</p>;
    if (status === 'rest')
      return (
        <button className="btn btn-secondary" onClick={() => void run(() => removeRestDay(db, day))}>
          Remove rest day · {label}
        </button>
      );
    return (
      <button className="btn btn-primary" onClick={() => void run(() => logRestDay(db, day))}>
        Log rest day · {label}
      </button>
    );
  };

  return (
    <Sheet onClose={onClose} label="Rest day">
      <div className="sheet-body">
        <div className="t-h2">Rest day</div>
        <p className="t-meta" style={{ marginTop: 0 }}>
          A logged rest day keeps your streak going. More than {MAX_REST_RUN} in a row breaks it.
        </p>
        {option(today, `Today, ${formatWeekday(today)}`, s.todayStatus)}
        {option(yesterday, `Yesterday, ${formatWeekday(yesterday)}`, s.yesterdayStatus)}
        {error && (
          <p className="t-meta" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

export function Home() {
  const today = useToday();
  const open = useOpenSession();
  const settings = useSettings();
  const now = useNow(1000);
  const [restSheet, setRestSheet] = useState(false);
  const [checkIn, setCheckIn] = useState(false);
  const [coverage, setCoverage] = useState(false);

  const start = async () => {
    try {
      await startSession(getDb());
    } catch {
      /* a workout is already open — just resume it */
    }
    navigate('#/workout');
  };

  return (
    <>
      <main className="screen stack">
        <header className="row">
          <div>
            <div className="t-meta">{formatWeekday(today)}</div>
            <h1 className="t-title">Today</h1>
          </div>
          <button className="icon-btn" onClick={() => navigate('#/settings')} aria-label="Settings">
            ⚙
          </button>
        </header>

        <InstallCard />
        <StreakCard today={today} />

        {settings.workoutsSinceBackup >= BACKUP_EVERY && (
          <section className="card banner row">
            <span className="t-meta">{settings.workoutsSinceBackup} workouts since your last backup.</span>
            <button className="chip" onClick={() => navigate('#/settings')}>
              Back up
            </button>
          </section>
        )}

        <CheckInBanner today={today} onCheckIn={() => setCheckIn(true)} />
        <div className="grid2">
          <CoverageCard today={today} onOpen={() => setCoverage(true)} />
          <BodyWeightCard onCheckIn={() => setCheckIn(true)} />
        </div>
        <RecordsCard />
      </main>

      <div className="bottom-actions">
        {open ? (
          <button className="btn btn-primary resume" onClick={() => navigate('#/workout')}>
            ● Resume workout · {formatClock((now - Date.parse(open.startedAt)) / 1000)}
          </button>
        ) : (
          <>
            <button className="btn btn-secondary" onClick={() => setRestSheet(true)}>
              Rest day
            </button>
            <button className="btn btn-primary" onClick={() => void start()}>
              ▶ Start workout
            </button>
          </>
        )}
      </div>

      {restSheet && <RestDaySheet today={today} onClose={() => setRestSheet(false)} />}
      {checkIn && <CheckInSheet onClose={() => setCheckIn(false)} />}
      {coverage && <CoverageSheet today={today} onClose={() => setCoverage(false)} />}
    </>
  );
}
