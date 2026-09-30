import { useSyncExternalStore } from 'react';

// Hash routing (/#/history) — GitHub Pages can't serve deep links for a single-page app.
export const TABS = ['home', 'history', 'exercises', 'body'] as const;
export type Tab = (typeof TABS)[number];

export type Route =
  | { view: 'tab'; tab: Tab }
  | { view: 'workout' }
  | { view: 'summary'; id: string }
  | { view: 'settings' };

export function parseRoute(hash: string): Route {
  const [first = '', second = ''] = hash.replace(/^#\/?/, '').split('?')[0]!.split('/');
  if (first === 'workout') return { view: 'workout' };
  if (first === 'settings') return { view: 'settings' };
  if (first === 'summary' && second) return { view: 'summary', id: decodeURIComponent(second) };
  return { view: 'tab', tab: (TABS as readonly string[]).includes(first) ? (first as Tab) : 'home' };
}

export function parseTab(hash: string): Tab {
  const r = parseRoute(hash);
  return r.view === 'tab' ? r.tab : 'home';
}

export function hrefFor(tab: Tab): string {
  return tab === 'home' ? '#/' : `#/${tab}`;
}

export function navigate(hash: string, replace = false): void {
  if (replace) window.location.replace(hash);
  else window.location.hash = hash;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

let cachedHash: string | null = null;
let cachedRoute: Route = { view: 'tab', tab: 'home' };
function snapshot(): Route {
  if (window.location.hash !== cachedHash) {
    cachedHash = window.location.hash;
    cachedRoute = parseRoute(cachedHash);
  }
  return cachedRoute;
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, snapshot);
}

export function useTab(): Tab {
  return useSyncExternalStore(subscribe, () => parseTab(window.location.hash));
}
