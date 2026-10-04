import type { MonologDB } from '../data/db';
import { getStreak, trainedDays } from '../data/repo';
import { addDays, toDayKey } from '../domain/dates';
import { formatSet } from '../domain/measure';
import { GROUP_LABEL, GROUPS, MUSCLE_GROUP } from '../domain/muscles';
import { dayStatus, type DayStatus } from '../domain/streak';
import type { DayKey, Exercise, Unit, WorkoutSet } from '../domain/types';
import { displayWeight } from '../domain/units';
import { download } from './download';
import { formatDuration } from './format';

// Share a workout as a 1080×1350 image (card "A: full log"): muscles, stats, every working set,
// records in gold, current streak with the last 7 days.

export interface ShareData {
  dayKey: DayKey;
  title: string;
  duration: string;
  sets: number;
  volume: number;
  unit: Unit;
  exercises: { name: string; record: boolean; sets: { text: string; record: boolean }[] }[];
  records: number;
  streak: number;
  last7: DayStatus[];
}

/** Volume = weight × reps over working sets of weight-lifting exercises, in `unit`. */
export function sessionVolume(sets: WorkoutSet[], exById: Map<string, Exercise>, unit: Unit): number {
  return sets
    .filter((s) => s.kind === 'working' && exById.get(s.exerciseId)?.type === 'weight_reps')
    .reduce((sum, s) => sum + (displayWeight(s.weight ?? 0, s.unit, unit) ?? 0) * (s.reps ?? 0), 0);
}

export async function loadShareData(db: MonologDB, sessionId: string, unit: Unit, now = new Date()): Promise<ShareData | null> {
  const session = await db.sessions.get(sessionId);
  if (!session) return null;
  const sets = (await db.sets.where('sessionId').equals(sessionId).toArray()).filter((s) => s.loggedAt);
  const ses = await db.sessionExercises.where('sessionId').equals(sessionId).sortBy('order');
  const exList = (await db.exercises.bulkGet(ses.map((s) => s.exerciseId))).filter((e): e is Exercise => !!e);
  const exById = new Map(exList.map((e) => [e.id, e]));
  const recordSetIds = new Set(
    (await db.recordEvents.where('setId').anyOf(sets.map((s) => s.id)).toArray()).map((r) => r.setId),
  );
  const [trained, rest] = await Promise.all([trainedDays(db), db.restDays.toArray()]);
  const streak = await getStreak(db, now, trained);
  const restSet = new Set(rest.map((r) => r.dayKey));
  const today = toDayKey(now);

  const working = sets.filter((s) => s.kind === 'working');
  const groups = GROUPS.filter((g) =>
    working.some((s) => exById.get(s.exerciseId)?.primaryMuscles.some((m) => MUSCLE_GROUP[m] === g)),
  );
  const end = session.endedAt ?? now.toISOString();

  return {
    dayKey: session.dayKey,
    title: groups.map((g) => GROUP_LABEL[g]).join(' · ') || 'Workout',
    duration: formatDuration((Date.parse(end) - Date.parse(session.startedAt)) / 1000),
    sets: working.length,
    volume: Math.round(sessionVolume(sets, exById, unit)),
    unit,
    exercises: ses.flatMap((se) => {
      const ex = exById.get(se.exerciseId);
      if (!ex) return [];
      const mine = working
        .filter((s) => s.sessionExerciseId === se.id)
        .sort((a, b) => a.order - b.order)
        .map((s) => ({ text: formatSet(s, ex.type, ex.unit ?? unit), record: recordSetIds.has(s.id) }));
      return [{ name: ex.name, record: mine.some((s) => s.record), sets: mine }];
    }),
    records: working.filter((s) => recordSetIds.has(s.id)).length,
    streak: streak.current,
    last7: Array.from({ length: 7 }, (_, i) => dayStatus(addDays(today, i - 6), trained, restSet)),
  };
}

// ---------------------------------------------------------------- drawing

const W = 1080;
const H = 1350;
const P = 64;
const FONT = '"Inter Variable", system-ui, sans-serif';
const C = { bg: '#000000', s1: '#111113', s2: '#1C1C1F', s3: '#2A2A2E', t1: '#FFFFFF', t2: '#A1A1A6', t3: '#6B6B70', gold: '#F5C542' };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Friday · 3 October 2026" */
export function longDate(day: DayKey): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return `${DAYS[date.getDay()]} · ${d} ${MONTHS[m - 1]} ${y}`;
}

function font(ctx: CanvasRenderingContext2D, size: number, weight = 400) {
  ctx.font = `${weight} ${size}px ${FONT}`;
}

/** Largest size ≤ `max` (down to `min`) at which `text` fits in `width`. */
function fit(ctx: CanvasRenderingContext2D, text: string, width: number, max: number, min: number, weight: number) {
  for (let size = max; size > min; size -= 2) {
    font(ctx, size, weight);
    if (ctx.measureText(text).width <= width) return size;
  }
  return min;
}

/** Splits set texts into lines no wider than `width`, joined with " · ". */
function wrapSets(ctx: CanvasRenderingContext2D, sets: ShareData['exercises'][number]['sets'], width: number) {
  const lines: (typeof sets)[] = [[]];
  let w = 0;
  const sep = ctx.measureText(' · ').width;
  for (const s of sets) {
    const sw = ctx.measureText(s.text).width;
    const line = lines[lines.length - 1]!;
    if (line.length && w + sep + sw > width) {
      lines.push([s]);
      w = sw;
    } else {
      w += (line.length ? sep : 0) + sw;
      line.push(s);
    }
  }
  return lines;
}

/** Draws one line of sets, right-aligned at `right` (or left-aligned at `left`), records in gold. */
function drawSets(ctx: CanvasRenderingContext2D, sets: ShareData['exercises'][number]['sets'], y: number, x: number, align: 'left' | 'right') {
  const sep = ' · ';
  const total = sets.reduce((w, s, i) => w + ctx.measureText(s.text).width + (i ? ctx.measureText(sep).width : 0), 0);
  let cx = align === 'right' ? x - total : x;
  ctx.textAlign = 'left';
  sets.forEach((s, i) => {
    if (i) {
      ctx.fillStyle = C.t3;
      ctx.fillText(sep, cx, y);
      cx += ctx.measureText(sep).width;
    }
    ctx.fillStyle = s.record ? C.gold : C.t2;
    ctx.fillText(s.text, cx, y);
    cx += ctx.measureText(s.text).width;
  });
}

interface Row {
  name: string;
  record: boolean;
  /** One line: name left, sets right. Otherwise name on its own line, sets wrapped below. */
  inline: boolean;
  lines: ShareData['exercises'][number]['sets'][];
}

function layoutRows(ctx: CanvasRenderingContext2D, data: ShareData, size: number): { rows: Row[]; height: number } {
  const inner = W - 2 * P;
  const lineH = size * 1.45;
  const rowPad = size * 0.75;
  let height = 0;
  const rows = data.exercises.map((ex) => {
    font(ctx, size, 600);
    const nameW = ctx.measureText(ex.name).width + (ex.record ? size * 0.75 : 0);
    font(ctx, size, 400);
    const sets = ex.sets.length ? ex.sets : [{ text: 'warm-ups', record: false }];
    const one = wrapSets(ctx, sets, inner - nameW - size);
    const inline = one.length === 1;
    const lines = inline ? one : wrapSets(ctx, sets, inner);
    height += (inline ? lineH : lineH * (1 + lines.length)) + rowPad * 2;
    return { name: ex.name, record: ex.record, inline, lines };
  });
  return { rows, height };
}

export function drawShareCard(ctx: CanvasRenderingContext2D, data: ShareData) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  const inner = W - 2 * P;

  // Date and headline (the muscle groups trained).
  font(ctx, 32);
  ctx.fillStyle = C.t2;
  ctx.textAlign = 'left';
  ctx.fillText(longDate(data.dayKey), P, P + 30);
  const hs = fit(ctx, data.title, inner, 76, 44, 700);
  font(ctx, hs, 700);
  ctx.fillStyle = C.t1;
  ctx.fillText(data.title, P, P + 40 + hs);

  // Stats.
  const statTop = 236;
  const statH = 172;
  const gap = 20;
  const bw = (inner - 2 * gap) / 3;
  const stats: [string, string][] = [
    [data.duration, 'time'],
    [String(data.sets), data.sets === 1 ? 'set' : 'sets'],
    [data.volume.toLocaleString('en-US'), `${data.unit} volume`],
  ];
  stats.forEach(([value, label], i) => {
    const x = P + i * (bw + gap);
    ctx.fillStyle = C.s1;
    ctx.beginPath();
    ctx.roundRect(x, statTop, bw, statH, 28);
    ctx.fill();
    const vs = fit(ctx, value, bw - 56, 54, 30, 700);
    font(ctx, vs, 700);
    ctx.fillStyle = C.t1;
    ctx.fillText(value, x + 28, statTop + 86);
    font(ctx, 28);
    ctx.fillStyle = C.t2;
    ctx.fillText(label, x + 28, statTop + 136);
  });

  // Streak box and footer, anchored to the bottom.
  const footY = H - P;
  const streakH = 170;
  const streakTop = footY - 52 - streakH;

  // Exercises: the biggest text size that fits; past the smallest, drop rows and say how many.
  const listTop = statTop + statH + 24;
  const listBottom = streakTop - 24;
  let size = 34;
  let lay = layoutRows(ctx, data, size);
  while (lay.height > listBottom - listTop && size > 22) {
    size -= 2;
    lay = layoutRows(ctx, data, size);
  }
  const lineH = size * 1.45;
  const rowPad = size * 0.75;
  let rows = lay.rows;
  let hidden = 0;
  const rowHeight = (r: Row) => (r.inline ? lineH : lineH * (1 + r.lines.length)) + rowPad * 2;
  while (rows.length > 1 && rows.reduce((h, r) => h + rowHeight(r), 0) + (hidden ? lineH + rowPad : 0) > listBottom - listTop) {
    rows = rows.slice(0, -1);
    hidden++;
  }

  let y = listTop;
  rows.forEach((r, i) => {
    const base = y + rowPad + lineH * 0.78;
    let nx = P;
    if (r.record) {
      ctx.fillStyle = C.gold;
      ctx.beginPath();
      ctx.roundRect(P, base - size * 0.62, size * 0.5, size * 0.5, size * 0.12);
      ctx.fill();
      nx += size * 0.75;
    }
    font(ctx, size, 600);
    ctx.fillStyle = C.t1;
    ctx.fillText(r.name, nx, base);
    font(ctx, size, 400);
    if (r.inline) drawSets(ctx, r.lines[0]!, base, W - P, 'right');
    else r.lines.forEach((line, j) => drawSets(ctx, line, base + lineH * (j + 1), P, 'left'));
    y += rowHeight(r);
    if (i < rows.length - 1 || hidden) {
      ctx.fillStyle = C.s2;
      ctx.fillRect(P, y - 1, inner, 2);
    }
  });
  if (hidden) {
    font(ctx, size, 400);
    ctx.fillStyle = C.t3;
    ctx.fillText(`+${hidden} more exercise${hidden === 1 ? '' : 's'}`, P, y + rowPad + lineH * 0.6);
  }

  // Streak.
  ctx.fillStyle = C.s1;
  ctx.beginPath();
  ctx.roundRect(P, streakTop, inner, streakH, 32);
  ctx.fill();
  font(ctx, 24, 600);
  ctx.letterSpacing = '2.5px';
  ctx.fillStyle = C.t2;
  ctx.fillText('STREAK', P + 40, streakTop + 58);
  ctx.letterSpacing = '0px';
  font(ctx, 76, 700);
  ctx.fillStyle = C.gold;
  const n = String(data.streak);
  ctx.fillText(n, P + 36, streakTop + 136);
  const nw = ctx.measureText(n).width;
  font(ctx, 32);
  ctx.fillStyle = C.t2;
  ctx.fillText(data.streak === 1 ? 'day' : 'days', P + 36 + nw + 12, streakTop + 136);

  const r = 15;
  const dgap = 16;
  const cy = streakTop + streakH / 2;
  let cx = W - P - 40 - (7 * 2 * r + 6 * dgap) + r;
  for (const status of data.last7) {
    ctx.beginPath();
    ctx.arc(cx, cy, status === 'rest' ? r - 2 : r, 0, Math.PI * 2);
    if (status === 'rest') {
      ctx.strokeStyle = C.t1;
      ctx.lineWidth = 4;
      ctx.stroke();
    } else {
      ctx.fillStyle = status === 'trained' ? C.t1 : C.s3;
      ctx.fill();
    }
    cx += 2 * r + dgap;
  }

  // Footer.
  font(ctx, 30, 700);
  ctx.letterSpacing = '1.5px';
  ctx.fillStyle = C.t1;
  ctx.fillText('MONOLOG', P, footY);
  ctx.letterSpacing = '0px';
  if (data.records) {
    font(ctx, 28);
    ctx.fillStyle = C.t3;
    ctx.textAlign = 'right';
    ctx.fillText(`${data.records} record${data.records === 1 ? '' : 's'}`, W - P, footY);
    ctx.textAlign = 'left';
  }
}

export async function renderShareImage(data: ShareData): Promise<Blob> {
  await Promise.all([400, 600, 700].map((w) => document.fonts.load(`${w} 40px "Inter Variable"`)));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  drawShareCard(canvas.getContext('2d')!, data);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the image'))), 'image/png'),
  );
}

/**
 * Opens the phone's share menu with the image (send it or save it). Where sharing files isn't
 * supported, downloads the PNG instead. Returns false if the user closed the share menu.
 */
export async function shareWorkoutImage(data: ShareData): Promise<boolean> {
  const blob = await renderShareImage(data);
  const file = new File([blob], `monolog-${data.dayKey}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return false;
      // Anything else (e.g. share not allowed here): fall through to a download.
    }
  }
  download(blob, file.name);
  return true;
}
