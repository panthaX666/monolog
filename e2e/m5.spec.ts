import { expect, test } from '@playwright/test';

// M5: pick several exercises at once, reorder a workout, crash screen with backup.

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
});

const cardNames = (page: import('@playwright/test').Page) =>
  page.locator('.workout-scroll section[aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));

test('pick several exercises, then reorder them', async ({ page }) => {
  await page.getByRole('button', { name: '▶ Start workout' }).click();
  await page.getByRole('button', { name: '＋ Add exercise' }).click();
  const picker = page.getByRole('dialog', { name: 'Add exercise' });

  // Hold one exercise to start selecting, then tap two more.
  await picker.getByRole('searchbox', { name: 'Search exercises' }).fill('press');
  const bench = picker.getByRole('button', { name: 'Bench Press', exact: true });
  await bench.hover();
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  await expect(picker.getByText('1 selected')).toBeVisible();
  await expect(bench).toHaveAttribute('aria-pressed', 'true');

  await picker.getByRole('searchbox', { name: 'Search exercises' }).fill('lat');
  await picker.getByRole('button', { name: 'Lat Pulldown', exact: true }).click();
  await picker.getByRole('searchbox', { name: 'Search exercises' }).fill('plank');
  await picker.getByRole('button', { name: 'Plank', exact: true }).click();
  await picker.getByRole('button', { name: 'Add 3 exercises' }).click();

  await expect(page.getByRole('region', { name: 'Plank' })).toBeVisible();
  expect(await cardNames(page)).toEqual(['Bench Press', 'Lat Pulldown', 'Plank']);

  // Reorder: Plank to the top with the arrows.
  await page.getByRole('region', { name: 'Plank' }).getByRole('button', { name: /options/i }).click();
  await page.getByRole('button', { name: '⇅ Reorder exercises' }).click();
  const sheet = page.getByRole('dialog', { name: 'Reorder exercises' });
  await sheet.getByRole('button', { name: 'Move Plank up' }).click();
  await sheet.getByRole('button', { name: 'Move Plank up' }).click();
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  await expect.poll(() => cardNames(page)).toEqual(['Plank', 'Bench Press', 'Lat Pulldown']);

  // Drag: Plank's handle down two rows puts it last.
  await page.getByRole('region', { name: 'Plank' }).getByRole('button', { name: /options/i }).click();
  await page.getByRole('button', { name: '⇅ Reorder exercises' }).click();
  const handle = sheet.locator('.reorder-row').first().locator('.reorder-handle');
  await handle.hover(); // waits for the sheet to finish sliding up
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + i * 13);
  await page.mouse.up();
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect.poll(() => cardNames(page)).toEqual(['Bench Press', 'Lat Pulldown', 'Plank']);

  // Order survives a reload.
  await page.reload();
  await expect(page.getByRole('region', { name: 'Plank' })).toBeVisible();
  expect(await cardNames(page)).toEqual(['Bench Press', 'Lat Pulldown', 'Plank']);
});

test('crash screen offers a backup and a way home', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('monolog.crashTest', '1'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Something broke' })).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save backup' }).click();
  expect((await download).suggestedFilename()).toMatch(/^monolog-backup-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(page.getByText(/Saved monolog-backup-/)).toBeVisible();

  await page.evaluate(() => localStorage.removeItem('monolog.crashTest'));
  await page.getByRole('button', { name: 'Go Home' }).click();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
});
