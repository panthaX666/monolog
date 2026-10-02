import { expect, test, type Page } from '@playwright/test';
import { addExercise, finishWorkout, logSets, pad } from './helpers';

// M4: timed & cardio logging, body check-ins and charts, Home cards, exercise chart.

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  (page as unknown as { errors: string[] }).errors = errors;
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
});
test.afterEach(async ({ page }) => {
  expect((page as unknown as { errors: string[] }).errors).toEqual([]);
});

const tab = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name });

async function logTime(page: Page, exercise: string, row: number, digits: string) {
  const r = page.getByRole('region', { name: exercise }).getByTestId('set-row').nth(row);
  await r.getByRole('button', { name: 'Time' }).click();
  await pad(page, digits);
  await page.getByRole('button', { name: '✓ Log set' }).click();
  await expect(r.getByRole('button', { name: 'Un-log set' })).toBeVisible();
}

test('timed exercise: log a plank, then hold longer for a time record', async ({ page }) => {
  await page.getByRole('button', { name: '▶ Start workout' }).click();
  await addExercise(page, 'plank', 'Plank');
  const card = page.getByRole('region', { name: 'Plank' });
  await expect(card.getByText('+KG', { exact: true })).toBeVisible();
  await expect(card.getByText('TIME', { exact: true })).toBeVisible();

  // ✓ on a blank timed set opens the pad on Time (added weight is optional).
  await card.getByRole('button', { name: 'Log set' }).first().click();
  await expect(page.getByTestId('pad-duration')).toBeVisible();
  await pad(page, '100'); // microwave-style: 1:00
  await expect(page.getByTestId('pad-duration')).toHaveText('1:00');
  await page.getByRole('button', { name: '✓ Log set' }).click();
  await finishWorkout(page);

  await page.getByRole('button', { name: '▶ Start workout' }).click();
  await addExercise(page, 'plank', 'Plank');
  await expect(page.getByRole('region', { name: 'Plank' }).getByText(/Last · .*1:00/)).toBeVisible();
  await logTime(page, 'Plank', 0, '115');
  const cel = page.getByRole('alertdialog', { name: 'New record' });
  await expect(cel.getByText('NEW TIME RECORD')).toBeVisible();
  await expect(cel.getByText('+0:15')).toBeVisible();
  await cel.getByRole('button', { name: 'OK' }).click();
  await page.getByRole('button', { name: 'Records for Plank' }).click();
  await expect(page.getByText('Longest hold')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Records for Plank' }).getByText('1:15')).toBeVisible();
});

test('cardio: distance and time, shown in the summary', async ({ page }) => {
  await page.getByRole('button', { name: '▶ Start workout' }).click();
  await addExercise(page, 'treadmill', 'Treadmill Run');
  const row = page.getByRole('region', { name: 'Treadmill Run' }).getByTestId('set-row').first();
  await row.getByRole('button', { name: 'Distance' }).click();
  await pad(page, '5');
  await page.getByRole('button', { name: 'Enter', exact: true }).click();
  await pad(page, '3000');
  await expect(page.getByTestId('pad-distance')).toHaveText('5.00');
  await expect(page.getByTestId('pad-duration')).toHaveText('30:00');
  await page.getByRole('button', { name: '✓ Log set' }).click();
  await expect(row.getByRole('button', { name: 'Un-log set' })).toBeVisible();
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await page.getByRole('dialog', { name: 'Finish workout' }).getByRole('button', { name: 'Finish', exact: true }).click();
  await expect(page.getByText('5.00 km · 30:00')).toBeVisible();
});

test('body: check in, see it on Body and Home, BMI from height, delete an entry', async ({ page }) => {
  // Home shows a prompt to log weight.
  await page.getByRole('button', { name: 'Log your body weight' }).click();
  const sheet = page.getByRole('dialog', { name: 'Check in' });
  await sheet.getByRole('textbox', { name: /Body weight/ }).fill('82.4');
  await sheet.getByRole('textbox', { name: /Body fat/ }).fill('18.2');
  await sheet.getByRole('button', { name: '✓ Save' }).click();
  await expect(page.getByRole('button', { name: 'Body weight', exact: true })).toContainText('82.4');

  await tab(page, 'Body').click();
  await expect(page.locator('.hero-num')).toHaveText('82.4');
  await expect(page.getByRole('region', { name: 'Body weight (kg)' })).toBeVisible();
  await page.getByRole('region', { name: 'Body weight (kg)' }).getByRole('button', { name: 'Show as table' }).click();
  await expect(page.getByRole('cell', { name: '82.4' }).first()).toBeVisible();
  await expect(page.getByText('Fat mass')).toBeVisible();

  // Height → BMI.
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('textbox', { name: 'Height in centimetres' }).fill('178');
  await page.getByRole('textbox', { name: 'Height in centimetres' }).blur();
  await page.goto('./#/body');
  await expect(page.locator('.kv', { hasText: 'BMI' })).toContainText('26.0');

  // Check in again today: pre-filled, updates the same day's entry.
  await page.getByRole('button', { name: '＋ Check in' }).click();
  await expect(page.getByRole('dialog', { name: 'Check in' }).getByRole('textbox', { name: /Body weight/ })).toHaveValue('82.4');
  await page.getByRole('button', { name: 'Increase Body weight' }).click();
  await page.getByRole('button', { name: '✓ Save' }).click();
  await expect(page.locator('.hero-num')).toHaveText('82.5');

  // Metric page: delete the body-fat entry.
  await page.getByRole('button', { name: /Body fat/ }).click();
  await expect(page.getByRole('heading', { name: 'Body fat' })).toBeVisible();
  await page.getByRole('button', { name: /^Delete .* entry$/ }).click();
  await expect(page.getByText('No entries yet.')).toBeVisible();
});

test('home cards and the exercise chart after two workouts', async ({ page }) => {
  for (const reps of ['10', '11']) {
    await page.getByRole('button', { name: '▶ Start workout' }).click();
    await addExercise(page, 'rope push', 'Rope Tricep Pushdown');
    await logSets(page, 'Rope Tricep Pushdown', [['45', reps]]);
    const cel = page.getByRole('alertdialog', { name: 'New record' });
    if (reps === '11') await cel.getByRole('button', { name: 'OK' }).click();
    await finishWorkout(page);
  }

  // Coverage: arms trained in both sessions (same day counts per session).
  const cov = page.getByRole('button', { name: "This week's muscle coverage" });
  await expect(cov.locator('.cov-row', { hasText: 'Arms' })).toContainText('2');
  await cov.click();
  await expect(page.getByRole('img', { name: 'Working sets this week by muscle group' })).toBeVisible();
  await page.keyboard.press('Escape');

  // Recent records card links to the exercise.
  const recs = page.getByRole('region', { name: 'Recent records' });
  await expect(recs).toContainText('Rope Tricep Pushdown');
  await recs.getByRole('button', { name: /Rope Tricep Pushdown/ }).click();

  // Exercise chart tab: a point per workout, the record one gold; table view lists both.
  await page.getByRole('tab', { name: 'Chart' }).click();
  await expect(page.locator('.chart svg circle.dot-record')).toHaveCount(1);
  await page.getByRole('button', { name: 'Top weight' }).click();
  await page.getByRole('button', { name: 'Show as table' }).click();
  await expect(page.locator('.chart-table tbody tr')).toHaveCount(2);
  await expect(page.locator('.chart-table tbody tr').first()).toContainText('★');
});
