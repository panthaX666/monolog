import { useEffect, useRef, useState } from 'react';
import { useNow } from '../lib/clock';
import { formatClock } from '../lib/format';
import { startRest, stopRest, useRest } from '../lib/restTimer';

/** Rest timer chip, top-right (SPEC N5 / D35). Tap to start; tap again to stop. */
export function RestChip() {
  const rest = useRest();
  const now = useNow(250);
  const running = rest.endAt != null;
  const left = running ? Math.ceil((rest.endAt! - now) / 1000) : rest.durationSec;

  // Pulse when a countdown finishes.
  const wasRunning = useRef(running);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (wasRunning.current && !running) {
      setDone(true);
      const t = setTimeout(() => setDone(false), 1900);
      wasRunning.current = running;
      return () => clearTimeout(t);
    }
    wasRunning.current = running;
  }, [running]);

  return (
    <button
      className={`timer-chip ${running ? 'running' : ''} ${done ? 'done' : ''}`}
      onClick={() => (running ? stopRest() : startRest(rest.durationSec))}
      aria-label={running ? `Rest timer ${formatClock(left)} remaining, tap to stop` : `Start ${formatClock(left)} rest timer`}
      data-testid="rest-chip"
    >
      <span aria-hidden="true">⏱</span> {formatClock(left)} {!running && <span aria-hidden="true">▶</span>}
    </button>
  );
}
