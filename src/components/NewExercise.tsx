import { useState } from 'react';
import { getDb } from '../data/db';
import { createExercise, RepoError } from '../data/repo';
import { EQUIPMENT, EQUIPMENT_LABEL, GROUP_LABEL, GROUPS, MUSCLE_GROUP, MUSCLE_LABEL, MUSCLES } from '../domain/muscles';
import type { Equipment, Muscle } from '../domain/types';

// "New exercise" step of the picker: name plus optional muscles and equipment, each picked from a list.

type ListKind = 'primary' | 'secondary' | 'equipment';

const ROW_LABEL: Record<ListKind, string> = { primary: 'Main muscle', secondary: 'Also works', equipment: 'Equipment' };

function summary(values: string[], label: (v: string) => string): string {
  if (!values.length) return 'Add';
  if (values.length <= 2) return values.map(label).join(', ');
  return `${label(values[0]!)} +${values.length - 1}`;
}

export function NewExercise({
  initialName,
  initialPrimary,
  initialEquipment,
  onCreated,
  onBack,
}: {
  initialName: string;
  initialPrimary: Muscle[];
  initialEquipment: Equipment[];
  onCreated: (exerciseId: string) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [primary, setPrimary] = useState<Muscle[]>(initialPrimary);
  const [secondary, setSecondary] = useState<Muscle[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>(initialEquipment);
  const [list, setList] = useState<ListKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setError(null);
    try {
      const ex = await createExercise(getDb(), {
        name: name.trim().replace(/\b\p{Ll}/gu, (c) => c.toUpperCase()),
        type: 'weight_reps',
        primaryMuscles: primary,
        secondaryMuscles: secondary,
        equipment,
      });
      onCreated(ex.id);
    } catch (e) {
      setError(e instanceof RepoError ? e.message : 'Could not create exercise');
    }
  };

  if (list) {
    const isMuscle = list !== 'equipment';
    const selected: string[] = list === 'primary' ? primary : list === 'secondary' ? secondary : equipment;
    const toggle = (v: string) => {
      const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
      if (list === 'primary') {
        setPrimary(next as Muscle[]);
        setSecondary(secondary.filter((m) => !next.includes(m)));
      } else if (list === 'secondary') setSecondary(next as Muscle[]);
      else setEquipment(next as Equipment[]);
    };
    const option = (v: string, label: string) => {
      const on = selected.includes(v);
      const taken = list === 'secondary' && primary.includes(v as Muscle);
      return (
        <button key={v} className="list-item" onClick={() => toggle(v)} disabled={taken} aria-pressed={on}>
          <span>{label}</span>
          <span className="check-mark">{on ? '✓' : taken ? 'Main' : ''}</span>
        </button>
      );
    };
    return (
      <>
        <div className="sheet-head">
          <span className="t-h2">{ROW_LABEL[list]}</span>
          <button className="btn btn-primary btn-small" onClick={() => setList(null)}>
            Done
          </button>
        </div>
        <div className="sheet-scroll">
          {isMuscle
            ? GROUPS.map((g) => (
                <div key={g}>
                  <div className="t-label list-label">{GROUP_LABEL[g]}</div>
                  {MUSCLES.filter((m) => MUSCLE_GROUP[m] === g).map((m) => option(m, MUSCLE_LABEL[m]))}
                </div>
              ))
            : EQUIPMENT.map((e) => option(e, EQUIPMENT_LABEL[e]))}
        </div>
      </>
    );
  }

  const row = (kind: ListKind, values: string[], label: (v: string) => string) => (
    <button className="pick-row" onClick={() => setList(kind)}>
      <span>{ROW_LABEL[kind]}</span>
      <b className={values.length ? '' : 'empty'}>{summary(values, label)} ›</b>
    </button>
  );

  return (
    <>
      <div className="sheet-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          ‹
        </button>
        <span className="t-h2" style={{ flex: 1, marginLeft: 8 }}>
          New exercise
        </span>
      </div>
      <div className="sheet-scroll new-exercise">
        <input
          className="search"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Exercise name"
          placeholder="Exercise name"
        />
        <p className="t-meta">Muscles and equipment are optional. You can change them later on the exercise page.</p>
        {row('primary', primary, (m) => MUSCLE_LABEL[m as Muscle])}
        {row('secondary', secondary, (m) => MUSCLE_LABEL[m as Muscle])}
        {row('equipment', equipment, (e) => EQUIPMENT_LABEL[e as Equipment])}
        {error && (
          <p className="t-meta" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}
      </div>
      <div className="sheet-foot">
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => void create()} disabled={!name.trim()}>
          Create
        </button>
      </div>
    </>
  );
}
