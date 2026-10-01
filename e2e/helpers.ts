import { expect, type Page } from '@playwright/test';

export async function addExercise(page: Page, search: string, name: string) {
  await page.getByRole('button', { name: '＋ Add exercise' }).click();
  await page.getByRole('searchbox', { name: 'Search exercises' }).fill(search);
  await page.getByRole('dialog', { name: 'Add exercise' }).getByRole('button', { name, exact: true }).click();
}

export async function pad(page: Page, keys: string) {
  const p = page.getByRole('dialog', { name: 'Number pad' });
  for (const k of keys) await p.getByRole('button', { name: k, exact: true }).click();
}

/** Fill and log sets [kg, reps] on an exercise card, starting at row `from`. */
export async function logSets(page: Page, exercise: string, sets: [string, string][], from = 0) {
  const card = page.getByRole('region', { name: exercise });
  for (let i = 0; i < sets.length; i++) {
    const [kg, reps] = sets[i]!;
    const row = card.getByTestId('set-row').nth(from + i);
    await row.getByRole('button', { name: 'Weight' }).click();
    await pad(page, kg);
    await page.getByRole('button', { name: 'Next: reps →' }).click();
    await pad(page, reps);
    await page.getByRole('button', { name: '✓ Log set' }).click();
    await expect(row.getByRole('button', { name: 'Un-log set' })).toBeVisible();
  }
}

export async function finishWorkout(page: Page) {
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await page.getByRole('dialog', { name: 'Finish workout' }).getByRole('button', { name: 'Finish', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workout complete' })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
}
