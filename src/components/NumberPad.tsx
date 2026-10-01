import { useState } from 'react';
import { digitsToSeconds, formatSeconds, secondsToDigits } from '../domain/measure';
import type { ExerciseType } from '../domain/types';
import { formatWeight, stepWeight } from '../domain/units';
import { Sheet } from './Sheet';

export type PadField = 'weight' | 'reps' | 'duration' | 'distance';

/** The two pad fields each exercise type logs (SPEC D30). */
export function fieldsFor(type: ExerciseType): [PadField, PadField] {
  switch (type) {
    case 'weight_reps':
    case 'bodyweight_reps':
      return ['weight', 'reps'];
    case 'timed':
      return ['weight', 'duration'];
    case 'cardio':
      return ['distance', 'duration'];
  }
}

export interface PadValues {
  /** In the display unit. */
  weight: number | null;
  reps: number | null;
  /** Seconds. */
  duration: number | null;
  /** Metres. */
  distance: number | null;
}

interface Props {
  fields: [PadField, PadField];
  field: PadField;
  values: PadValues;
  labels: Record<PadField, string>;
  step: number;
  onChange: (field: PadField, value: number | null) => void;
  onFieldChange: (field: PadField) => void;
  onLog: () => void;
  onClose: () => void;
}

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'del'] as const;
const DURATION_STEP = 15;
const NAME: Record<PadField, string> = { weight: 'weight', reps: 'reps', duration: 'time', distance: 'distance' };

/** Value → editable buffer. Durations edit as digits (microwave-style), distance as km. */
function toBuf(field: PadField, v: number | null): string {
  if (v == null) return '';
  if (field === 'weight') return formatWeight(v);
  if (field === 'duration') return secondsToDigits(v);
  if (field === 'distance') return String(Math.round(v) / 1000);
  return String(v);
}
function fromBuf(field: PadField, buf: string): number | null {
  if (field === 'duration') return digitsToSeconds(buf);
  const n = parseFloat(buf);
  if (Number.isNaN(n)) return null;
  if (field === 'reps') return Math.round(n);
  if (field === 'distance') return Math.round(n * 1000);
  return n;
}
function show(field: PadField, v: number | null): string {
  if (v == null) return '—';
  if (field === 'weight') return formatWeight(v);
  if (field === 'duration') return formatSeconds(v);
  if (field === 'distance') return (v / 1000).toFixed(2);
  return String(v);
}

/**
 * Custom number pad (SPEC N4). The first key typed replaces the value (calculator-style); −/+ step
 * weight and time. Every change is saved immediately.
 */
export function NumberPad({ fields, field, values, labels, step, onChange, onFieldChange, onLog, onClose }: Props) {
  const [edit, setEdit] = useState<{ field: PadField; buf: string; fresh: boolean }>({
    field,
    buf: toBuf(field, values[field]),
    fresh: true,
  });
  const cur = edit.field === field ? edit : { field, buf: toBuf(field, values[field]), fresh: true };
  const decimals = field === 'weight' || field === 'distance';

  const commit = (buf: string, fresh: boolean) => {
    setEdit({ field, buf, fresh });
    onChange(field, fromBuf(field, buf));
  };

  const press = (k: (typeof KEYS)[number]) => {
    if (k === 'del') return commit(cur.fresh ? '' : cur.buf.slice(0, -1), false);
    if (k === '.') {
      if (!decimals) return;
      if (cur.fresh) return commit('0.', false);
      if (!cur.buf.includes('.')) commit(cur.buf + '.', false);
      return;
    }
    let next = cur.fresh || cur.buf === '0' ? k : cur.buf + k;
    const [, dec] = next.split('.');
    if (next.length > 6 || (dec && dec.length > 2)) next = cur.buf;
    commit(next, false);
  };

  const stepBy = (dir: 1 | -1) => {
    const base = fromBuf(field, cur.buf) ?? 0;
    const next = field === 'weight' ? stepWeight(base, step, dir) : Math.max(0, base + dir * DURATION_STEP);
    commit(toBuf(field, next), true);
  };
  const canStep = (f: PadField) => f === field && (f === 'weight' || f === 'duration');

  const shown = (f: PadField) => {
    if (f !== field) return show(f, values[f]);
    if (f === 'duration') return cur.buf ? formatSeconds(digitsToSeconds(cur.buf)) : '—';
    return cur.buf || '—';
  };

  const [first, second] = fields;
  const other = field === first ? second : first;

  return (
    <Sheet onClose={onClose} dim={false} label="Number pad">
      <div className="pad-top">
        {fields.map((f) => (
          <div key={f} className={`pad-field ${field === f ? 'on' : ''}`} onClick={() => onFieldChange(f)}>
            <div className="t-label">{labels[f]}</div>
            <div className="pad-row">
              {canStep(f) && (
                <button className="step" aria-label={`Decrease ${labels[f]}`} onClick={(e) => (e.stopPropagation(), stepBy(-1))}>
                  −
                </button>
              )}
              <div className="num" data-testid={`pad-${f}`}>
                {shown(f)}
              </div>
              {canStep(f) && (
                <button className="step" aria-label={`Increase ${labels[f]}`} onClick={(e) => (e.stopPropagation(), stepBy(1))}>
                  +
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="keys">
        {KEYS.map((k) => (
          <button
            key={k}
            className="key"
            onClick={() => press(k)}
            aria-label={k === 'del' ? 'Delete' : k}
            disabled={k === '.' && !decimals}
          >
            {k === 'del' ? '⌫' : k}
          </button>
        ))}
      </div>
      <div className="pad-actions">
        <button className="btn btn-secondary" onClick={() => onFieldChange(other)}>
          {field === first ? `Next: ${NAME[second]} →` : `← ${NAME[first][0]!.toUpperCase()}${NAME[first].slice(1)}`}
        </button>
        <button className="btn btn-primary" onClick={onLog}>
          ✓ Log set
        </button>
      </div>
    </Sheet>
  );
}
