import { useState } from 'react';
import { formatWeight, stepWeight } from '../domain/units';
import { Sheet } from './Sheet';

export type PadField = 'weight' | 'reps';

interface Props {
  field: PadField;
  weight: number | null;
  reps: number | null;
  weightLabel: string;
  step: number;
  onChange: (field: PadField, value: number | null) => void;
  onFieldChange: (field: PadField) => void;
  onLog: () => void;
  onClose: () => void;
}

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'del'] as const;

const show = (field: PadField, v: number | null) => (v == null ? '' : field === 'weight' ? formatWeight(v) : String(v));

/**
 * Custom number pad (SPEC N4). The first key typed replaces the value (calculator-style);
 * −/+ step the weight. Every change is saved immediately.
 */
export function NumberPad({ field, weight, reps, weightLabel, step, onChange, onFieldChange, onLog, onClose }: Props) {
  // `fresh` = next digit replaces the value. Reset whenever the active field changes.
  const [edit, setEdit] = useState<{ field: PadField; buf: string; fresh: boolean }>({
    field,
    buf: show(field, field === 'weight' ? weight : reps),
    fresh: true,
  });
  const cur = edit.field === field ? edit : { field, buf: show(field, field === 'weight' ? weight : reps), fresh: true };

  const commit = (buf: string, fresh: boolean) => {
    setEdit({ field, buf, fresh });
    const n = parseFloat(buf);
    onChange(field, Number.isNaN(n) ? null : field === 'reps' ? Math.round(n) : n);
  };

  const press = (k: (typeof KEYS)[number]) => {
    if (k === 'del') return commit(cur.fresh ? '' : cur.buf.slice(0, -1), false);
    if (k === '.') {
      if (field === 'reps') return;
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
    const base = parseFloat(cur.buf) || 0;
    const next = field === 'weight' ? stepWeight(base, step, dir) : Math.max(0, base + dir);
    commit(show(field, next), true);
  };

  const shown = (f: PadField) => {
    if (f === field) return cur.buf || '—';
    const v = f === 'weight' ? weight : reps;
    return v == null ? '—' : show(f, v);
  };

  return (
    <Sheet onClose={onClose} dim={false} label="Number pad">
      <div className="pad-top">
        <div className={`pad-field ${field === 'weight' ? 'on' : ''}`} onClick={() => onFieldChange('weight')}>
          <div className="t-label">{weightLabel}</div>
          <div className="pad-row">
            <button
              className="step"
              aria-label="Decrease weight"
              style={{ visibility: field === 'weight' ? 'visible' : 'hidden' }}
              onClick={(e) => (e.stopPropagation(), stepBy(-1))}
            >
              −
            </button>
            <div className="num" data-testid="pad-weight">
              {shown('weight')}
            </div>
            <button
              className="step"
              aria-label="Increase weight"
              style={{ visibility: field === 'weight' ? 'visible' : 'hidden' }}
              onClick={(e) => (e.stopPropagation(), stepBy(1))}
            >
              +
            </button>
          </div>
        </div>
        <div className={`pad-field ${field === 'reps' ? 'on' : ''}`} onClick={() => onFieldChange('reps')}>
          <div className="t-label">Reps</div>
          <div className="pad-row">
            <div className="num" data-testid="pad-reps">
              {shown('reps')}
            </div>
          </div>
        </div>
      </div>
      <div className="keys">
        {KEYS.map((k) => (
          <button key={k} className="key" onClick={() => press(k)} aria-label={k === 'del' ? 'Delete' : k}>
            {k === 'del' ? '⌫' : k}
          </button>
        ))}
      </div>
      <div className="pad-actions">
        <button className="btn btn-secondary" onClick={() => onFieldChange(field === 'weight' ? 'reps' : 'weight')}>
          {field === 'weight' ? 'Next: reps →' : '← Weight'}
        </button>
        <button className="btn btn-primary" onClick={onLog}>
          ✓ Log set
        </button>
      </div>
    </Sheet>
  );
}
