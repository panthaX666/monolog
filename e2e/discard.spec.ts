import { expect, test, type Page } from '@playwright/test';

// Discard workout, and leaving a workout via Home without losing it.

async function addExercise(page: Page, search: string, name: string) {
  await page.getByRole('button', { name: '＋ Add exercise' }).click();
  await page.getByRole('searchbox', { name: 'Search exercises' }).fill(search);
  await page.getByRole('dialog', { name: 'Add exercise' }).getByRole('button', { name, exact: true }).click();
}

async function logSets(page: Page, exercise: string, sets: [string, string][]) {
  const card = page.getByRole('region', { name: exercise });
  for (let i = 0; i < sets.length; i++) {
    const [kg, reps] = sets[i]!;
    const row = card.getByTestId('set-row').nth(i);
    await row.getByRole('button', { name: 'Weight' }).click();
    const pad = page.getByRole('dialog', { name: 'Number pad' });
    for (const k of kg) await pad.getByRole('button', { name: k, exact: true }).click();
    await page.getByRole('button', { name: 'Enter', exact: true }).click();
    for (const k of reps) await pad.getByRole('button', { name: k, exact: true }).click();
    await page.getByRole('button', { name: '✓ Log set' }).click();
    await expect(row.getByRole('button', { name: 'Un-log set' })).toBeVisible();
  }
}

const workoutClock = (page: Page) => page.getByLabel('Workout time');

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
});

test('discard an empty workout', async ({ page }) => {
  await page.getByRole('button', { name: '▶ Start workout' }).click();
  await expect(page.getByText('Empty workout')).toBeVisible();

  await page.getByRole('button', { name: 'Discard workout' }).click();
  const dialog = page.getByRole('dialog', { name: 'Discard workout' });
  await expect(dialog.getByText('Discard workout?', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/Nothing has been logged/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Discard', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await expect(page.getByRole('button', { name: '▶ Start workout' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Resume workout/ })).toHaveCount(0);
  // Going to the workout URL now bounces back Home: nothing is open.
  await page.goto('./#/workout');
  await expect(page.getByRole('button', { name: '▶ Start workout' })).toBeVisible();
});

test('discard a workout with logged sets, after confirming', async ({ page }) => {
  await page.getByRole('button', { name: '▶ Start workout' }).click();
  await addExercise(page, 'bench press', 'Bench Press');
  await logSets(page, 'Bench Press', [
    ['60', '8'],
    ['60', '7'],
  ]);
  await page.getByTestId('rest-chip').click(); // start the rest timer
  await expect(page.getByTestId('rest-chip')).toHaveClass(/running/);

  // Cancel keeps everything.
  await page.getByRole('button', { name: 'Discard workout' }).click();
  const dialog = page.getByRole('dialog', { name: 'Discard workout' });
  await expect(dialog.getByText('Discard workout? 2 logged sets will be deleted.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('region', { name: 'Bench Press' }).getByTestId('set-row')).toHaveCount(3);

  // Confirm deletes it.
  await page.getByRole('button', { name: 'Discard workout' }).click();
  await page.getByRole('dialog', { name: 'Discard workout' }).getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(page.getByRole('button', { name: '▶ Start workout' })).toBeVisible();
  await expect(page.getByTestId('streak-count')).toHaveText('0'); // the logged sets are gone

  // A new workout starts clean: no history from the discarded one, rest timer stopped, clock from 0.
  await page.getByRole('button', { name: '▶ Start workout' }).click();
  await expect(page.getByTestId('rest-chip')).not.toHaveClass(/running/);
  await expect(workoutClock(page)).toHaveText(/● 0:0\d/);
  await addExercise(page, 'bench press', 'Bench Press');
  await expect(page.getByRole('region', { name: 'Bench Press' }).getByText('First time. No history yet')).toBeVisible();
});

test('going Home keeps the workout and its timer running', async ({ page }) => {
  await page.getByRole('button', { name: '▶ Start workout' }).click();
  await expect(workoutClock(page)).toHaveText(/● 0:0\d/); // starts automatically

  // Exercises added, nothing logged → go Home → still open.
  await addExercise(page, 'squat', 'Squat');
  await page.getByRole('button', { name: 'Back to Home' }).click();
  const resume = page.getByRole('button', { name: /Resume workout · \d+:\d\d/ });
  await expect(resume).toBeVisible();
  await expect(page.getByRole('button', { name: '▶ Start workout' })).toHaveCount(0);
  await page.waitForTimeout(2100);
  await expect(resume).not.toHaveText(/0:0[01]$/); // still ticking while on Home

  // Survives other tabs and a full reload.
  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.getByRole('button', { name: /Resume workout/ })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /Resume workout/ }).click();
  await expect(page.getByRole('region', { name: 'Squat' })).toBeVisible();

  // Log a set, go Home, come back: still there.
  await logSets(page, 'Squat', [['100', '5']]);
  await page.getByRole('button', { name: 'Back to Home' }).click();
  await page.getByRole('button', { name: /Resume workout/ }).click();
  await expect(
    page.getByRole('region', { name: 'Squat' }).getByTestId('set-row').first().getByRole('button', { name: 'Un-log set' }),
  ).toBeVisible();
});
