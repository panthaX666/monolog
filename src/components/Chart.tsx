import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { niceTicks } from '../domain/progress';
import type { DayKey } from '../domain/types';
import { formatDay } from '../lib/format';

// Line chart & bar chart in plain SVG, following the dataviz rules: thin 2px lines, ≥8px dots with
// a 2px surface ring, hairline solid grid, one y-axis, tap/hover crosshair + readout, and a table
// view so no value is only reachable by tapping. Gold marks = records (the app's only accent).

export interface ChartPoint {
  day: DayKey;
  value: number;
  /** Gold marker (a record was set). */
  record?: boolean;
}

interface LineChartProps {
  label: string;
  points: ChartPoint[];
  /** Optional emphasised line (e.g. 7-day average); `points` are then drawn as grey dots only. */
  line?: ChartPoint[];
  format: (v: number) => string;
  /** Flip the y-axis so "up" means better when lower values are better (pace). */
  invert?: boolean;
  height?: number;
  /** Shown when there are no points (default: nothing in the chosen range). */
  empty?: string;
}

const PAD = { top: 12, right: 12, bottom: 26, left: 44 };
const ms = (day: DayKey) => Date.parse(`${day}T12:00:00Z`);

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(320);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(200, Math.round(el.getBoundingClientRect().width)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function LineChart({ label, points, line, format, invert = false, height = 190, empty }: LineChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();

  if (points.length === 0) return <p className="t-meta chart-empty">{empty ?? 'No data in this range yet.'}</p>;

  const all = [...points, ...(line ?? [])];
  const xs = points.map((p) => ms(p.day));
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const ticks = niceTicks(Math.min(...all.map((p) => p.value)), Math.max(...all.map((p) => p.value)), 3);
  const y0 = ticks[0]!;
  const y1 = ticks[ticks.length - 1]!;
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const sx = (day: DayKey) => (x1 === x0 ? PAD.left + plotW / 2 : PAD.left + ((ms(day) - x0) / (x1 - x0)) * plotW);
  const sy = (v: number) => {
    const t = (v - y0) / (y1 - y0 || 1);
    return PAD.top + (invert ? t : 1 - t) * plotH;
  };

  const main = line ?? points;
  const path = main.map((p, i) => `${i ? 'L' : 'M'}${sx(p.day).toFixed(1)},${sy(p.value).toFixed(1)}`).join('');
  const dense = points.length > 40;

  // X labels: first, last, and up to two evenly spaced in between.
  const xLabelIdx = [...new Set([0, Math.round((points.length - 1) / 3), Math.round(((points.length - 1) * 2) / 3), points.length - 1])];

  const nearest = (clientX: number, rect: DOMRect) => {
    const x = clientX - rect.left;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(sx(points[i]!.day) - x) < Math.abs(sx(points[best]!.day) - x)) best = i;
    return best;
  };
  const onPointer = (e: PointerEvent<SVGRectElement>) => setActive(nearest(e.clientX, e.currentTarget.ownerSVGElement!.getBoundingClientRect()));
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? points.length) - 1));
    else if (e.key === 'ArrowRight') setActive((a) => Math.min(points.length - 1, (a ?? -1) + 1));
    else if (e.key === 'Escape') setActive(null);
    else return;
    e.preventDefault();
  };

  const a = active != null ? points[active] : null;
  const aLine = a && line ? line.find((p) => p.day === a.day) : null;
  // The readout sits above the plot: latest value by default, the tapped point when one is active.
  const shownPt = a ?? points[points.length - 1]!;
  const shownLine = a ? aLine : line?.[line.length - 1];

  return (
    <div className="chart" ref={ref}>
      <div className="chart-readout" role="status" aria-live="polite">
        <b>{format(shownPt.value)}</b>
        {shownLine && <span className="t-meta"> · avg {format(shownLine.value)}</span>}
        <span className="t-meta">
          {' '}
          · {formatDay(shownPt.day)}
          {shownPt.record && ' · ★ record'}
          {!a && points.length > 1 && ' · latest, tap the chart for others'}
        </span>
      </div>
      <svg
        width={width}
        height={height}
        role="img"
        aria-labelledby={titleId}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        <title id={titleId}>{label}</title>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={PAD.left} x2={width - PAD.right} y1={sy(t)} y2={sy(t)} />
            <text className="axis" x={PAD.left - 6} y={sy(t)} textAnchor="end" dominantBaseline="middle">
              {format(t)}
            </text>
          </g>
        ))}
        {xLabelIdx.map((i) => (
          <text
            key={i}
            className="axis"
            x={sx(points[i]!.day)}
            y={height - 6}
            textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
          >
            {formatDay(points[i]!.day)}
          </text>
        ))}
        {a && <line className="crosshair" x1={sx(a.day)} x2={sx(a.day)} y1={PAD.top} y2={PAD.top + plotH} />}
        {line &&
          points.map((p) => <circle key={`d${p.day}`} className="dot-muted" cx={sx(p.day)} cy={sy(p.value)} r={3.5} />)}
        {main.length > 1 && <path className="line" d={path} />}
        {!line &&
          points.map((p, i) =>
            p.record || !dense || i === active || i === points.length - 1 ? (
              <circle
                key={p.day + i}
                className={p.record ? 'dot-record' : 'dot'}
                cx={sx(p.day)}
                cy={sy(p.value)}
                r={p.record ? 5 : 4}
              />
            ) : null,
          )}
        {a && <circle className={a.record ? 'dot-record' : 'dot'} cx={sx(a.day)} cy={sy(aLine?.value ?? a.value)} r={6} />}
        <rect
          className="hit"
          x={PAD.left - 10}
          y={0}
          width={plotW + 20}
          height={height}
          onPointerDown={onPointer}
          onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons) && onPointer(e)}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
        />
      </svg>
    </div>
  );
}

/** Horizontal bars, one colour, value at the tip (dataviz: ≤24px bars, 4px rounded ends). */
export function BarChart({ label, rows, format }: { label: string; rows: { label: string; value: number }[]; format: (v: number) => string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const max = Math.max(1, ...rows.map((r) => r.value));
  const labelW = 84;
  const valueW = 40;
  const barH = 18;
  const rowH = 32;
  const plotW = width - labelW - valueW;
  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={rows.length * rowH} role="img" aria-label={label}>
        {rows.map((r, i) => {
          const w = r.value > 0 ? Math.max(4, (r.value / max) * plotW) : 0;
          const y = i * rowH + (rowH - barH) / 2;
          return (
            <g key={r.label}>
              <title>{`${r.label}: ${format(r.value)}`}</title>
              <text className="axis axis-strong" x={0} y={y + barH / 2} dominantBaseline="middle">
                {r.label}
              </text>
              <line className="grid" x1={labelW} x2={labelW} y1={i * rowH + 4} y2={(i + 1) * rowH - 4} />
              {w > 0 && <path className="bar" d={barPath(labelW, y, w, barH)} />}
              <text className="axis axis-strong" x={labelW + w + 6} y={y + barH / 2} dominantBaseline="middle">
                {format(r.value)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Square at the baseline, 4px rounded at the data end. */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w, h / 2);
  return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
}

/** Chart + legend + "Show as table" (every value reachable without tapping). */
export function ChartCard({
  title,
  legend,
  table,
  children,
  controls,
}: {
  title: string;
  legend?: ReactNode;
  table: { head: string[]; rows: (string | number)[][] };
  children: ReactNode;
  controls?: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className="card chart-card" aria-label={title}>
      <div className="row">
        <span className="t-label">{title}</span>
        {table.rows.length > 0 && (
          <button className="link" onClick={() => setShowTable(!showTable)}>
            {showTable ? 'Show chart' : 'Show as table'}
          </button>
        )}
      </div>
      {controls}
      {showTable ? (
        <div className="chart-table-wrap">
          <table className="chart-table">
            <thead>
              <tr>
                {table.head.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...table.rows].reverse().map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {children}
          {legend && <div className="legend">{legend}</div>}
        </>
      )}
    </section>
  );
}

export function LegendLine({ children }: { children: ReactNode }) {
  return (
    <span className="legend-item">
      <span className="key-line" aria-hidden="true" />
      {children}
    </span>
  );
}
export function LegendDot({ children, tone }: { children: ReactNode; tone: 'muted' | 'record' }) {
  return (
    <span className="legend-item">
      <span className={`key-dot ${tone}`} aria-hidden="true" />
      {children}
    </span>
  );
}
