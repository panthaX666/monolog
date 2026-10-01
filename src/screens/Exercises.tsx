import { useState } from 'react';
import { FilterChips, matches, searchWords, subtitle, useExerciseIndex, type Filter } from '../components/exerciseSearch';
import { formatDay } from '../lib/format';
import { href, navigate } from '../lib/route';

/** Exercises tab (SPEC N10): search + filters over the whole library. */
export function Exercises() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>(null);
  const [archived, setArchived] = useState(false);
  const index = useExerciseIndex();

  const words = searchWords(query);
  const list = (index?.exercises ?? [])
    .filter((e) => (archived ? !!e.archivedAt : !e.archivedAt))
    .filter((e) => matches(e, words, filter))
    .sort((a, b) => a.name.localeCompare(b.name));
  const archivedCount = (index?.exercises ?? []).filter((e) => e.archivedAt).length;

  return (
    <main className="screen">
      <header className="row" style={{ marginBottom: 12 }}>
        <h1 className="t-title">{archived ? 'Archived' : 'Exercises'}</h1>
        <button className="chip" onClick={() => navigate(href.exerciseNew())}>
          ＋ New
        </button>
      </header>
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
      <div className="t-label list-label">
        {list.length} {list.length === 1 ? 'exercise' : 'exercises'}
      </div>
      {list.map((e) => (
        <button key={e.id} className="list-item" onClick={() => navigate(href.exercise(e.id))} aria-label={e.name}>
          <span>
            {e.name}
            <br />
            <small>{subtitle(e)}</small>
          </span>
          <small>{index?.last.has(e.id) ? formatDay(index.last.get(e.id)!) : ''}</small>
        </button>
      ))}
      {list.length === 0 && index && <p className="t-meta">No exercises match.</p>}
      {(archivedCount > 0 || archived) && (
        <button className="btn btn-secondary" style={{ width: '100%', marginTop: 20 }} onClick={() => setArchived(!archived)}>
          {archived ? '‹ Back to exercises' : `Archived (${archivedCount})`}
        </button>
      )}
    </main>
  );
}
