import { useEffect, useState } from 'react';
import { requestPersistence, type PersistState } from '../lib/storage';

const PERSIST_TEXT: Record<PersistState, string> = {
  persisted: 'Protected',
  'best-effort': 'Not yet — install the app',
  unsupported: 'Not supported',
};

function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches;
}

// M0 placeholder: proves install, offline and update flow on the phone.
export function Home() {
  const [persist, setPersist] = useState<PersistState | null>(null);

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

      <section className="card">
        <div className="t-label">Milestone 0</div>
        <p className="t-h2" style={{ marginTop: 8 }}>
          Skeleton is live.
        </p>
        <p className="t-meta" style={{ marginBottom: 0 }}>
          Logging arrives in M2. This screen confirms install, offline mode and updates.
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
          <span>{isInstalled() ? 'Yes' : 'No — open in Chrome ⋮ → Install app'}</span>
        </div>
        <div className="kv">
          <span>Data storage</span>
          <span>{persist ? PERSIST_TEXT[persist] : '…'}</span>
        </div>
      </section>
    </main>
  );
}
