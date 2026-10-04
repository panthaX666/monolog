import { writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { seedExercises } from '../src/data/seed';
import { SCHEMA_VERSION } from '../src/data/db';
import { addDays, toDayKey } from '../src/domain/dates';
import { DEFAULT_SETTINGS, type Session, type SessionExercise, type WorkoutSet } from '../src/domain/types';

// Speed with 3 years of training (~50k sets): restore a generated backup the normal way (Settings),
// then time the screens that read the most data, and logging a set on the heaviest exercise.

const LIMIT_MS = { home: 3000, history: 3000, exercise: 3000, logSet: 1500 };

function threeYears(today: string) {
  const exercises = seedExercises(new Date().toISOString());
  const lifts = exercises.filter((e) => e.type === 'weight_reps').slice(0, 28);
  const sessions: Session[] = [];
  const sessionExercises: SessionExercise[] = [];
  const sets: WorkoutSet[] = [];
  let n = 0;
  const id = () => `perf-${(n++).toString(36)}`;
  // Bench Press every training day, so it carries the longest history.
  const bench = exercises.find((e) => e.name === 'Bench Press')!;

  for (let d = 1095; d >= 1; d--) {
    if (d % 7 === 3 || d % 7 === 6) continue; // 5 days a week
    const dayKey = addDays(today, -d);
    const start = new Date(`${dayKey}T18:00:00`);
    const session: Session = {
      id: id(),
      dayKey,
      startedAt: start.toISOString(),
      endedAt: new Date(start.getTime() + 75 * 60_000).toISOString(),
      repeatedFrom: null,
    };
    sessions.push(session);
    const picks = [bench, ...Array.from({ length: 6 }, (_, k) => lifts[(d * 3 + k * 5) % lifts.length]!)];
    picks.forEach((ex, order) => {
      const se: SessionExercise = { id: id(), sessionId: session.id, exerciseId: ex.id, order };
      sessionExercises.push(se);
      const progress = (1095 - d) / 1095; // slow progress with noise, so records keep happening
      for (let i = 0; i < 9; i++) {
        const weight = Math.round((20 + 40 * progress + ((d * 7 + i * 3) % 5) * 2.5) / 2.5) * 2.5;
        sets.push({
          id: id(),
          sessionExerciseId: se.id,
          sessionId: session.id,
          exerciseId: ex.id,
          dayKey,
          order: i,
          kind: i === 0 ? 'warmup' : 'working',
          toFailure: false,
          weight,
          unit: 'kg',
          weightKg: weight,
          reps: 6 + ((d + i) % 7),
          durationSec: null,
          distanceM: null,
          note: '',
          loggedAt: new Date(start.getTime() + (order * 9 + i) * 3 * 60_000).toISOString(),
        });
      }
    });
  }
  return {
    app: 'monolog',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      settings: [DEFAULT_SETTINGS],
      exercises,
      sessions,
      sessionExercises,
      sets,
      restDays: [],
      bodyEntries: [],
      recordEvents: [],
    },
  };
}

async function timed(_page: Page, name: string, limit: number, action: () => Promise<void>) {
  const t0 = Date.now();
  await action();
  const ms = Date.now() - t0;
  console.log(`${name}: ${ms} ms`);
  expect.soft(ms, `${name} took ${ms} ms`).toBeLessThan(limit);
}

const tab = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name });

test('stays fast with 3 years of data', async ({ page }, info) => {
  test.setTimeout(300_000);
  const backup = threeYears(toDayKey(new Date()));
  console.log(`generated ${backup.data.sessions.length} workouts, ${backup.data.sets.length} sets`);
  expect(backup.data.sets.length).toBeGreaterThan(45_000);
  const file = info.outputPath('three-years.json');
  writeFileSync(file, JSON.stringify(backup));

  await page.goto('./#/settings');
  await page.locator('input[type=file]').setInputFiles(file);
  await page.getByRole('dialog', { name: 'Restore backup' }).getByRole('button', { name: 'Replace' }).click();
  await expect(page.getByRole('status')).toHaveText('Backup restored.', { timeout: 180_000 });

  await timed(page, 'Home (cold load)', LIMIT_MS.home, async () => {
    await page.goto('./');
    await expect(page.getByText('Recent records')).toBeVisible();
    await expect(page.getByLabel(/streak/i).first()).toBeVisible();
  });
  await timed(page, 'History', LIMIT_MS.history, async () => {
    await tab(page, 'History').click();
    await expect(page.getByRole('group', { name: 'Month calendar' })).toBeVisible();
    await expect(page.locator('.history-card').first()).toBeVisible();
  });
  await timed(page, 'Exercises list', LIMIT_MS.exercise, async () => {
    await tab(page, 'Exercises').click();
    await expect(page.getByRole('button', { name: 'Bench Press', exact: true })).toContainText(/\d/);
  });
  await timed(page, 'Exercise page (Bench Press, ~6k sets)', LIMIT_MS.exercise, async () => {
    await page.getByRole('button', { name: 'Bench Press', exact: true }).click();
    await expect(page.getByText('Est. 1-rep max')).toBeVisible();
  });

  await timed(page, 'Exercise chart (all time)', LIMIT_MS.exercise, async () => {
    await page.getByRole('tab', { name: 'Chart' }).click();
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(page.locator('svg').first()).toBeVisible();
  });

  await tab(page, 'Home').click();
  await page.getByRole('button', { name: '▶ Start workout' }).click();
  await timed(page, 'Open the exercise picker', LIMIT_MS.logSet, async () => {
    await page.getByRole('button', { name: '＋ Add exercise' }).click();
    await expect(page.getByText('Recent')).toBeVisible();
  });
  await page.getByRole('searchbox', { name: 'Search exercises' }).fill('bench press');
  await page.getByRole('dialog', { name: 'Add exercise' }).getByRole('button', { name: 'Bench Press', exact: true }).click();
  const row = page.getByRole('region', { name: 'Bench Press' }).getByTestId('set-row').nth(1);
  await expect(row.getByRole('button', { name: 'Log set' })).toBeVisible();
  await timed(page, 'Log a set (Bench Press)', LIMIT_MS.logSet, async () => {
    await row.getByRole('button', { name: 'Log set' }).click();
    await expect(row.getByRole('button', { name: 'Un-log set' })).toBeVisible();
  });
});
