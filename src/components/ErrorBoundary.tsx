import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { backupFileName, exportBackup, markBackedUp } from '../data/backup';
import { getDb } from '../data/db';
import { download } from '../lib/download';

// If a screen crashes, show this instead of a blank page. Saving a backup reads the database
// directly, so it works even when the screen that crashed can't render.

function CrashScreen({ error }: { error: Error }) {
  const [saved, setSaved] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const save = async () => {
    setFailed(false);
    try {
      const db = getDb();
      const now = new Date();
      download(JSON.stringify(await exportBackup(db, now)), backupFileName(now));
      await markBackedUp(db, now);
      setSaved(backupFileName(now));
    } catch {
      setFailed(true);
    }
  };

  return (
    <main className="screen stack crash" role="alert">
      <h1 className="t-title">Something broke</h1>
      <p>
        Monolog hit an error on this screen. Your workouts are still saved on this phone. Save a backup first to be
        safe, then go back Home.
      </p>
      <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => void save()}>
        Save backup
      </button>
      {saved && <p className="t-meta">Saved {saved} to your Downloads.</p>}
      {failed && (
        <p className="t-meta" style={{ color: 'var(--danger)' }}>
          Couldn't save the backup. Try again, or reload the app.
        </p>
      )}
      <button
        className="btn btn-secondary"
        style={{ width: '100%' }}
        onClick={() => {
          location.hash = '#/';
          location.reload();
        }}
      >
        Go Home
      </button>
      <details className="t-meta">
        <summary>Error details</summary>
        <pre className="crash-details">{String(error.stack ?? error.message)}</pre>
      </details>
    </main>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Monolog crashed', error, info.componentStack);
  }

  render() {
    return this.state.error ? <CrashScreen error={this.state.error} /> : this.props.children;
  }
}

/** Test hook: setting localStorage `monolog.crashTest` makes the app throw, to check the crash screen. */
export function CrashTest() {
  if (localStorage.getItem('monolog.crashTest')) throw new Error('Crash test');
  return null;
}
