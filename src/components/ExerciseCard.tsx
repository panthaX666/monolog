import type { CardData } from '../data/hooks';
import type { RecordEvent, Unit, WorkoutSet } from '../domain/types';
import { displayWeight, formatWeight } from '../domain/units';
import { formatDay } from '../lib/format';
import type { PadField } from './NumberPad';

export interface CardHandlers {
  onLog: (set: WorkoutSet) => void;
  onPad: (set: WorkoutSet, field: PadField) => void;
  onDelete: (set: WorkoutSet) => void;
  onSetMenu: (set: WorkoutSet) => void;
  onNote: (set: WorkoutSet) => void;
  onNoteSave: (set: WorkoutSet, note: string) => void;
  onAddSet: (card: CardData) => void;
  onRecords: (card: CardData) => void;
  onMenu: (card: CardData) => void;
}

interface Props extends CardHandlers {
  card: CardData;
  unit: Unit;
  records: Map<string, RecordEvent>;
  pad: { setId: string; field: PadField } | null;
  touched: Set<string>;
  noteOpen: string | null;
}

export function weightText(set: Pick<WorkoutSet, 'weight' | 'unit'>, unit: Unit, bodyweight: boolean): string {
  const w = displayWeight(set.weight, set.unit, unit);
  if (w == null) return bodyweight ? '0' : '—';
  return bodyweight && w === 0 ? '0' : formatWeight(w);
}

function lastLine(card: CardData, unit: Unit) {
  if (!card.last.length) return { text: 'First time — no history yet', note: null };
  const bw = card.exercise.type === 'bodyweight_reps';
  const sets = card.last
    .filter((s) => s.kind === 'working')
    .map((s) => (bw && !s.weight ? `${s.reps}` : `${weightText(s, unit, bw)}×${s.reps}`));
  const noted = card.last.find((s) => s.note.trim());
  const idx = noted ? card.last.filter((s) => s.kind === 'working').indexOf(noted) + 1 : 0;
  return {
    text: `Last · ${formatDay(card.last[0]!.dayKey)}: ${sets.join(' · ') || 'warm-ups only'}`,
    note: noted ? `“${noted.note.trim()}”${idx > 0 ? ` · set ${idx}` : ''}` : null,
  };
}

export function ExerciseCard({ card, unit, records, pad, touched, noteOpen, ...h }: Props) {
  const bw = card.exercise.type === 'bodyweight_reps';
  const hasRecord = card.sets.some((s) => s.loggedAt && records.has(s.id));
  const last = lastLine(card, unit);
  // Working sets are numbered 1…n; warm-ups show W.
  const numbers = new Map<string, number>();
  card.sets.filter((s) => s.kind === 'working').forEach((s, i) => numbers.set(s.id, i + 1));

  return (
    <section className="card ex" aria-label={card.exercise.name}>
      <div className="ex-head">
        <div className="ex-name">{card.exercise.name}</div>
        <div className="ex-actions">
          <button
            className={`tile ${hasRecord ? 'gold' : ''}`}
            onClick={() => h.onRecords(card)}
            aria-label={`Records for ${card.exercise.name}`}
          >
            <span className="rec-sq" />
          </button>
          <button className="tile" onClick={() => h.onMenu(card)} aria-label={`Options for ${card.exercise.name}`}>
            ⋯
          </button>
        </div>
      </div>
      {card.exercise.pinnedNote.trim() && <div className="pin">📌 {card.exercise.pinnedNote}</div>}
      <div className="ex-meta">
        {last.text}
        {last.note && (
          <>
            <br />
            <span className="note">{last.note}</span>
          </>
        )}
      </div>

      <div className="cols" aria-hidden="true">
        <span />
        <span>SET</span>
        <span>{bw ? `+${unit.toUpperCase()}` : unit.toUpperCase()}</span>
        <span>REPS</span>
        <span />
        <span />
      </div>

      {card.sets.map((s) => {
        const logged = s.loggedAt != null;
        const ghost = !logged && !touched.has(s.id) ? 'ghost' : '';
        const active = (f: PadField) => (pad?.setId === s.id && pad.field === f ? 'active' : '');
        const rec = logged && records.has(s.id);
        const label = s.kind === 'warmup' ? 'W' : s.toFailure ? 'F' : String(numbers.get(s.id));
        return (
          <div key={s.id}>
            <div className={`set ${logged ? 'logged' : ''} ${rec ? 'rec' : ''}`} data-testid="set-row">
              <button className="del" onClick={() => h.onDelete(s)} aria-label="Delete set">
                ✕
              </button>
              <button
                className={`set-no ${s.kind === 'warmup' ? 'w' : s.toFailure ? 'f' : ''}`}
                onClick={() => h.onSetMenu(s)}
                aria-label={`Set ${label} type`}
              >
                {label}
              </button>
              <button className={`val ${ghost} ${active('weight')}`} onClick={() => h.onPad(s, 'weight')} aria-label="Weight">
                {weightText(s, unit, bw)}
              </button>
              <button className={`val ${ghost} ${active('reps')}`} onClick={() => h.onPad(s, 'reps')} aria-label="Reps">
                {s.reps ?? '—'}
              </button>
              <button className={`note-btn ${s.note.trim() ? 'has' : ''}`} onClick={() => h.onNote(s)} aria-label="Note">
                ✎
              </button>
              <button
                className="check"
                onClick={() => h.onLog(s)}
                aria-label={logged ? 'Un-log set' : 'Log set'}
                aria-pressed={logged}
              >
                ✓
              </button>
            </div>
            {noteOpen === s.id && (
              <input
                className="note-input"
                autoFocus
                defaultValue={s.note}
                placeholder="Note for this set"
                maxLength={200}
                enterKeyHint="done"
                onBlur={(e) => h.onNoteSave(s, e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              />
            )}
            {noteOpen !== s.id && s.note.trim() && (
              <button className="note-line" onClick={() => h.onNote(s)}>
                “{s.note.trim()}”
              </button>
            )}
          </div>
        );
      })}

      <button className="add-set" onClick={() => h.onAddSet(card)}>
        ＋ Add set
      </button>
    </section>
  );
}
