import { useSyncExternalStore } from 'react';

// Hash routing (/#/history) — GitHub Pages can't serve deep links for a single-page app.
export const TABS = ['home', 'history', 'exercises', 'body'] as const;
export type Tab = (typeof TABS)[number];

export function parseTab(hash: string): Tab {
  const seg = hash.replace(/^#\/?/, '').split(/[/?]/)[0] ?? '';
  return (TABS as readonly string[]).includes(seg) ? (seg as Tab) : 'home';
}

export function hrefFor(tab: Tab): string {
  return tab === 'home' ? '#/' : `#/${tab}`;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function useTab(): Tab {
  return useSyncExternalStore(subscribe, () => parseTab(window.location.hash));
}
