import { useSyncExternalStore } from 'react';

// Chrome fires `beforeinstallprompt` once the app qualifies as installable (manifest + active
// service worker). Capturing it lets us offer a real "Install" button instead of relying on the
// menu, where "Create shortcut" produces a plain Chrome shortcut rather than an app.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallState = 'installed' | 'available' | 'unavailable';

let deferred: BeforeInstallPromptEvent | null = null;
let justInstalled = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

// Registered at module load (imported from main.tsx) so an early event isn't missed.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
  emit();
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  justInstalled = true;
  emit();
});

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches;
}

function getState(): InstallState {
  if (isStandalone() || justInstalled) return 'installed';
  return deferred ? 'available' : 'unavailable';
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, getState);
}

export async function promptInstall(): Promise<void> {
  if (!deferred) return;
  const event = deferred;
  await event.prompt();
  await event.userChoice;
  // The event is single-use; Chrome fires a new one if the user dismissed and it's still eligible.
  deferred = null;
  emit();
}

/** Which install instructions fit this device when there's no install button to offer. */
export function installPlatform(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

const DISMISS_KEY = 'monolog.installPrompt';

/** The first-visit install screen shows in a browser tab until installed or dismissed. */
export function installPromptDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === 'dismissed';
  } catch {
    return false;
  }
}

export function dismissInstallPrompt(): void {
  try {
    localStorage.setItem(DISMISS_KEY, 'dismissed');
  } catch {
    /* private mode: it just shows again next visit */
  }
}
