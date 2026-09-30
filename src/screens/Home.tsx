import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { getDb } from '../data/db';
import { promptInstall, useInstallState } from '../lib/install';
import { requestPersistence, type PersistState } from '../lib/storage';

const PERSIST_TEXT: Record<PersistState, string> = {
  persisted: 'Protected',
  'best-effort': 'Not yet — install the app',
  unsupported: 'Not supported',
};

function InstallCard() {
  const state = useInstallState();
  if (state === 'installed') return null;
  return (
    <section className="card">
      <div className="t-label">Install</div>
      <p className="t-h2" style={{ marginTop: 8 }}>
        Get Monolog as an app
      </p>
      <p className="t-meta">Opens full-screen from your home screen and works offline.</p>
      {state === 'available' ? (
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => void promptInstall()}>
          Install Monolog
        </button>
      ) : (
        <p className="t-meta" style={{ marginBottom: 0 }}>
          Getting ready… if no button appears, use Chrome ⋮ → <b>Install app</b> (not “Create shortcut”).
        </p>
      )}
    </section>
  );
}

// M0 placeholder: proves install, offline and update flow on the phone.
export function Home() {
  const [persist, setPersist] = useState<PersistState | null>(null);
  const install = useInstallState();
  const exerciseCount = useLiveQuery(() => getDb().exercises.count(), [], null);

  useEffect(() => {
    void requestPersistence().then(setPersist);
  }, []);

  const built = new Date(__BUILD_TIME__);

  return (
    <main className="screen stack">
      <header className="row">
        <div>
          <div className="t-meta">
            {new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
          <h1 className="t-title">Monolog</h1>
        </div>
        <span className="rec-sq" aria-hidden="true" />
      </header>

      <InstallCard />

      <section className="card">
        <div className="t-label">Milestone 1</div>
        <p className="t-h2" style={{ marginTop: 8 }}>
          Engine is in.
        </p>
        <p className="t-meta" style={{ marginBottom: 0 }}>
          Database, records, streaks and the exercise library run on your phone. Logging arrives in M2.
        </p>
      </section>

      <section className="card">
        <div className="t-label" style={{ marginBottom: 6 }}>
          System status
        </div>
        <div className="kv">
          <span>Version</span>
          <span className="mono">{__BUILD_SHA__}</span>
        </div>
        <div className="kv">
          <span>Built</span>
          <span className="mono">
            {built.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}{' '}
            {built.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="kv">
          <span>Installed</span>
          <span>{install === 'installed' ? 'Yes' : 'No'}</span>
        </div>
        <div className="kv">
          <span>Data storage</span>
          <span>{persist ? PERSIST_TEXT[persist] : '…'}</span>
        </div>
        <div className="kv">
          <span>Exercise library</span>
          <span>{exerciseCount == null ? '…' : `${exerciseCount} exercises`}</span>
        </div>
      </section>
    </main>
  );
}
