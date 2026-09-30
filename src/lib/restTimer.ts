import { useSyncExternalStore } from 'react';
import { buzz, HAPTIC } from './device';

// Rest timer state lives outside React and in localStorage, so it survives navigation, reloads and
// the app being closed mid-rest. The countdown is computed from `endAt`, so it stays accurate even
// when the phone throttles timers in the background (SPEC A4).

interface RestState {
  endAt: number | null;
  durationSec: number;
}

const KEY = 'monolog.rest';
const listeners = new Set<() => void>();
let state: RestState = load();
let ticker: ReturnType<typeof setInterval> | null = null;

function load(): RestState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as RestState;
      if (s.endAt && s.endAt < Date.now()) s.endAt = null;
      return s;
    }
  } catch {
    /* storage unavailable */
  }
  return { endAt: null, durationSec: 90 };
}

function set(next: RestState): void {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
  syncTicker();
}

function syncTicker(): void {
  if (state.endAt && !ticker) {
    ticker = setInterval(() => {
      if (state.endAt && Date.now() >= state.endAt) {
        buzz(HAPTIC.restDone);
        set({ ...state, endAt: null });
      }
    }, 250);
  } else if (!state.endAt && ticker) {
    clearInterval(ticker);
    ticker = null;
  }
}
syncTicker();

export function startRest(durationSec: number): void {
  set({ endAt: Date.now() + durationSec * 1000, durationSec });
}

export function stopRest(): void {
  set({ ...state, endAt: null });
}

/** Idle duration shown on the chip (e.g. the last exercise's rest length). */
export function setRestDuration(durationSec: number): void {
  if (state.endAt || state.durationSec === durationSec) return;
  set({ ...state, durationSec });
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useRest(): RestState {
  return useSyncExternalStore(subscribe, () => state);
}
