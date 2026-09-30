import { describe, expect, it } from 'vitest';
import { hrefFor, parseTab } from './route';

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
