import { useEffect } from 'react';

let vibrationOn = true;
export function setVibrationEnabled(on: boolean): void {
  vibrationOn = on;
}

/** Haptics: log 12 ms · record 30-60-30 · rest done 200-100-200 (SPEC §5). */
export const HAPTIC = {
  log: [12],
  delete: [8],
  record: [30, 60, 30],
  restDone: [200, 100, 200],
} as const;

export function buzz(pattern: readonly number[]): void {
  if (!vibrationOn) return;
  try {
    navigator.vibrate?.([...pattern]);
  } catch {
    /* unsupported */
  }
}

/** Keep the screen on while `active` (Screen Wake Lock). Re-acquired when the app returns to the foreground. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || lock) return;
      try {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => {
          lock = null;
        });
        if (cancelled) void lock.release();
      } catch {
        /* denied (e.g. battery saver), not critical */
      }
    };
    const onVisible = () => void acquire();
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [active]);
}
