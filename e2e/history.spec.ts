import { expect, test, type Page } from '@playwright/test';
import { addExercise, finishWorkout, logSets, pad } from './helpers';

// M3: History, editing a past workout, Repeat, Exercises tab, exercise pages and editing.

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

async function doWorkout(page: Page) {
  await page.getByRole('button', { name: '▶ Start workout' }).click();
  await addExercise(page, 'rope push', 'Rope Tricep Pushdown');
  await logSets(page, 'Rope Tricep Pushdown', [
    ['45', '10'],
    ['45', '8'],
  ]);
  // Note on set 2
  const row = page.getByRole('region', { name: 'Rope Tricep Pushdown' }).getByTestId('set-row').nth(1);
  await row.getByRole('button', { name: 'Note' }).click();
  await page.getByPlaceholder('Note for this set').fill('elbow felt tight');
  await page.getByPlaceholder('Note for this set').press('Enter');
  await addExercise(page, 'bench press', 'Bench Press');
  await logSets(page, 'Bench Press', [['60', '8']]);
  await finishWorkout(page);
}

const tab = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name });

test('history lists the workout; editing it recomputes records silently and tidies on leave', async ({ page }) => {
  await doWorkout(page);
  await tab(page, 'History').click();
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();

  // Today is marked trained on the calendar; the workout is listed.
  await expect(page.getByRole('grid').getByRole('button', { name: /, trained$/ })).toHaveCount(1);
  const item = page.getByRole('button', { name: /^Workout / });
  await expect(item).toHaveCount(1);
  await expect(item).toContainText('Rope Tricep Pushdown · Bench Press · 3 sets');

  // Open it: edit mode (History back, Repeat, Done, Delete), no workout clock or rest timer.
  await item.click();
  await expect(page.getByRole('button', { name: 'Back to History' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Repeat this workout' })).toBeVisible();
  await expect(page.getByTestId('rest-chip')).toHaveCount(0);
  await expect(page.getByLabel('Workout time')).toHaveCount(0);

  // Edit set 2 reps 8 → 12: becomes a rep record, but no celebration in the past.
  const push = page.getByRole('region', { name: 'Rope Tricep Pushdown' });
  await push.getByTestId('set-row').nth(1).getByRole('button', { name: 'Reps' }).click();
  await pad(page, '12');
  await page.getByRole('dialog', { name: 'Number pad' }).press('Escape');
  await expect(push.getByTestId('set-row').nth(1)).toHaveClass(/rec/);
  await expect(page.getByRole('alertdialog', { name: 'New record' })).toHaveCount(0);

  // Add a pre-filled set but don't log it, then leave: it's tidied away.
  await push.getByRole('button', { name: '＋ Add set' }).click();
  await expect(push.getByTestId('set-row')).toHaveCount(3);
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
  await page.getByRole('button', { name: /^Workout / }).click();
  await expect(page.getByRole('region', { name: 'Rope Tricep Pushdown' }).getByTestId('set-row')).toHaveCount(2);

  // The edit shows up in the exercise's records.
  await page.getByRole('button', { name: 'Back to History' }).click();
  await tab(page, 'Exercises').click();
  await page.getByRole('searchbox', { name: 'Search exercises' }).fill('rope tricep');
  await page.getByRole('button', { name: 'Rope Tricep Pushdown' }).click();
  await expect(page.getByText('12 @ 45.0 kg')).toBeVisible();
  await expect(page.getByText('Rep record')).toBeVisible();
});

test('repeat a past workout; blocked while another workout is open', async ({ page }) => {
  await doWorkout(page);
  await tab(page, 'History').click();
  await page.getByRole('button', { name: /^Workout / }).click();
  await page.getByRole('button', { name: 'Repeat this workout' }).click();

  // Live workout with the same exercises, in order, pre-filled (faded) from that session.
  await expect(page.getByLabel('Workout time')).toBeVisible();
  const cards = page.getByRole('region');
  await expect(cards.nth(0)).toHaveAccessibleName('Rope Tricep Pushdown');
  await expect(cards.nth(1)).toHaveAccessibleName('Bench Press');
  const push = page.getByRole('region', { name: 'Rope Tricep Pushdown' });
  await expect(push.getByTestId('set-row')).toHaveCount(2);
  await expect(push.getByTestId('set-row').nth(1).getByRole('button', { name: 'Reps' })).toHaveText('8');
  await expect(push.getByTestId('set-row').nth(1).getByRole('button', { name: 'Reps' })).toHaveClass(/ghost/);

  // Trying to repeat again while this one is open is blocked.
  await page.getByRole('button', { name: 'Back to Home' }).click();
  await tab(page, 'History').click();
  await page.getByRole('button', { name: /^Workout / }).click();
  await page.getByRole('button', { name: 'Repeat this workout' }).click();
  await expect(page.getByText('A workout is already in progress')).toBeVisible();
  await page.getByRole('button', { name: 'Resume it' }).click();
  await expect(page.getByLabel('Workout time')).toBeVisible();
});

test('delete a past workout from its page', async ({ page }) => {
  await doWorkout(page);
  await tab(page, 'History').click();
  await page.getByRole('button', { name: /^Workout / }).click();
  await page.getByRole('button', { name: 'Delete workout' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete workout' });
  await expect(dialog.getByText('Delete this workout? 3 logged sets will be deleted.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
  await expect(page.getByText('No workouts this month.')).toBeVisible();
});

test('exercise page: notes, pinned note, rest; edit, archive and create', async ({ page }) => {
  await doWorkout(page);
  await tab(page, 'Exercises').click();
  await page.getByRole('searchbox', { name: 'Search exercises' }).fill('rope');
  await page.getByRole('button', { name: 'Rope Tricep Pushdown' }).click();

  // Notes tab lists the set note with its date and set number.
  await page.getByRole('tab', { name: 'Notes' }).click();
  await expect(page.getByText('“elbow felt tight”')).toBeVisible();
  await expect(page.getByText(/· set 2$/)).toBeVisible();
  // History tab shows the session.
  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByText('45.0×10 · 45.0×8')).toBeVisible();

  // Pinned note + per-exercise rest.
  await page.getByPlaceholder('e.g. Seat 4, rope attachment').fill('Pin 9');
  await page.getByPlaceholder('e.g. Seat 4, rope attachment').blur();
  await page.getByRole('button', { name: 'Longer rest' }).click();
  await expect(page.getByText('1:45')).toBeVisible();

  // Edit: rename and add a secondary muscle.
  await page.getByRole('button', { name: 'Edit exercise' }).click();
  await page.getByRole('textbox', { name: 'Exercise name' }).fill('Rope Pushdown');
  await page.getByRole('button', { name: 'Save' }).first().click();
  await expect(page.getByRole('heading', { name: 'Rope Pushdown' })).toBeVisible();

  // The new name, pinned note and rest show up in a workout.
  await tab(page, 'Home').click();
  await page.getByRole('button', { name: '▶ Start workout' }).click();
  await addExercise(page, 'rope push', 'Rope Pushdown');
  await expect(page.getByText('📌 Pin 9')).toBeVisible();
  await page.getByRole('button', { name: 'Discard workout' }).click();
  await page.getByRole('dialog', { name: 'Discard workout' }).getByRole('button', { name: 'Discard', exact: true }).click();

  // Archive: gone from the picker, listed under Archived, history kept.
  await tab(page, 'Exercises').click();
  await page.getByRole('searchbox', { name: 'Search exercises' }).fill('bench press');
  await page.getByRole('button', { name: 'Bench Press', exact: true }).click();
  await page.getByRole('button', { name: 'Edit exercise' }).click();
  await page.getByRole('button', { name: 'Archive exercise' }).click();
  await expect(page.getByRole('heading', { name: 'Exercises' })).toBeVisible();
  await page.getByRole('button', { name: 'Archived (1)' }).click();
  await expect(page.getByRole('button', { name: 'Bench Press', exact: true })).toBeVisible();
  await tab(page, 'Home').click();
  await page.getByRole('button', { name: '▶ Start workout' }).click();
  await page.getByRole('button', { name: '＋ Add exercise' }).click();
  await page.getByRole('searchbox', { name: 'Search exercises' }).fill('bench press');
  await expect(page.getByRole('dialog', { name: 'Add exercise' }).getByRole('button', { name: 'Bench Press', exact: true })).toHaveCount(0);
  await page.getByRole('dialog', { name: 'Add exercise' }).getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Discard workout' }).click();
  await page.getByRole('dialog', { name: 'Discard workout' }).getByRole('button', { name: 'Discard', exact: true }).click();

  // Create a new exercise from the tab with muscles and equipment.
  await tab(page, 'Exercises').click();
  await page.getByRole('button', { name: '＋ New' }).click();
  await page.getByRole('textbox', { name: 'Exercise name' }).fill('Cable Y Raise');
  await page.locator('.field', { hasText: 'Primary muscles' }).getByRole('button', { name: 'Side delts' }).click();
  await page.locator('.field', { hasText: 'Equipment' }).getByRole('button', { name: 'Cable', exact: true }).click();
  await page.getByRole('button', { name: 'Save' }).first().click();
  await expect(page.getByRole('heading', { name: 'Cable Y Raise' })).toBeVisible();
  await expect(page.getByText(/Side delts · Cable · Weight × reps/)).toBeVisible();

  // Duplicate names are refused.
  await page.getByRole('button', { name: 'Back to Exercises' }).click();
  await page.getByRole('button', { name: '＋ New' }).click();
  await page.getByRole('textbox', { name: 'Exercise name' }).fill('cable y raise');
  await page.getByRole('button', { name: 'Save' }).first().click();
  await expect(page.getByRole('alert')).toContainText('already exists');
});
