import type { CardData } from '../data/hooks';
import { formatKm, formatPace, formatSeconds, pace } from '../domain/measure';
import { bestRepsAt, bests, isEligible } from '../domain/records';
import type { DayKey, ExerciseType, Unit, WorkoutSet } from '../domain/types';
import { displayWeight, formatWeight, toKg } from '../domain/units';
import { formatDay } from '../lib/format';
import { weightText } from './ExerciseCard';
import { Dialog } from './Sheet';

export interface BestRow {
  label: string;
  value: string;
  day: DayKey | null;
}

function top(sets: WorkoutSet[], f: (s: WorkoutSet) => number | null, lower = false): WorkoutSet | null {
  let best: WorkoutSet | null = null;
  let bv: number | null = null;
  for (const s of sets) {
    const v = f(s);
    if (v == null) continue;
    if (bv == null || (lower ? v < bv : v > bv)) {
      best = s;
      bv = v;
    }
  }
  return best;
}

/** The headline bests for an exercise, by type (used by the popover and the exercise page). */
export function bestRows(exerciseId: string, type: ExerciseType, history: WorkoutSet[], unit: Unit): BestRow[] {
  const sets = history.filter((s) => s.exerciseId === exerciseId && isEligible(s));
  const row = (label: string, s: WorkoutSet | null, value: (s: WorkoutSet) => string): BestRow[] =>
    s ? [{ label, value: value(s), day: s.dayKey }] : [];
  const bw = type !== 'weight_reps';
  const w = (s: WorkoutSet) => `${weightText(s, unit, bw)} ${unit}${bw ? ' added' : ''}`;
  switch (type) {
    case 'weight_reps':
    case 'bodyweight_reps': {
      const { maxWeight, maxReps } = bests(exerciseId, sets);
      return [
        ...row('Max weight', maxWeight, (s) => `${w(s)} × ${s.reps}`),
        ...row('Max reps', maxReps, (s) => `${s.reps} @ ${w(s)}`),
      ];
    }
    case 'timed':
      return [
        ...row('Longest hold', top(sets, (s) => s.durationSec), (s) => formatSeconds(s.durationSec)),
        ...row('Heaviest', top(sets.filter((s) => (s.weightKg ?? 0) > 0), (s) => s.weightKg), (s) => `${w(s)} · ${formatSeconds(s.durationSec)}`),
      ];
    case 'cardio':
      return [
        ...row('Farthest', top(sets, (s) => s.distanceM), (s) => formatKm(s.distanceM)),
        ...row('Fastest pace', top(sets, pace, true), (s) => `${formatPace(pace(s))} · ${formatKm(s.distanceM)}`),
        ...row('Longest', top(sets, (s) => s.durationSec), (s) => formatSeconds(s.durationSec)),
      ];
  }
}

/** Records popover (SPEC N2): bests for this exercise, plus best reps at the weight in use now. */
export function RecordsPopover({ card, unit, onClose }: { card: CardData; unit: Unit; onClose: () => void }) {
  const type = card.exercise.type;
  const rows = bestRows(card.exercise.id, type, card.history, unit);
  const current = card.sets.find((s) => !s.loggedAt) ?? card.sets[card.sets.length - 1];
  const showAt = type === 'weight_reps' || type === 'bodyweight_reps';
  const currentKg = current?.weight != null ? toKg(current.weight, current.unit) : type === 'bodyweight_reps' ? 0 : null;
  const atCurrent = currentKg != null ? bestRepsAt(card.exercise.id, card.history, currentKg) : null;

  return (
    <Dialog onClose={onClose} label={`Records for ${card.exercise.name}`}>
      <div className="t-h2 pop-title">
        <span className="rec-sq" />
        {card.exercise.name}
      </div>
      {rows.length ? (
        <>
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
          {showAt && current && currentKg != null && (
            <div className="pop-row">
              <span className="t-meta">
                At {formatWeight(displayWeight(current.weight ?? 0, current.unit, unit))} {unit}
              </span>
              <span>
                <b>{atCurrent != null ? `best ${atCurrent} reps` : 'never done'}</b>
              </span>
            </div>
          )}
        </>
      ) : (
        <p className="t-meta">No records yet. Log a working set to set your first.</p>
      )}
      <button className="btn btn-secondary" style={{ width: '100%', marginTop: 14 }} onClick={onClose}>
        Close
      </button>
    </Dialog>
  );
}
