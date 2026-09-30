import type { ReactNode } from 'react';
import { hrefFor, type Tab } from '../lib/route';

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const ICONS: Record<Tab, ReactNode> = {
  home: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  ),
  exercises: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M6.5 8v8M17.5 8v8M3.5 10v4M20.5 10v4M6.5 12h11" />
    </svg>
  ),
  body: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M4 19V11M10 19V5M16 19v-6M22 19H2" />
    </svg>
  ),
};

const LABELS: Record<Tab, string> = { home: 'Home', history: 'History', exercises: 'Exercises', body: 'Body' };

export function TabBar({ current }: { current: Tab }) {
  return (
    <nav className="tabs" aria-label="Main">
      {(Object.keys(LABELS) as Tab[]).map((tab) => (
        <a
          key={tab}
          className="tab"
          href={hrefFor(tab)}
          aria-current={tab === current ? 'page' : undefined}
          style={{ textDecoration: 'none' }}
        >
          {ICONS[tab]}
          {LABELS[tab]}
        </a>
      ))}
    </nav>
  );
}
