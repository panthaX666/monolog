import { addDays, daysBetween } from './dates';
import type { BodyEntry, DayKey, MetricKey } from './types';

// Body metrics — SPEC N13. Derived values are computed on display, never stored.

export const METRICS: { key: MetricKey; label: string; unit: 'kg' | '%' | 'cm'; step: number; decimals: number }[] = [
  { key: 'weightKg', label: 'Body weight', unit: 'kg', step: 0.1, decimals: 1 },
  { key: 'bodyFatPct', label: 'Body fat', unit: '%', step: 0.1, decimals: 1 },
  { key: 'muscleMassKg', label: 'Muscle mass', unit: 'kg', step: 0.1, decimals: 1 },
  { key: 'waistCm', label: 'Waist', unit: 'cm', step: 0.5, decimals: 1 },
];

export function metricInfo(key: MetricKey) {
  return METRICS.find((m) => m.key === key)!;
}

export interface Point {
  day: DayKey;
  value: number;
}

/** Entries with a value for `key`, oldest first. */
export function series(entries: BodyEntry[], key: MetricKey): Point[] {
  return entries
    .filter((e) => e[key] != null)
    .map((e) => ({ day: e.dayKey, value: e[key] as number }))
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

/** Trailing 7-day average at each point (average of entries in the 7 days ending that day). */
export function rollingAverage(points: Point[], days = 7): Point[] {
  return points.map((p, i) => {
    const from = addDays(p.day, -(days - 1));
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0 && points[j]!.day >= from; j--) {
      sum += points[j]!.value;
      n += 1;
    }
    return { day: p.day, value: sum / n };
  });
}

/**
 * Change from the latest value to the most recent value at least `days` old. If nothing is that
 * old, compares with the earliest value. null when there are fewer than two points.
 */
export function change(points: Point[], days: number): number | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1]!;
  const cutoff = addDays(last.day, -days);
  let base = points[0]!;
  for (const p of points) if (p.day <= cutoff) base = p;
  if (base === last) return null;
  return last.value - base.value;
}

export function latest(points: Point[]): Point | null {
  return points[points.length - 1] ?? null;
}

export interface Derived {
  bmi: number | null;
  fatMassKg: number | null;
  leanMassKg: number | null;
}

export function derive(weightKg: number | null, bodyFatPct: number | null, heightCm: number | null): Derived {
  const bmi = weightKg != null && heightCm ? weightKg / (heightCm / 100) ** 2 : null;
  const fatMassKg = weightKg != null && bodyFatPct != null ? (weightKg * bodyFatPct) / 100 : null;
  const leanMassKg = weightKg != null && fatMassKg != null ? weightKg - fatMassKg : null;
  return { bmi, fatMassKg, leanMassKg };
}

/**
 * Weekly check-in banner (SPEC D23): due on the chosen weekday if nothing was logged today, or any
 * day once the last check-in is more than 7 days old.
 */
export function checkInDue(entries: BodyEntry[], today: DayKey, checkInDay: number, weekdayOfToday: number): boolean {
  const last = entries.reduce<DayKey | null>((m, e) => (m == null || e.dayKey > m ? e.dayKey : m), null);
  if (last === today) return false;
  if (weekdayOfToday === checkInDay) return true;
  return last == null ? false : daysBetween(last, today) > 7;
}
