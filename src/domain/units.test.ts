import { describe, expect, it } from 'vitest';
import { displayWeight, formatWeight, fromKg, stepWeight, toKg } from './units';

describe('units', () => {
  it('converts lb ↔ kg exactly', () => {
    expect(toKg(100, 'lb')).toBeCloseTo(45.359237, 9);
    expect(fromKg(toKg(135, 'lb'), 'lb')).toBeCloseTo(135, 9);
    expect(toKg(45, 'kg')).toBe(45);
  });

  it('shows the entered value untouched when units match', () => {
    expect(displayWeight(42.5, 'kg', 'kg')).toBe(42.5);
    expect(displayWeight(35, 'lb', 'lb')).toBe(35);
  });

  it('converts for display only, rounded to 0.1', () => {
    expect(displayWeight(45, 'kg', 'lb')).toBe(99.2); // matches the old app's grey column
    expect(displayWeight(100, 'lb', 'kg')).toBe(45.4);
    expect(displayWeight(null, 'kg', 'lb')).toBeNull();
  });

  it('formats weights', () => {
    expect(formatWeight(45)).toBe('45.0');
    expect(formatWeight(42.5)).toBe('42.5');
    expect(formatWeight(43.75)).toBe('43.75');
    expect(formatWeight(0.1 + 0.2)).toBe('0.3');
    expect(formatWeight(null)).toBe('—');
  });

  it('steps without float drift and never below zero', () => {
    expect(stepWeight(42.5, 2.5, 1)).toBe(45);
    expect(stepWeight(0.1, 0.2, 1)).toBe(0.3);
    expect(stepWeight(1, 2.5, -1)).toBe(0);
  });
});
