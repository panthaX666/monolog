import { useRef, useState, type PointerEvent } from 'react';
import type { MuscleGroup } from '../domain/muscles';
import type { Exercise } from '../domain/types';
import { formatDay } from '../lib/format';
import { FilterChips, matches, searchWords, subtitle, useExerciseIndex, type Filter } from './exerciseSearch';
import { NewExercise } from './NewExercise';
import { Sheet } from './Sheet';

// Exercise picker (SPEC N3): search, tag filters, Recent, A–Z, create. Tap adds one exercise; hold one
// (or tap Select) to pick several and add them together.

const HOLD_MS = 450;

const GROUP_DEFAULT_MUSCLE = {
  chest: 'chest',
  back: 'lats',
  legs: 'quads',
  shoulders: 'side_delts',
  arms: 'biceps',
  core: 'abs',
} as const satisfies Record<MuscleGroup, string>;

export function ExercisePicker({
  onPick,
  onClose,
  excludeIds,
}: {
  /** Exercises to add, in the order they were picked. */
  onPick: (exerciseIds: string[]) => void;
  onClose: () => void;
  excludeIds: Set<string>;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>(null);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string[] | null>(null);
  const hold = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null);
  const index = useExerciseIndex();

  const words = searchWords(query);
  const active = (index?.exercises ?? []).filter((e) => !e.archivedAt);
  const all = active.filter((e) => matches(e, words, filter)).sort((a, b) => a.name.localeCompare(b.name));
  const recent =
    words.length || filter || !index
      ? []
      : active
          .filter((e) => index.last.has(e.id))
          .sort((a, b) => (index.last.get(b.id)! > index.last.get(a.id)! ? 1 : -1))
          .slice(0, 6);
  const exact = index?.exercises.some((e) => e.nameKey === words.join(' '));

  const toggle = (id: string) =>
    setSelected((cur) =>
      (cur ?? []).includes(id) ? (cur ?? []).filter((x) => x !== id) : [...(cur ?? []), id],
    );

  const cancelHold = () => {
    if (hold.current) clearTimeout(hold.current.timer);
  };
  const startHold = (ev: PointerEvent, id: string) => {
    cancelHold();
    hold.current = {
      x: ev.clientX,
      y: ev.clientY,
      fired: false,
      timer: window.setTimeout(() => {
        hold.current!.fired = true;
        if (!selected) setSelected([id]);
        else toggle(id);
        navigator.vibrate?.(12);
      }, HOLD_MS),
    };
  };
  const moveHold = (ev: PointerEvent) => {
    if (hold.current && Math.hypot(ev.clientX - hold.current.x, ev.clientY - hold.current.y) > 10)
      cancelHold();
  };

  const item = (e: Exercise) => {
    const on = selected?.includes(e.id) ?? false;
    return (
      <button
        key={e.id}
        className={`list-item ${on ? 'picked' : ''}`}
        aria-label={e.name}
        aria-pressed={selected ? on : undefined}
        onPointerDown={(ev) => startHold(ev, e.id)}
        onPointerMove={moveHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onContextMenu={(ev) => ev.preventDefault()}
        onClick={() => {
          if (hold.current?.fired) return void (hold.current.fired = false);
          if (selected) toggle(e.id);
          else onPick([e.id]);
        }}
      >
        {selected && (
          <span className={`pick-box ${on ? 'on' : ''}`} aria-hidden="true">
            {on ? selected.indexOf(e.id) + 1 : ''}
          </span>
        )}
        <span style={{ flex: 1 }}>
          {e.name}
          <br />
          <small>{subtitle(e)}</small>
        </span>
        <small>
          {excludeIds.has(e.id)
            ? 'In workout'
            : index?.last.has(e.id)
              ? formatDay(index.last.get(e.id)!)
              : ''}
        </small>
      </button>
    );
  };

  if (creating)
    return (
      <Sheet onClose={onClose} tall label="New exercise">
        <NewExercise
          initialName={query.trim().replace(/\b\p{Ll}/gu, (c) => c.toUpperCase())}
          initialPrimary={filter?.kind === 'group' ? [GROUP_DEFAULT_MUSCLE[filter.value]] : []}
          initialEquipment={filter?.kind === 'equip' ? [filter.value] : []}
          onCreated={(id) => onPick([...(selected ?? []), id])}
          onBack={() => setCreating(false)}
        />
      </Sheet>
    );

  return (
    <Sheet onClose={onClose} tall label="Add exercise">
      <div className="sheet-head">
        <span className="t-h2">{selected ? `${selected.length} selected` : 'Add exercise'}</span>
        <span className="row" style={{ gap: 8 }}>
          <button
            className={`chip ${selected ? 'on' : ''}`}
            onClick={() => setSelected(selected ? null : [])}
          >
            {selected ? 'Cancel' : 'Select'}
          </button>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </span>
      </div>
      <div style={{ padding: '12px 16px 0' }}>
        <input
          className="search"
          type="search"
          placeholder="Search exercises…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search exercises"
          enterKeyHint="search"
        />
        <FilterChips filter={filter} onChange={setFilter} />
      </div>
      <div className="sheet-scroll">
        {recent.length > 0 && (
          <>
            <div className="t-label list-label">Recent</div>
            {recent.map(item)}
          </>
        )}
        <div className="t-label list-label">
          {words.length || filter ? `${all.length} result${all.length === 1 ? '' : 's'}` : 'All A–Z'}
        </div>
        {all.map(item)}
        {words.length > 0 && !exact && (
          <button className="list-item create" onClick={() => setCreating(true)}>
            ＋ Create “{query.trim()}”
          </button>
        )}
      </div>
      {selected && (
        <div className="sheet-foot">
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={!selected.length}
            onClick={() => onPick(selected)}
          >
            {selected.length
              ? `Add ${selected.length} exercise${selected.length === 1 ? '' : 's'}`
              : 'Tap exercises to pick them'}
          </button>
        </div>
      )}
    </Sheet>
  );
}
