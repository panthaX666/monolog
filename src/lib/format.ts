import type { DayKey } from '../domain/types';

/** 95 → "1:35", 3725 → "1:02:05". */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** 3120 s → "52 min", 4500 s → "1 h 15 min". */
export function formatDuration(totalSec: number): string {
  const min = Math.max(0, Math.round(totalSec / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function dateOf(day: DayKey): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

/** "28 Sep" (adds the year when it isn't this year). */
export function formatDay(day: DayKey, today?: DayKey): string {
  const d = dateOf(day);
  const sameYear = !today || today.slice(0, 4) === day.slice(0, 4);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** "Wed 30 Sep" */
export function formatWeekday(day: DayKey): string {
  return dateOf(day).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "10:42" in the phone's locale. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
