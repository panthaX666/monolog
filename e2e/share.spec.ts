import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { addExercise, logSets } from './helpers';

// Share a workout: the summary's Share button produces a 1080×1350 PNG. File sharing is turned off
// here so the image downloads instead of opening the system share menu.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true });
  });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
});

test('share a finished workout as an image', async ({ page }, info) => {
  await page.getByRole('button', { name: '▶ Start workout' }).click();
  await addExercise(page, 'bench', 'Bench Press');
  await logSets(page, 'Bench Press', [
    ['60', '8'],
    ['62.5', '6'],
  ]);
  await page.keyboard.press('Escape');
  await addExercise(page, 'pushdown', 'Rope Tricep Pushdown');
  await logSets(page, 'Rope Tricep Pushdown', [['45', '10']]);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Finish workout' }).click();
  await page.getByRole('dialog', { name: 'Finish workout' }).getByRole('button', { name: 'Finish', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workout complete' })).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^monolog-\d{4}-\d{2}-\d{2}\.png$/);

  const path = info.outputPath('share.png');
  await file.saveAs(path);
  const png = readFileSync(path);
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.readUInt32BE(16)).toBe(1080); // width
  expect(png.readUInt32BE(20)).toBe(1350); // height
  await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeEnabled();
});
