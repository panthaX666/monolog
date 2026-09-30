import type { Unit } from './types';

export const KG_PER_LB = 0.45359237;

export function toKg(weight: number, unit: Unit): number {
  return unit === 'kg' ? weight : weight * KG_PER_LB;
}

export function fromKg(kg: number, unit: Unit): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB;
}

/**
 * Weight to show for a stored set in `displayUnit` (SPEC §6.4): the exact entered value when units
 * match, otherwise converted and rounded to 0.1. Stored values are never rewritten.
 */
export function displayWeight(weight: number | null, unit: Unit, displayUnit: Unit): number | null {
  if (weight == null) return null;
  if (unit === displayUnit) return weight;
  return Math.round(fromKg(toKg(weight, unit), displayUnit) * 10) / 10;
}

/** "45.0", "42.5", "43.75" — one decimal minimum, no float noise. */
export function formatWeight(value: number | null): string {
  if (value == null) return '—';
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded * 10) ? rounded.toFixed(1) : String(rounded);
}

/** Step a weight by ±step without float drift (e.g. 42.5 + 2.5 = 45). Never below 0. */
export function stepWeight(value: number, step: number, dir: 1 | -1): number {
  return Math.max(0, Math.round((value + dir * step) * 1000) / 1000);
}

export const EPS = 1e-6;
