import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { ChartCard, LegendDot, LegendLine, LineChart } from '../components/Chart';
import { Sheet } from '../components/Sheet';
import { getDb } from '../data/db';
import { useSettings, useToday } from '../data/hooks';
import { clearBodyMetric, saveBodyEntry } from '../data/repo';
import { change, derive, latest, metricInfo, METRICS, rollingAverage, series, type Point } from '../domain/body';
import { BODY_RANGES, inRange, type Range } from '../domain/progress';
import type { BodyEntry, MetricKey, Unit } from '../domain/types';
import { fromKg, toKg } from '../domain/units';
import { formatDay, formatWeekday } from '../lib/format';
import { href, navigate } from '../lib/route';

// Body tab (SPEC N13–N15): latest numbers, weight trend with a 7-day average, check-in, metric pages.

export function useBodyEntries(): BodyEntry[] | undefined {
  return useLiveQuery(() => getDb().bodyEntries.orderBy('dayKey').toArray(), []);
}

/** kg metrics follow the app's weight unit; % and cm don't. */
function displayUnit(key: MetricKey, unit: Unit): string {
  const info = metricInfo(key);
  return info.unit === 'kg' ? unit : info.unit;
}
function toDisplay(key: MetricKey, v: number, unit: Unit): number {
  return metricInfo(key).unit === 'kg' ? fromKg(v, unit) : v;
}
function fromDisplay(key: MetricKey, v: number, unit: Unit): number {
  return metricInfo(key).unit === 'kg' ? toKg(v, unit) : v;
}
export function formatMetric(key: MetricKey, v: number, unit: Unit, withUnit = true): string {
  const d = toDisplay(key, v, unit);
  const u = displayUnit(key, unit);
  return `${d.toFixed(metricInfo(key).decimals)}${withUnit ? (u === '%' ? '%' : ` ${u}`) : ''}`;
}
export function formatDelta(key: MetricKey, delta: number | null, unit: Unit): string | null {
  if (delta == null) return null;
  const d = toDisplay(key, delta, unit);
  if (Math.abs(d) < 0.05) return '±0';
  return `${d > 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(1)}`;
}

/** Check-in sheet (SPEC N14): each tracked metric pre-filled with its last value. */
export function CheckInSheet({ onClose }: { onClose: () => void }) {
  const settings = useSettings();
  const entries = useBodyEntries();
  const today = useToday();
  const unit = settings.unit;
  const tracked = METRICS.filter((m) => settings.trackedMetrics.includes(m.key));
  const [values, setValues] = useState<Partial<Record<MetricKey, string>> | null>(null);

  if (!entries) return null;
  const todays = entries.find((e) => e.dayKey === today);
  const initial = (key: MetricKey): string => {
    const v = todays?.[key] ?? latest(series(entries, key))?.value;
    return v == null ? '' : toDisplay(key, v, unit).toFixed(metricInfo(key).decimals);
  };
  const current = (key: MetricKey) => values?.[key] ?? initial(key);
  const set = (key: MetricKey, v: string) => setValues({ ...(values ?? {}), [key]: v });
  const step = (key: MetricKey, dir: 1 | -1) => {
    const info = metricInfo(key);
    const n = parseFloat(current(key)) || 0;
    set(key, Math.max(0, n + dir * info.step).toFixed(info.decimals));
  };

  const save = async () => {
    const input: Partial<Record<MetricKey, number | null>> = {};
    for (const m of tracked) {
      const n = parseFloat(current(m.key));
      input[m.key] = Number.isFinite(n) && n > 0 ? fromDisplay(m.key, n, unit) : null;
    }
    await saveBodyEntry(getDb(), today, input);
    onClose();
  };

  return (
    <Sheet onClose={onClose} label="Check in">
      <div className="sheet-body">
        <div className="t-h2">Check in · {formatWeekday(today)}</div>
        <p className="t-meta" style={{ margin: 0 }}>
          Pre-filled with your last values. Leave a field empty to skip it.
        </p>
        {tracked.map((m) => (
          <div className="menu-row" key={m.key}>
            <label htmlFor={`ci-${m.key}`}>{m.label}</label>
            <div className="stepper">
              <button onClick={() => step(m.key, -1)} aria-label={`Decrease ${m.label}`}>
                −
              </button>
              <input
                id={`ci-${m.key}`}
                className="num-input"
                inputMode="decimal"
                value={current(m.key)}
                onChange={(e) => set(m.key, e.target.value.replace(',', '.'))}
                aria-label={`${m.label} (${displayUnit(m.key, unit)})`}
              />
              <span className="t-meta unit">{displayUnit(m.key, unit)}</span>
              <button onClick={() => step(m.key, 1)} aria-label={`Increase ${m.label}`}>
                +
              </button>
            </div>
          </div>
        ))}
        <button className="btn btn-primary" onClick={() => void save()}>
          ✓ Save
        </button>
      </div>
    </Sheet>
  );
}

function WeightChart({ points, unit, range, setRange }: { points: Point[]; unit: Unit; range: Range; setRange: (r: Range) => void }) {
  const today = useToday();
  const avg = rollingAverage(points);
  const shown = inRange(points, range, today);
  const shownAvg = inRange(avg, range, today);
  const conv = (p: Point) => ({ day: p.day, value: Math.round(fromKg(p.value, unit) * 10) / 10 });
  return (
    <ChartCard
      title={`Body weight (${unit})`}
      controls={
        <div className="range-chips" role="group" aria-label="Time range">
          {BODY_RANGES.map((r) => (
            <button key={r} className={`chip ${range === r ? 'on' : ''}`} onClick={() => setRange(r)}>
              {r}
            </button>
          ))}
        </div>
      }
      legend={
        <>
          <LegendLine>7-day average</LegendLine>
          <LegendDot tone="muted">Weigh-in</LegendDot>
        </>
      }
      table={{
        head: ['Date', `Weigh-in (${unit})`, `7-day avg (${unit})`],
        rows: shown.map((p, i) => [formatDay(p.day), conv(p).value.toFixed(1), conv(shownAvg[i]!).value.toFixed(1)]),
      }}
    >
      <LineChart
        label={`Body weight, ${range}: weigh-ins and 7-day average`}
        points={shown.map(conv)}
        line={shownAvg.map(conv)}
        format={(v) => v.toFixed(1)}
      />
    </ChartCard>
  );
}

export function Body() {
  const settings = useSettings();
  const entries = useBodyEntries();
  const [checkIn, setCheckIn] = useState(false);
  const [range, setRange] = useState<Range>('3M');
  const unit = settings.unit;

  if (!entries) return <main className="screen" />;

  const weight = series(entries, 'weightKg');
  const last = latest(weight);
  const fat = latest(series(entries, 'bodyFatPct'));
  const d = derive(last?.value ?? null, fat?.value ?? null, settings.heightCm);
  const others = METRICS.filter((m) => m.key !== 'weightKg' && settings.trackedMetrics.includes(m.key));

  return (
    <main className="screen stack">
      <header className="row">
        <h1 className="t-title">Body</h1>
        <button className="chip on" onClick={() => setCheckIn(true)}>
          ＋ Check in
        </button>
      </header>

      {entries.length === 0 ? (
        <section className="card">
          <p className="t-h2" style={{ marginTop: 0 }}>
            No check-ins yet
          </p>
          <p className="t-meta">Log your weight (and body fat, muscle mass, waist if you measure them) once a week to see trends.</p>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setCheckIn(true)}>
            Check in now
          </button>
        </section>
      ) : (
        <>
          {last && (
            <section className="card" aria-label="Body weight">
              <div className="t-label">Body weight · {formatDay(last.day)}</div>
              <div style={{ marginTop: 6 }}>
                <span className="hero-num">{toDisplay('weightKg', last.value, unit).toFixed(1)}</span>{' '}
                <span className="t-h2" style={{ color: 'var(--text-2)' }}>
                  {unit}
                </span>
              </div>
              <div className="t-meta">
                {[
                  formatDelta('weightKg', change(weight, 7), unit) && `${formatDelta('weightKg', change(weight, 7), unit)} this week`,
                  formatDelta('weightKg', change(weight, 30), unit) && `${formatDelta('weightKg', change(weight, 30), unit)} in 30 days`,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Log another weigh-in to see the trend.'}
              </div>
            </section>
          )}

          {weight.length > 0 && <WeightChart points={weight} unit={unit} range={range} setRange={setRange} />}

          <section className="card">
            {others.map((m) => {
              const s = series(entries, m.key);
              const l = latest(s);
              return (
                <button key={m.key} className="metric-row" onClick={() => navigate(href.metric(m.key))}>
                  <span>{m.label}</span>
                  <span className="t-meta">{formatDelta(m.key, change(s, 7), unit) ?? ''}</span>
                  <b>{l ? formatMetric(m.key, l.value, unit) : '—'}</b>
                  <span className="t-meta" aria-hidden="true">
                    ›
                  </span>
                </button>
              );
            })}
            <button className="metric-row" onClick={() => navigate(href.metric('weightKg'))}>
              <span>All weigh-ins</span>
              <span />
              <b>{weight.length}</b>
              <span className="t-meta" aria-hidden="true">
                ›
              </span>
            </button>
          </section>

          <section className="card" aria-label="Calculated">
            <div className="t-label">Calculated</div>
            {settings.heightCm ? (
              <div className="kv">
                <span>BMI</span>
                <span>{d.bmi != null ? d.bmi.toFixed(1) : '—'}</span>
              </div>
            ) : (
              <p className="t-meta">
                Add your height in{' '}
                <button className="link" onClick={() => navigate('#/settings')}>
                  Settings
                </button>{' '}
                for BMI.
              </p>
            )}
            {d.fatMassKg != null && (
              <>
                <div className="kv">
                  <span>Fat mass</span>
                  <span>{formatMetric('weightKg', d.fatMassKg, unit)}</span>
                </div>
                <div className="kv">
                  <span>Lean mass</span>
                  <span>{formatMetric('weightKg', d.leanMassKg!, unit)}</span>
                </div>
              </>
            )}
            {d.fatMassKg == null && <p className="t-meta">Log body fat % to see fat and lean mass.</p>}
          </section>
        </>
      )}

      {checkIn && <CheckInSheet onClose={() => setCheckIn(false)} />}
    </main>
  );
}

/** Metric detail (SPEC N15): chart + every entry, each removable. */
export function MetricDetail({ metric }: { metric: string }) {
  const settings = useSettings();
  const entries = useBodyEntries();
  const today = useToday();
  const [range, setRange] = useState<Range>('All');
  const info = METRICS.find((m) => m.key === metric);
  if (!info) return <main className="screen">Unknown metric.</main>;
  if (!entries) return <main className="screen" />;
  const key = info.key;
  const unit = settings.unit;
  const pts = series(entries, key);
  const shown = inRange(pts, range, today);
  const u = displayUnit(key, unit);
  const conv = (p: Point) => ({ day: p.day, value: Math.round(toDisplay(key, p.value, unit) * 10) / 10 });

  return (
    <main className="screen stack">
      <header className="row">
        <button className="chip" onClick={() => navigate('#/body')} aria-label="Back to Body">
          ‹ Body
        </button>
      </header>
      <h1 className="t-title">{info.label}</h1>
      {key === 'weightKg' ? (
        <WeightChart points={pts} unit={unit} range={range} setRange={setRange} />
      ) : (
        <ChartCard
          title={`${info.label} (${u})`}
          controls={
            <div className="range-chips" role="group" aria-label="Time range">
              {BODY_RANGES.map((r) => (
                <button key={r} className={`chip ${range === r ? 'on' : ''}`} onClick={() => setRange(r)}>
                  {r}
                </button>
              ))}
            </div>
          }
          table={{ head: ['Date', `${info.label} (${u})`], rows: shown.map((p) => [formatDay(p.day), conv(p).value.toFixed(1)]) }}
        >
          <LineChart label={`${info.label}, ${range}`} points={shown.map(conv)} format={(v) => v.toFixed(1)} />
        </ChartCard>
      )}

      <div className="t-label list-label">Entries</div>
      {pts.length === 0 && <p className="t-meta">No entries yet.</p>}
      {[...pts].reverse().map((p) => {
        const entry = entries.find((e) => e.dayKey === p.day)!;
        return (
          <div className="list-item" key={p.day}>
            <span>
              {formatMetric(key, p.value, unit)}
              <br />
              <small>{formatWeekday(p.day)}</small>
            </span>
            <button className="del" aria-label={`Delete ${formatDay(p.day)} entry`} onClick={() => void clearBodyMetric(getDb(), entry.id, key)}>
              ✕
            </button>
          </div>
        );
      })}
    </main>
  );
}
