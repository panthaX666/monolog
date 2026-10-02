import { expect, test } from '@playwright/test';
import { addExercise, pad } from './helpers';

// Number pad: only Enter on the first field, Log set only on the second, and a fast double tap on
// Enter doesn't log. Creating an exercise from the picker with optional muscles and equipment.

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await page.getByRole('button', { name: '▶ Start workout' }).click();
});

test('pad shows Enter on weight and Log set on reps; double tap on Enter does not log', async ({ page }) => {
  await addExercise(page, 'bench', 'Bench Press');
  const row = page.getByRole('region', { name: 'Bench Press' }).getByTestId('set-row').first();
  const dialog = page.getByRole('dialog', { name: 'Number pad' });

  await row.getByRole('button', { name: 'Weight' }).click();
  await pad(page, '60');
  await expect(dialog.getByRole('button', { name: '✓ Log set' })).toHaveCount(0);

  // Two quick taps on the same spot: Enter, then the Log set that replaced it.
  await dialog.getByRole('button', { name: 'Enter', exact: true }).click();
  await dialog.getByRole('button', { name: '✓ Log set' }).click();
  await expect(dialog).toBeVisible();
  await expect(row.getByRole('button', { name: 'Log set' })).toBeVisible();

  // Typing reps and tapping Log set logs it.
  await pad(page, '8');
  await dialog.getByRole('button', { name: '✓ Log set' }).click();
  await expect(row.getByRole('button', { name: 'Un-log set' })).toBeVisible();
});

test('create an exercise from the picker with muscles and equipment', async ({ page }) => {
  await page.getByRole('button', { name: '＋ Add exercise' }).click();
  await page.getByRole('searchbox', { name: 'Search exercises' }).fill('cable fly');
  await page.getByRole('button', { name: '＋ Create “cable fly”' }).click();

  const sheet = page.getByRole('dialog', { name: 'New exercise' });
  await expect(sheet.getByRole('textbox', { name: 'Exercise name' })).toHaveValue('Cable Fly');

  await sheet.getByRole('button', { name: /^Main muscle/ }).click();
  await sheet.getByRole('button', { name: 'Chest', exact: true }).click();
  await sheet.getByRole('button', { name: 'Done' }).click();

  await sheet.getByRole('button', { name: /^Also works/ }).click();
  await expect(sheet.getByRole('button', { name: /^Chest/ })).toBeDisabled();
  await sheet.getByRole('button', { name: 'Front delts', exact: true }).click();
  await sheet.getByRole('button', { name: 'Done' }).click();

  await sheet.getByRole('button', { name: /^Equipment/ }).click();
  await sheet.getByRole('button', { name: 'Cable', exact: true }).click();
  await sheet.getByRole('button', { name: 'Done' }).click();

  await expect(sheet.getByRole('button', { name: /^Main muscle/ })).toContainText('Chest');
  await expect(sheet.getByRole('button', { name: /^Also works/ })).toContainText('Front delts');
  await sheet.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByRole('region', { name: 'Cable Fly' })).toBeVisible();

  // The picker now lists it with its muscle group and equipment.
  await page.getByRole('button', { name: '＋ Add exercise' }).click();
  await page.getByRole('searchbox', { name: 'Search exercises' }).fill('cable fly');
  await expect(page.getByRole('dialog', { name: 'Add exercise' }).getByText('Chest · Cable')).toBeVisible();
});

test('create an exercise without picking anything', async ({ page }) => {
  await page.getByRole('button', { name: '＋ Add exercise' }).click();
  await page.getByRole('searchbox', { name: 'Search exercises' }).fill('landmine press');
  await page.getByRole('button', { name: '＋ Create “landmine press”' }).click();
  await page.getByRole('dialog', { name: 'New exercise' }).getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('region', { name: 'Landmine Press' })).toBeVisible();
});
