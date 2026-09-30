import { useEffect, useRef, useState } from 'react';
import { Dialog } from '../components/Sheet';
import {
  backupFileName,
  exportBackup,
  markBackedUp,
  parseBackup,
  previewBackup,
  restoreBackup,
  type Backup,
} from '../data/backup';
import { getDb } from '../data/db';
import { useSettings } from '../data/hooks';
import { updateSettings } from '../data/repo';
import { formatClock, formatDay, plural } from '../lib/format';
import { navigate } from '../lib/route';
import { requestPersistence, type PersistState } from '../lib/storage';
import { toDayKey } from '../domain/dates';

const REST_STEPS = [30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300];

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button className={`toggle ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function Settings() {
  const s = useSettings();
  const db = getDb();
  const set = (patch: Parameters<typeof updateSettings>[1]) => void updateSettings(db, patch);
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [persist, setPersist] = useState<PersistState | null>(null);

  useEffect(() => {
    void requestPersistence().then(setPersist);
  }, []);

  const restIdx = Math.max(0, REST_STEPS.indexOf(s.restDefaultSec));
  const stepRest = (dir: 1 | -1) => {
    const i = Math.min(REST_STEPS.length - 1, Math.max(0, (restIdx === -1 ? 4 : restIdx) + dir));
    set({ restDefaultSec: REST_STEPS[i]! });
  };

  const exportNow = async () => {
    const now = new Date();
    const backup = await exportBackup(db, now);
    download(JSON.stringify(backup), backupFileName(now));
    await markBackedUp(db, now);
    setMessage(`Saved ${backupFileName(now)} to your Downloads.`);
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPending(parseBackup(await file.text()));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not read that file.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const restore = async () => {
    if (!pending) return;
    try {
      await restoreBackup(db, pending);
      setMessage('Backup restored.');
    } catch {
      setMessage('Restore failed. Nothing was changed.');
    }
    setPending(null);
  };

  const preview = pending ? previewBackup(pending) : null;

  return (
    <main className="screen stack settings">
      <header className="row">
        <button className="chip" onClick={() => navigate('#/')} aria-label="Back to Home">
          ‹ Home
        </button>
        <h1 className="t-h2">Settings</h1>
        <span style={{ width: 72 }} />
      </header>

      <section className="card">
        <div className="t-label">Units</div>
        <div className="menu-row">
          <span>Default weight unit</span>
          <div className="seg">
            {(['kg', 'lb'] as const).map((u) => (
              <button key={u} className={s.unit === u ? 'on' : ''} onClick={() => set({ unit: u })}>
                {u}
              </button>
            ))}
          </div>
        </div>
        <p className="t-meta" style={{ margin: 0 }}>
          Any exercise can use the other unit from its ⋯ menu. Sets keep the unit they were typed in.
        </p>
      </section>

      <section className="card">
        <div className="t-label">Rest timer</div>
        <div className="menu-row">
          <span>Default rest</span>
          <div className="stepper">
            <button onClick={() => stepRest(-1)} aria-label="Shorter rest">
              −
            </button>
            <span className="mono">{formatClock(s.restDefaultSec)}</span>
            <button onClick={() => stepRest(1)} aria-label="Longer rest">
              +
            </button>
          </div>
        </div>
        <div className="menu-row">
          <span>Start automatically when a set is logged</span>
          <Toggle on={s.restAutoStart} onChange={(v) => set({ restAutoStart: v })} label="Auto-start rest timer" />
        </div>
      </section>

      <section className="card">
        <div className="t-label">During a workout</div>
        <div className="menu-row">
          <span>Vibration</span>
          <Toggle on={s.vibration} onChange={(v) => set({ vibration: v })} label="Vibration" />
        </div>
        <div className="menu-row">
          <span>Keep screen on</span>
          <Toggle on={s.wakeLock} onChange={(v) => set({ wakeLock: v })} label="Keep screen on" />
        </div>
      </section>

      <section className="card">
        <div className="t-label">Backup</div>
        <p className="t-meta" style={{ marginTop: 6 }}>
          Your data lives only on this phone. Save a backup file regularly and keep it somewhere safe (Drive, email).
          <br />
          Last backup: {s.lastBackupAt ? formatDay(toDayKey(new Date(s.lastBackupAt))) : 'never'}
          {s.workoutsSinceBackup > 0 && ` · ${plural(s.workoutsSinceBackup, 'workout')} since`}
        </p>
        <div className="dialog-actions">
          <button className="btn btn-primary" onClick={() => void exportNow()}>
            Save backup
          </button>
          <button className="btn btn-secondary" onClick={() => fileInput.current?.click()}>
            Restore…
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => void pick(e.target.files?.[0])}
        />
        {message && <p className="t-meta" role="status">{message}</p>}
      </section>

      <section className="card">
        <div className="t-label">About</div>
        <div className="kv">
          <span>Version</span>
          <span className="mono">{__BUILD_SHA__}</span>
        </div>
        <div className="kv">
          <span>Built</span>
          <span>{new Date(__BUILD_TIME__).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
        </div>
        <div className="kv">
          <span>Storage</span>
          <span>{persist === 'persisted' ? 'Protected' : persist === 'best-effort' ? 'Not protected — install the app' : '…'}</span>
        </div>
      </section>

      {pending && preview && (
        <Dialog onClose={() => setPending(null)} label="Restore backup">
          <div className="t-h2">Restore this backup?</div>
          <p className="t-meta">
            {preview.exportedAt && <>Saved {formatDay(toDayKey(new Date(preview.exportedAt)))}.<br /></>}
            {plural(preview.workouts, 'workout')} · {plural(preview.sets, 'set')} · {plural(preview.customExercises, 'custom exercise')} ·{' '}
            {plural(preview.restDays, 'rest day')} · {plural(preview.bodyEntries, 'body entry', 'body entries')}
          </p>
          <p className="t-meta" style={{ color: 'var(--danger)' }}>
            This replaces everything currently on this phone.
          </p>
          <div className="dialog-actions">
            <button className="btn btn-secondary" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={() => void restore()}>
              Replace
            </button>
          </div>
        </Dialog>
      )}
    </main>
  );
}
