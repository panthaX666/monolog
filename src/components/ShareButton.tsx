import { useState } from 'react';
import { getDb } from '../data/db';
import { useSettings } from '../data/hooks';
import { loadShareData, shareWorkoutImage } from '../lib/share';

/** Shares a workout as an image (send or save). */
export function ShareButton({ sessionId, label = 'Share' }: { sessionId: string; label?: string }) {
  const settings = useSettings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const share = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await loadShareData(getDb(), sessionId, settings.unit);
      if (data) await shareWorkoutImage(data);
    } catch {
      setError("Couldn't make the image. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => void share()} disabled={busy}>
        {busy ? 'Making image…' : label}
      </button>
      {error && (
        <p className="t-meta" role="alert" style={{ color: 'var(--danger)', margin: 0 }}>
          {error}
        </p>
      )}
    </>
  );
}
