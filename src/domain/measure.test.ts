import { describe, expect, it } from 'vitest';
import { change, checkInDue, derive, rollingAverage, series } from './body';
import { digitsToSeconds, formatKm, formatPace, formatSeconds, formatSet, pace, secondsToDigits } from './measure';
import { mkSet } from './testkit';
import type { BodyEntry } from './types';

describe('time, distance, pace', () => {
  it('formats seconds', () => {
    expect(formatSeconds(90)).toBe('1:30');
    expect(formatSeconds(5)).toBe('0:05');
    expect(formatSeconds(3725)).toBe('1:02:05');
    expect(formatSeconds(null)).toBe('—');
  });

  it('pad digits are microwave-style and round-trip', () => {
    expect(digitsToSeconds('130')).toBe(90);
    expect(digitsToSeconds('45')).toBe(45);
    expect(digitsToSeconds('4500')).toBe(2700);
    expect(digitsToSeconds('10000')).toBe(3600);
    expect(digitsToSeconds('')).toBeNull();
    for (const s of [5, 45, 90, 600, 2700, 3725]) expect(digitsToSeconds(secondsToDigits(s))).toBe(s);
  });

  it('distance and pace', () => {
    expect(formatKm(5000)).toBe('5.00 km');
    expect(pace({ durationSec: 1650, distanceM: 5000 })).toBeCloseTo(0.33);
    expect(formatPace(0.33)).toBe('5:30 /km');
    expect(pace({ durationSec: 600, distanceM: null })).toBeNull();
  });

  it('formats a set for each exercise type', () => {
    const base = { exerciseId: 'x', dayKey: '2026-09-30' };
    expect(formatSet(mkSet({ ...base, weight: 45, reps: 10 }), 'weight_reps', 'kg')).toBe('45.0×10');
    expect(formatSet(mkSet({ ...base, weight: 0, reps: 12 }), 'bodyweight_reps', 'kg')).toBe('12 reps');
    expect(formatSet(mkSet({ ...base, weight: 5, reps: 8 }), 'bodyweight_reps', 'kg')).toBe('+5.0×8');
    expect(formatSet(mkSet({ ...base, durationSec: 75 }), 'timed', 'kg')).toBe('1:15');
    expect(formatSet(mkSet({ ...base, distanceM: 5000, durationSec: 1500 }), 'cardio', 'kg')).toBe('5.00 km · 25:00');
    expect(formatSet(mkSet({ ...base, durationSec: 1200 }), 'cardio', 'kg')).toBe('20:00');
    expect(formatSet(mkSet({ ...base, weight: 100, unit: 'lb', reps: 5 }), 'weight_reps', 'kg')).toBe('45.4×5');
  });
});

const entry = (dayKey: string, p: Partial<BodyEntry>): BodyEntry => ({
  id: dayKey,
  dayKey,
  weightKg: null,
  bodyFatPct: null,
  muscleMassKg: null,
  waistCm: null,
  note: '',
  ...p,
});

describe('body metrics', () => {
  const entries = [
    entry('2026-09-01', { weightKg: 84 }),
    entry('2026-09-20', { weightKg: 83, bodyFatPct: 19 }),
    entry('2026-09-24', { weightKg: 82.8 }),
    entry('2026-09-27', { bodyFatPct: 18.5 }),
    entry('2026-09-30', { weightKg: 82.4 }),
  ];

  it('series skips missing values and sorts by day', () => {
    expect(series([...entries].reverse(), 'weightKg').map((p) => p.value)).toEqual([84, 83, 82.8, 82.4]);
    expect(series(entries, 'bodyFatPct').map((p) => p.day)).toEqual(['2026-09-20', '2026-09-27']);
  });

  it('7-day rolling average uses only the last 7 days', () => {
    const avg = rollingAverage(series(entries, 'weightKg'));
    expect(avg[0]!.value).toBe(84);
    expect(avg[2]!.value).toBeCloseTo((83 + 82.8) / 2);
    expect(avg[3]!.value).toBeCloseTo((82.8 + 82.4) / 2); // 20 Sep is 10 days before 30 Sep
  });

  it('change vs a week and a month ago', () => {
    const w = series(entries, 'weightKg');
    expect(change(w, 7)).toBeCloseTo(82.4 - 83); // latest ≤ 23 Sep is the 20th
    expect(change(w, 30)).toBeCloseTo(82.4 - 84); // nothing that old → earliest
    expect(change(w.slice(0, 1), 7)).toBeNull();
  });

  it('derived BMI, fat and lean mass', () => {
    const d = derive(82.4, 18.2, 178);
    expect(d.bmi).toBeCloseTo(26.0, 1);
    expect(d.fatMassKg).toBeCloseTo(15.0, 1);
    expect(d.leanMassKg).toBeCloseTo(67.4, 1);
    expect(derive(82.4, null, null)).toEqual({ bmi: null, fatMassKg: null, leanMassKg: null });
  });

  it('check-in is due on the chosen weekday, or when the last one is over a week old', () => {
    expect(checkInDue(entries, '2026-10-04', 0, 0)).toBe(true); // Sunday = check-in day
    expect(checkInDue(entries, '2026-10-01', 0, 4)).toBe(false); // Thursday, last check-in yesterday
    expect(checkInDue(entries, '2026-10-08', 0, 4)).toBe(true); // 8 days since
    expect(checkInDue([...entries, entry('2026-10-04', { weightKg: 82 })], '2026-10-04', 0, 0)).toBe(false); // done today
    expect(checkInDue([], '2026-10-01', 0, 4)).toBe(false);
  });
});
