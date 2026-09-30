import { describe, expect, it } from 'vitest';
import { hrefFor, parseRoute, parseTab } from './route';

describe('parseTab', () => {
  it('defaults to home', () => {
    expect(parseTab('')).toBe('home');
    expect(parseTab('#/')).toBe('home');
    expect(parseTab('#/nope')).toBe('home');
  });

  it('reads known tabs, ignoring sub-paths and queries', () => {
    expect(parseTab('#/history')).toBe('history');
    expect(parseTab('#/exercises/abc')).toBe('exercises');
    expect(parseTab('#/body?range=1y')).toBe('body');
  });

  it('round-trips with hrefFor', () => {
    for (const tab of ['home', 'history', 'exercises', 'body'] as const) {
      expect(parseTab(hrefFor(tab))).toBe(tab);
    }
  });
});

describe('parseRoute', () => {
  it('full-screen views', () => {
    expect(parseRoute('#/workout')).toEqual({ view: 'workout' });
    expect(parseRoute('#/settings')).toEqual({ view: 'settings' });
    expect(parseRoute('#/summary/abc-123')).toEqual({ view: 'summary', id: 'abc-123' });
  });
  it('summary without an id falls back to home', () => {
    expect(parseRoute('#/summary')).toEqual({ view: 'tab', tab: 'home' });
  });
});
