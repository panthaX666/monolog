import type { CardData } from '../data/hooks';
import { bestRepsAt, bests } from '../domain/records';
import type { Unit } from '../domain/types';
import { displayWeight, formatWeight, toKg } from '../domain/units';
import { formatDay } from '../lib/format';
import { Dialog } from './Sheet';
import { weightText } from './ExerciseCard';

/** Records popover (SPEC N2): max weight, max reps @ weight, best at the weight in use now. */
export function RecordsPopover({ card, unit, onClose }: { card: CardData; unit: Unit; onClose: () => void }) {
  const { maxWeight, maxReps } = bests(card.exercise.id, card.history);
  const bw = card.exercise.type === 'bodyweight_reps';
  const current = card.sets.find((s) => !s.loggedAt) ?? card.sets[card.sets.length - 1];
  const currentKg = current?.weight != null ? toKg(current.weight, current.unit) : bw ? 0 : null;
  const atCurrent = currentKg != null ? bestRepsAt(card.exercise.id, card.history, currentKg) : null;
  const w = (s: NonNullable<typeof maxWeight>) => `${weightText(s, unit, bw)}${bw ? ` ${unit} added` : ` ${unit}`}`;

  return (
    <Dialog onClose={onClose} label={`Records for ${card.exercise.name}`}>
      <div className="t-h2 pop-title">
        <span className="rec-sq" />
        {card.exercise.name}
      </div>
      {maxWeight && maxReps ? (
        <>
          <div className="pop-row">
            <span className="t-meta">Max weight</span>
            <span>
              <b>
                {w(maxWeight)} × {maxWeight.reps}
              </b>
              <br />
              <small className="t-meta">{formatDay(maxWeight.dayKey)}</small>
            </span>
          </div>
          <div className="pop-row">
            <span className="t-meta">Max reps</span>
            <span>
              <b>
                {maxReps.reps} @ {w(maxReps)}
              </b>
              <br />
              <small className="t-meta">{formatDay(maxReps.dayKey)}</small>
            </span>
          </div>
          {current && currentKg != null && (
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
