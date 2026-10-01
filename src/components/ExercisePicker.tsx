import { useState } from 'react';
import { getDb } from '../data/db';
import { createExercise, RepoError } from '../data/repo';
import type { MuscleGroup } from '../domain/muscles';
import type { Exercise } from '../domain/types';
import { formatDay } from '../lib/format';
import { FilterChips, matches, searchWords, subtitle, useExerciseIndex, type Filter } from './exerciseSearch';
import { Sheet } from './Sheet';

// Exercise picker (SPEC N3): search, tag filters, Recent, A–Z, create.

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
  onPick: (exerciseId: string) => void;
  onClose: () => void;
  excludeIds: Set<string>;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>(null);
  const [error, setError] = useState<string | null>(null);
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

  const create = async () => {
    setError(null);
    try {
      const name = query.trim().replace(/\b\p{Ll}/gu, (c) => c.toUpperCase());
      const ex = await createExercise(getDb(), {
        name,
        type: 'weight_reps',
        primaryMuscles: filter?.kind === 'group' ? [GROUP_DEFAULT_MUSCLE[filter.value]] : [],
        equipment: filter?.kind === 'equip' ? [filter.value] : ['other'],
      });
      onPick(ex.id);
    } catch (e) {
      setError(e instanceof RepoError ? e.message : 'Could not create exercise');
    }
  };

  const item = (e: Exercise) => {
    return (
      <button key={e.id} className="list-item" onClick={() => onPick(e.id)} aria-label={e.name}>
        <span>
          {e.name}
          <br />
          <small>{subtitle(e)}</small>
        </span>
        <small>{excludeIds.has(e.id) ? 'In workout' : index?.last.has(e.id) ? formatDay(index.last.get(e.id)!) : ''}</small>
      </button>
    );
  };

  return (
    <Sheet onClose={onClose} tall label="Add exercise">
      <div className="sheet-head">
        <span className="t-h2">Add exercise</span>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          ✕
        </button>
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
          <button className="list-item create" onClick={() => void create()}>
            ＋ Create “{query.trim()}”
          </button>
        )}
        {error && (
          <p className="t-meta" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
