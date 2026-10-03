import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Celebration, type CelebrationData } from '../components/Celebration';
import { ExerciseCard, fieldLabel, weightText } from '../components/ExerciseCard';
import { ExercisePicker } from '../components/ExercisePicker';
import { fieldsFor, NumberPad, type PadField } from '../components/NumberPad';
import { formatKm, formatPace, formatSeconds } from '../domain/measure';
import { RecordsPopover } from '../components/RecordsPopover';
import { ShareButton } from '../components/ShareButton';
import { RestChip } from '../components/RestChip';
import { Dialog, Sheet, Snackbar } from '../components/Sheet';
import { getDb } from '../data/db';
import { useOpenSession, useSettings, useWorkout, type CardData } from '../data/hooks';
import {
  addExerciseToSession,
  addSet,
  deleteSet,
  discardSession,
  finishSession,
  repeatSession,
  tidySession,
  logSet,
  removeExerciseFromSession,
  RepoError,
  restoreSet,
  unlogSet,
  updateExercise,
  updateSet,
  type SetPatch,
} from '../data/repo';
import type { RecordEvent, Unit, WorkoutSet } from '../domain/types';
import { displayWeight, formatWeight } from '../domain/units';
import { useNow } from '../lib/clock';
import { buzz, HAPTIC, useWakeLock } from '../lib/device';
import { formatClock, formatDay, formatDuration, formatTime, formatWeekday, plural } from '../lib/format';
import { navigate } from '../lib/route';
import { setRestDuration, startRest, stopRest } from '../lib/restTimer';

const STALE_MS = 4 * 60 * 60 * 1000;

type Overlay =
  | { kind: 'picker' }
  | { kind: 'records'; seId: string }
  | { kind: 'exMenu'; seId: string }
  | { kind: 'setMenu'; setId: string }
  | { kind: 'finish' }
  | { kind: 'discard' }
  | { kind: 'repeatBlocked' }
  | { kind: 'remove'; seId: string }
  | null;

/** Serialise writes so a quick "type then ✓" always logs what was typed. */
function useWriteQueue() {
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  return useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.current.then(fn, fn);
    chain.current = next.catch(() => undefined);
    return next;
  }, []);
}

function celebrationFor(ev: RecordEvent, card: CardData, set: WorkoutSet, unit: Unit): CelebrationData {
  const type = card.exercise.type;
  const bw = type !== 'weight_reps';
  const before = card.history.find((s) => s.id === ev.before.setId);
  const base = { exerciseName: card.exercise.name, kind: ev.kind };
  const beforeLabel = formatDay(ev.before.dayKey);
  const today = 'Today';
  switch (ev.kind) {
    case 'weight': {
      const b = before ? displayWeight(before.weight ?? 0, before.unit, unit)! : ev.before.value;
      const a = displayWeight(set.weight ?? 0, set.unit, unit)!;
      return {
        ...base,
        delta: `+${formatWeight(Math.round((a - b) * 100) / 100)} ${unit}`,
        before: { label: beforeLabel, value: `${formatWeight(b)} ${unit}` },
        after: { label: today, value: `${formatWeight(a)} ${unit}` },
      };
    }
    case 'reps': {
      const n = ev.after.value - ev.before.value;
      return {
        ...base,
        delta: `+${plural(n, 'rep')}`,
        before: { label: beforeLabel, value: before ? `${weightText(before, unit, bw)} × ${ev.before.value}` : `${ev.before.value}` },
        after: { label: today, value: `${weightText(set, unit, bw)} × ${set.reps}` },
      };
    }
    case 'duration':
      return {
        ...base,
        delta: `+${formatSeconds(ev.after.value - ev.before.value)}`,
        before: { label: beforeLabel, value: formatSeconds(ev.before.value) },
        after: { label: today, value: formatSeconds(ev.after.value) },
      };
    case 'distance':
      return {
        ...base,
        delta: `+${((ev.after.value - ev.before.value) / 1000).toFixed(2)} km`,
        before: { label: beforeLabel, value: formatKm(ev.before.value) },
        after: { label: today, value: formatKm(ev.after.value) },
      };
    case 'pace':
      return {
        ...base,
        delta: `−${formatSeconds((ev.before.value - ev.after.value) * 1000)} /km`,
        before: { label: beforeLabel, value: formatPace(ev.before.value) },
        after: { label: today, value: formatPace(ev.after.value) },
      };
  }
}

/**
 * The workout screen. Without `editId` it shows the live workout; with `editId` it edits a past
 * workout (SPEC N9): same cards and controls, but no clock, rest timer or celebrations.
 */
export function Workout({ editId }: { editId?: string } = {}) {
  const open = useOpenSession();
  const live = !editId;
  const data = useWorkout(live ? open?.id : editId);
  const settings = useSettings();
  const db = getDb();
  const enqueue = useWriteQueue();
  const now = useNow(1000);

  const [overlay, setOverlay] = useState<Overlay>(null);
  const [pad, setPad] = useState<{ setId: string; field: PadField } | null>(null);
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const [snack, setSnack] = useState<{ text: string; undo?: WorkoutSet } | null>(null);
  const [staleDismissed, setStaleDismissed] = useState(false);

  useWakeLock(live && settings.wakeLock && !!open);

  // Live: no open workout → back to Home (e.g. finished elsewhere).
  useEffect(() => {
    if (live && open === null) navigate('#/', true);
  }, [live, open]);

  // Editing: a missing workout → History; the live workout opened from History → live screen.
  useEffect(() => {
    if (live) return;
    if (data === null) navigate('#/history', true);
    else if (data && data.session.endedAt === null) navigate('#/workout', true);
  }, [live, data]);

  // Leaving an edited past workout tidies it (drops un-logged sets / empty cards).
  useEffect(() => {
    if (!editId) return;
    return () => void tidySession(getDb(), editId);
  }, [editId]);

  useEffect(() => {
    if (!snack) return;
    const t = setTimeout(() => setSnack(null), 5000);
    return () => clearTimeout(t);
  }, [snack]);

  const unitFor = useCallback((card: CardData): Unit => card.exercise.unit ?? settings.unit, [settings.unit]);
  const restFor = useCallback((card: CardData) => card.exercise.restSec ?? settings.restDefaultSec, [settings.restDefaultSec]);

  const cards = useMemo(() => data?.cards ?? [], [data]);
  const findSet = (id: string) => {
    for (const card of cards) {
      const set = card.sets.find((s) => s.id === id);
      if (set) return { card, set };
    }
    return null;
  };
  const touch = (id: string) => setTouched((t) => (t.has(id) ? t : new Set(t).add(id)));

  if (!data || (live && !open)) return <main className="screen" />;

  const session = data.session;
  const elapsed = (now - Date.parse(session.startedAt)) / 1000;
  const loggedAll = cards.flatMap((c) => c.sets.filter((s) => s.loggedAt));
  const lastLoggedAt = loggedAll.map((s) => s.loggedAt!).sort().pop() ?? null;
  const stale = !staleDismissed && now - Date.parse(session.startedAt) > STALE_MS;

  const patch = (set: WorkoutSet, p: SetPatch) => {
    touch(set.id);
    return enqueue(() => updateSet(db, set.id, p));
  };

  const log = async (set: WorkoutSet) => {
    const found = findSet(set.id);
    if (!found) return;
    const { card } = found;
    if (set.loggedAt) {
      await enqueue(() => unlogSet(db, set.id));
      return;
    }
    try {
      const res = await enqueue(() => logSet(db, set.id));
      setPad(null);
      if (!live) return buzz(HAPTIC.log); // editing the past: records update silently
      buzz(res.record ? HAPTIC.record : HAPTIC.log);
      setRestDuration(restFor(card));
      if (settings.restAutoStart) startRest(restFor(card));
      if (res.record) {
        setCelebration(celebrationFor(res.record, card, res.set, unitFor(card)));
      }
    } catch (e) {
      if (e instanceof RepoError && e.code === 'incomplete_set') {
        // Open the pad on the first field that still needs a value.
        const fresh = (await db.sets.get(set.id)) ?? set;
        const type = card.exercise.type;
        const missing = fieldsFor(type).find((f) =>
          f === 'weight' ? type === 'weight_reps' && fresh.weight == null
          : f === 'reps' ? !fresh.reps
          : f === 'duration' ? !fresh.durationSec && !(type === 'cardio' && fresh.distanceM)
          : !fresh.distanceM && !fresh.durationSec,
        );
        setPad({ setId: set.id, field: missing ?? fieldsFor(type)[0] });
      } else throw e;
    }
  };

  const remove = async (set: WorkoutSet) => {
    if (pad?.setId === set.id) setPad(null);
    const deleted = await enqueue(() => deleteSet(db, set.id));
    buzz(HAPTIC.delete);
    setSnack({ text: 'Set deleted', undo: deleted });
  };

  const padFound = pad ? findSet(pad.setId) : null;
  const card = (seId: string) => cards.find((c) => c.se.id === seId);
  const overlayCard = overlay && 'seId' in overlay ? card(overlay.seId) : undefined;
  const menuSet = overlay?.kind === 'setMenu' ? findSet(overlay.setId)?.set : undefined;
  const unloggedCount = cards.reduce((n, c) => n + c.sets.filter((s) => !s.loggedAt).length, 0);

  const discard = async () => {
    await enqueue(() => discardSession(db, session.id));
    setOverlay(null);
    setPad(null);
    if (live) stopRest();
    navigate(live ? '#/' : '#/history', true);
  };

  const repeat = async () => {
    if (open) return setOverlay({ kind: 'repeatBlocked' });
    await enqueue(() => tidySession(db, session.id));
    await enqueue(() => repeatSession(db, session.id));
    navigate('#/workout');
  };

  const finish = async (endAt?: Date) => {
    const { kept } = await enqueue(() => finishSession(db, session.id, new Date(), endAt));
    setOverlay(null);
    navigate(kept ? `#/summary/${session.id}` : '#/', true);
  };

  return (
    <div className="workout">
      {live ? (
        <header className="hdr">
          <button className="chip" onClick={() => navigate('#/')} aria-label="Back to Home">
            ‹ Home
          </button>
          <span className="t-meta mono" aria-label="Workout time">
            ● {formatClock(elapsed)}
          </span>
          <RestChip />
        </header>
      ) : (
        <header className="hdr">
          <button className="chip" onClick={() => navigate('#/history')} aria-label="Back to History">
            ‹ History
          </button>
          <span className="hdr-title">
            <b>{formatWeekday(session.dayKey)}</b>
            {session.endedAt && (
              <span className="t-meta">
                {formatTime(session.startedAt)} ·{' '}
                {formatDuration((Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 1000)}
              </span>
            )}
          </span>
          <button className="chip" onClick={() => void repeat()} aria-label="Repeat this workout">
            ↻ Repeat
          </button>
        </header>
      )}

      <main className="screen workout-scroll">
        {live && stale && (
          <div className="card banner">
            <p style={{ margin: 0 }}>This workout started {formatDuration(elapsed)} ago.</p>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="chip" onClick={() => setStaleDismissed(true)}>
                Keep going
              </button>
              <button
                className="chip on"
                onClick={() => void finish(lastLoggedAt ? new Date(lastLoggedAt) : undefined)}
              >
                Finish{lastLoggedAt ? ` at ${formatTime(lastLoggedAt)}` : ''}
              </button>
            </div>
          </div>
        )}

        {cards.map((c) => (
          <ExerciseCard
            key={c.se.id}
            card={c}
            unit={unitFor(c)}
            records={data.records}
            pad={pad}
            touched={touched}
            noteOpen={noteOpen}
            onLog={(s) => void log(s)}
            onPad={(s, field) => setPad({ setId: s.id, field })}
            onDelete={(s) => void remove(s)}
            onSetMenu={(s) => setOverlay({ kind: 'setMenu', setId: s.id })}
            onNote={(s) => setNoteOpen(s.id)}
            onNoteSave={(s, note) => {
              setNoteOpen(null);
              if (note.trim() !== s.note) void enqueue(() => updateSet(db, s.id, { note: note.trim() }));
            }}
            onAddSet={(cd) => void enqueue(() => addSet(db, cd.se.id))}
            onRecords={(cd) => setOverlay({ kind: 'records', seId: cd.se.id })}
            onMenu={(cd) => setOverlay({ kind: 'exMenu', seId: cd.se.id })}
          />
        ))}

        {cards.length === 0 && (
          <div className="placeholder" style={{ minHeight: '40%' }}>
            <div>
              <div className="t-h2">Empty workout</div>
              <p className="t-meta">Add your first exercise.</p>
            </div>
          </div>
        )}

        {/* Add exercise sits under the cards; Finish is the fixed bottom button (swapped on request so
            they're never confused). */}
        <button className="btn btn-primary add-exercise" onClick={() => setOverlay({ kind: 'picker' })}>
          ＋ Add exercise
        </button>
        {editId && (
          <div className="share-past">
            <ShareButton sessionId={editId} label="Share workout" />
          </div>
        )}

        {/* Pushed to the bottom of the screen, just above Finish; far from the ✓ column. */}
        <div className="push" aria-hidden="true" />
        <button className="btn btn-danger discard" onClick={() => setOverlay({ kind: 'discard' })}>
          {live ? 'Discard workout' : 'Delete workout'}
        </button>
      </main>

      <footer className="footer">
        {live ? (
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setOverlay({ kind: 'finish' })}>
            Finish workout
          </button>
        ) : (
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => navigate('#/history')}>
            Done
          </button>
        )}
      </footer>

      {snack && (
        <Snackbar
          text={snack.text}
          action={snack.undo ? 'Undo' : undefined}
          onAction={() => {
            const s = snack.undo;
            setSnack(null);
            if (s) void enqueue(() => restoreSet(db, s));
          }}
        />
      )}

      {padFound && pad && (
        <NumberPad
          key={pad.setId}
          fields={fieldsFor(padFound.card.exercise.type)}
          field={pad.field}
          values={{
            weight: displayWeight(padFound.set.weight, padFound.set.unit, unitFor(padFound.card)),
            reps: padFound.set.reps,
            duration: padFound.set.durationSec,
            distance: padFound.set.distanceM,
          }}
          labels={{
            weight: fieldLabel('weight', padFound.card.exercise.type, unitFor(padFound.card)),
            reps: 'Reps',
            duration: 'Time',
            distance: 'KM',
          }}
          step={settings.weightStep}
          onChange={(field, value) =>
            void patch(
              padFound.set,
              field === 'weight'
                ? { weight: value, unit: unitFor(padFound.card) }
                : field === 'reps'
                  ? { reps: value }
                  : field === 'duration'
                    ? { durationSec: value }
                    : { distanceM: value },
            )
          }
          onFieldChange={(field) => setPad({ setId: pad.setId, field })}
          onLog={() => void log(padFound.set)}
          onClose={() => setPad(null)}
        />
      )}

      {overlay?.kind === 'picker' && (
        <ExercisePicker
          excludeIds={new Set(cards.map((c) => c.exercise.id))}
          onClose={() => setOverlay(null)}
          onPick={(exerciseId) => {
            setOverlay(null);
            void enqueue(() => addExerciseToSession(db, session.id, exerciseId)).then(() =>
              requestAnimationFrame(() => document.querySelector('.workout-scroll')?.scrollTo({ top: 1e6, behavior: 'smooth' })),
            );
          }}
        />
      )}

      {overlay?.kind === 'records' && overlayCard && (
        <RecordsPopover card={overlayCard} unit={unitFor(overlayCard)} onClose={() => setOverlay(null)} />
      )}

      {overlay?.kind === 'exMenu' && overlayCard && (
        <Sheet onClose={() => setOverlay(null)} label={`${overlayCard.exercise.name} options`}>
          <div className="sheet-body">
            <div className="t-h2">{overlayCard.exercise.name}</div>
            <div className="menu-row">
              <span>Unit for this exercise</span>
              <div className="seg">
                {(['kg', 'lb'] as const).map((u) => (
                  <button
                    key={u}
                    className={unitFor(overlayCard) === u ? 'on' : ''}
                    onClick={() => void updateExercise(db, overlayCard.exercise.id, { unit: u === settings.unit ? null : u })}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <label className="field">
              <span className="t-label">📌 Pinned note</span>
              <input
                defaultValue={overlayCard.exercise.pinnedNote}
                placeholder="e.g. Seat 4, rope attachment"
                maxLength={120}
                onBlur={(e) => void updateExercise(db, overlayCard.exercise.id, { pinnedNote: e.target.value.trim() })}
              />
            </label>
            <button className="btn btn-danger" onClick={() => setOverlay({ kind: 'remove', seId: overlayCard.se.id })}>
              Remove from workout
            </button>
          </div>
        </Sheet>
      )}

      {overlay?.kind === 'remove' && overlayCard && (
        <Dialog onClose={() => setOverlay(null)} label="Remove exercise">
          <div className="t-h2">Remove {overlayCard.exercise.name}?</div>
          <p className="t-meta">
            {overlayCard.sets.some((s) => s.loggedAt)
              ? `Its ${plural(overlayCard.sets.filter((s) => s.loggedAt).length, 'logged set')} will be deleted.`
              : 'No sets have been logged yet.'}
          </p>
          <div className="dialog-actions">
            <button className="btn btn-secondary" onClick={() => setOverlay(null)}>
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                const id = overlayCard.se.id;
                setOverlay(null);
                void enqueue(() => removeExerciseFromSession(db, id));
              }}
            >
              Remove
            </button>
          </div>
        </Dialog>
      )}

      {overlay?.kind === 'setMenu' && menuSet && (
        <Sheet onClose={() => setOverlay(null)} label="Set type">
          <div className="sheet-body">
            <div className="t-label">Set type</div>
            {(
              [
                ['Warm-up', { kind: 'warmup', toFailure: false }],
                ['Working', { kind: 'working', toFailure: false }],
                ['Working · to failure', { kind: 'working', toFailure: true }],
              ] as const
            ).map(([label, p]) => {
              const on = menuSet.kind === p.kind && menuSet.toFailure === p.toFailure;
              return (
                <button
                  key={label}
                  className={`menu-item ${on ? 'on' : ''}`}
                  onClick={() => {
                    setOverlay(null);
                    void enqueue(() => updateSet(db, menuSet.id, p));
                  }}
                >
                  {label}
                  {on && <span aria-hidden="true">✓</span>}
                </button>
              );
            })}
          </div>
        </Sheet>
      )}

      {overlay?.kind === 'discard' && (
        <Dialog onClose={() => setOverlay(null)} label={live ? 'Discard workout' : 'Delete workout'}>
          <div className="t-h2">
            {live ? 'Discard workout?' : 'Delete this workout?'}
            {loggedAll.length > 0 && ` ${plural(loggedAll.length, 'logged set')} will be deleted.`}
          </div>
          <p className="t-meta">
            {loggedAll.length > 0
              ? 'This deletes the whole workout and can’t be undone.'
              : 'Nothing has been logged. The workout and its timer will be removed.'}
          </p>
          <div className="dialog-actions">
            <button className="btn btn-secondary" onClick={() => setOverlay(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={() => void discard()}>
              {live ? 'Discard' : 'Delete'}
            </button>
          </div>
        </Dialog>
      )}

      {overlay?.kind === 'repeatBlocked' && (
        <Dialog onClose={() => setOverlay(null)} label="Workout in progress">
          <div className="t-h2">A workout is already in progress</div>
          <p className="t-meta">Finish or discard it before repeating this one.</p>
          <div className="dialog-actions">
            <button className="btn btn-secondary" onClick={() => setOverlay(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={() => navigate('#/workout')}>
              Resume it
            </button>
          </div>
        </Dialog>
      )}

      {overlay?.kind === 'finish' && (
        <Dialog onClose={() => setOverlay(null)} label="Finish workout">
          <div className="t-h2">Finish workout?</div>
          <p className="t-meta">
            {plural(loggedAll.length, 'set')} logged · {formatDuration(elapsed)}
            {unloggedCount > 0 && (
              <>
                <br />
                {plural(unloggedCount, 'un-logged set')} will be removed.
              </>
            )}
            {loggedAll.length === 0 && (
              <>
                <br />
                Nothing is logged, so this workout will be discarded.
              </>
            )}
          </p>
          <div className="dialog-actions">
            <button className="btn btn-secondary" onClick={() => setOverlay(null)}>
              Keep going
            </button>
            <button className="btn btn-primary" onClick={() => void finish()}>
              Finish
            </button>
          </div>
        </Dialog>
      )}

      {celebration && <Celebration data={celebration} onClose={() => setCelebration(null)} />}
    </div>
  );
}
