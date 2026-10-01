import type { ExerciseType, Unit, WorkoutSet } from './types';
import { displayWeight, formatWeight } from './units';

// Formatting of the non-weight measures (SPEC D30): time, distance, pace, and one place that
// turns any set into short text for its exercise type.

/** 90 → "1:30", 3725 → "1:02:05". */
export function formatSeconds(sec: number | null): string {
  if (sec == null) return '—';
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/**
 * Digits typed on the pad → seconds, microwave-style: "130" = 1:30, "4500" = 45:00, "10000" = 1:00:00.
 * The last two digits are seconds, the two before are minutes, the rest hours.
 */
export function digitsToSeconds(digits: string): number | null {
  const d = digits.replace(/\D/g, '');
  if (!d) return null;
  const n = d.padStart(6, '0');
  const h = Number(n.slice(0, -4));
  const m = Number(n.slice(-4, -2));
  const s = Number(n.slice(-2));
  return h * 3600 + m * 60 + s;
}

/** Seconds → the digit string the pad would show (inverse of digitsToSeconds, normalised). */
export function secondsToDigits(sec: number | null): string {
  if (sec == null) return '';
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const out = `${h || ''}${h ? String(m).padStart(2, '0') : m || ''}${String(s % 60).padStart(m || h ? 2 : 1, '0')}`;
  return out.replace(/^0+(?=\d)/, '');
}

/** Metres → "5.00 km" (km with two decimals). */
export function formatKm(m: number | null): string {
  if (m == null) return '—';
  return `${(m / 1000).toFixed(2)} km`;
}

/** Seconds per metre → "5:30 /km". */
export function formatPace(secPerM: number | null): string {
  if (secPerM == null || !Number.isFinite(secPerM)) return '—';
  return `${formatSeconds(secPerM * 1000)} /km`;
}

export function pace(set: Pick<WorkoutSet, 'durationSec' | 'distanceM'>): number | null {
  return set.durationSec && set.distanceM ? set.durationSec / set.distanceM : null;
}

/** One set as short text for its exercise type, e.g. "45.0×10", "+5.0×8", "1:30", "5.00 km · 25:00". */
export function formatSet(set: WorkoutSet, type: ExerciseType, unit: Unit): string {
  const w = displayWeight(set.weight, set.unit, unit);
  switch (type) {
    case 'weight_reps':
      return `${formatWeight(w)}×${set.reps ?? '—'}`;
    case 'bodyweight_reps':
      return w ? `+${formatWeight(w)}×${set.reps ?? '—'}` : `${set.reps ?? '—'} reps`;
    case 'timed':
      return w ? `+${formatWeight(w)} · ${formatSeconds(set.durationSec)}` : formatSeconds(set.durationSec);
    case 'cardio':
      return [set.distanceM ? formatKm(set.distanceM) : null, set.durationSec ? formatSeconds(set.durationSec) : null]
        .filter(Boolean)
        .join(' · ');
  }
}

/** Does this exercise type log a weight column? */
export const hasWeight = (type: ExerciseType) => type !== 'cardio';
