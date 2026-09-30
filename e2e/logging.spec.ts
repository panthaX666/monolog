import { expect, test, type Page } from '@playwright/test';

// F1 end-to-end: start → add exercise → log sets → finish → summary → second workout sets a record.

async function addExercise(page: Page, search: string, name: string) {
  await page.getByRole('button', { name: '＋ Add exercise' }).click();
  await page.getByRole('searchbox', { name: 'Search exercises' }).fill(search);
  await page.getByRole('dialog', { name: 'Add exercise' }).getByRole('button', { name, exact: true }).click();
}

async function typeOnPad(page: Page, keys: string) {
  const pad = page.getByRole('dialog', { name: 'Number pad' });
  for (const k of keys) await pad.getByRole('button', { name: k, exact: true }).click();
}

function card(page: Page, name: string) {
  return page.getByRole('region', { name });
}

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

test('log a first workout, finish, then beat it for a rep record', async ({ page }) => {
  // ── Workout 1 ──
  await page.getByRole('button', { name: '▶ Start workout' }).click();
  await expect(page.getByText('Empty workout')).toBeVisible();
  await addExercise(page, 'rope push', 'Rope Tricep Pushdown');

  const pushdown = card(page, 'Rope Tricep Pushdown');
  await expect(pushdown.getByText('First time — no history yet')).toBeVisible();

  // Blank first set: ✓ opens the pad instead of logging.
  await pushdown.getByRole('button', { name: 'Log set' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Number pad' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Number pad' }).getByText('KG').click();
  await typeOnPad(page, '45');
  await page.getByRole('button', { name: 'Next: reps →' }).click();
  await typeOnPad(page, '10');
  await expect(page.getByTestId('pad-weight')).toHaveText('45.0');
  await expect(page.getByTestId('pad-reps')).toHaveText('10');
  await page.getByRole('button', { name: '✓ Log set' }).click();

  // Set 1 logged; set 2 appended, pre-filled 45 × 10.
  const rows = pushdown.getByTestId('set-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).getByRole('button', { name: 'Un-log set' })).toBeVisible();
  await expect(rows.nth(1).getByRole('button', { name: 'Weight' })).toHaveText('45.0');
  await rows.nth(1).getByRole('button', { name: 'Log set' }).click();
  await expect(rows).toHaveCount(3);
  await expect(page.locator('.celebrate')).toHaveCount(0); // matching isn't a record

  // Delete the extra pre-filled set, undo, delete again.
  await rows.nth(2).getByRole('button', { name: 'Delete set' }).click();
  await expect(rows).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(rows).toHaveCount(3);

  // Rest timer starts on tap.
  await page.getByTestId('rest-chip').click();
  await expect(page.getByTestId('rest-chip')).toHaveClass(/running/);
  await page.getByTestId('rest-chip').click();

  // Finish: the un-logged set is discarded.
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await expect(page.getByText('1 un-logged set will be removed.')).toBeVisible();
  await page.getByRole('dialog', { name: 'Finish workout' }).getByRole('button', { name: 'Finish', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workout complete' })).toBeVisible();
  await expect(page.getByText('45.0×10 · 45.0×10')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('streak-count')).toHaveText('1');

  // ── Workout 2: one more rep = record ──
  await page.getByRole('button', { name: '▶ Start workout' }).click();
  await addExercise(page, 'pushdown', 'Rope Tricep Pushdown');
  const again = card(page, 'Rope Tricep Pushdown');
  await expect(again.getByText(/^Last · .*45\.0×10 · 45\.0×10/)).toBeVisible();
  const rows2 = again.getByTestId('set-row');
  await expect(rows2).toHaveCount(2);
  await expect(rows2.nth(0).getByRole('button', { name: 'Reps' })).toHaveClass(/ghost/);

  await rows2.nth(0).getByRole('button', { name: 'Reps' }).click();
  await typeOnPad(page, '11');
  await page.getByRole('button', { name: '✓ Log set' }).click();

  const cel = page.getByRole('alertdialog', { name: 'New record' });
  await expect(cel).toBeVisible();
  await expect(cel.getByText('NEW REP RECORD')).toBeVisible();
  await expect(cel.getByText('+1 rep')).toBeVisible();
  await expect(cel.getByText('45.0 × 10')).toBeVisible();
  await expect(cel.getByText('45.0 × 11')).toBeVisible();
  await cel.getByRole('button', { name: 'OK' }).click();
  await expect(cel).toHaveCount(0);

  // Gold ✓ on the record set, gold records tile.
  await expect(rows2.nth(0)).toHaveClass(/rec/);
  await expect(again.getByRole('button', { name: 'Records for Rope Tricep Pushdown' })).toHaveClass(/gold/);
  await again.getByRole('button', { name: 'Records for Rope Tricep Pushdown' }).click();
  await expect(page.getByText('11 @ 45.0 kg')).toBeVisible();
});

test('set types, notes and survive a reload mid-workout', async ({ page }) => {
  await page.getByRole('button', { name: '▶ Start workout' }).click();
  await addExercise(page, 'bench', 'Bench Press');
  const bench = card(page, 'Bench Press');
  const row = bench.getByTestId('set-row').first();

  await row.getByRole('button', { name: 'Weight' }).click();
  await typeOnPad(page, '60');
  await page.getByRole('button', { name: 'Next: reps →' }).click();
  await typeOnPad(page, '8');
  await page.getByRole('dialog', { name: 'Number pad' }).press('Escape');

  await row.getByRole('button', { name: /Set 1 type/ }).click();
  await page.getByRole('button', { name: 'Warm-up' }).click();
  await expect(row.getByRole('button', { name: /Set W type/ })).toBeVisible();

  await row.getByRole('button', { name: 'Note' }).click();
  await bench.getByPlaceholder('Note for this set').fill('felt easy');
  await bench.getByPlaceholder('Note for this set').press('Enter');
  await expect(bench.getByText('“felt easy”')).toBeVisible();
  await row.getByRole('button', { name: 'Log set' }).click();
  await expect(row.getByRole('button', { name: 'Un-log set' })).toBeVisible(); // saved

  // Crash-safe: reload and everything is still there.
  await page.reload();
  await expect(page.getByRole('region', { name: 'Bench Press' })).toBeVisible();
  const again = card(page, 'Bench Press').getByTestId('set-row').first();
  await expect(again.getByRole('button', { name: 'Un-log set' })).toBeVisible();
  await expect(again.getByRole('button', { name: /Set W type/ })).toBeVisible();
  await expect(card(page, 'Bench Press').getByText('“felt easy”')).toBeVisible();
});

test('rest day and settings', async ({ page }) => {
  await page.getByRole('button', { name: 'Rest day' }).click();
  await page.getByRole('button', { name: /^Log rest day · Today/ }).click();
  await expect(page.getByTestId('streak-count')).toHaveText('1');

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('switch', { name: 'Auto-start rest timer' }).click();
  await expect(page.getByRole('switch', { name: 'Auto-start rest timer' })).toHaveAttribute('aria-checked', 'true');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save backup' }).click();
  expect((await download).suggestedFilename()).toMatch(/^monolog-backup-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(page.getByText('Last backup: never')).toHaveCount(0);
});
