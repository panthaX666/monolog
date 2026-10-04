import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { addExercise, logSets } from './helpers';

// Accessibility: axe (WCAG 2 A/AA) on every main screen, with some data in place.

async function check(page: Page, name: string) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const problems = result.violations.map(
    (v) => `${name}: ${v.id} (${v.impact}) ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).slice(0, 5).join('\n  ')}`,
  );
  expect.soft(problems, problems.join('\n')).toEqual([]);
}

const tab = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name });

test('main screens have no accessibility problems', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await check(page, 'Home (empty)');

  await page.getByRole('button', { name: '▶ Start workout' }).click();
  await check(page, 'Workout (empty)');
  await addExercise(page, 'bench', 'Bench Press');
  await logSets(page, 'Bench Press', [['60', '8']]);
  await check(page, 'Workout + number pad');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: '＋ Add exercise' }).click();
  await check(page, 'Exercise picker');
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await check(page, 'Exercise picker (select)');
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  await page.getByRole('button', { name: 'Finish workout' }).click();
  await check(page, 'Finish dialog');
  await page.getByRole('dialog', { name: 'Finish workout' }).getByRole('button', { name: 'Finish', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workout complete' })).toBeVisible();
  await check(page, 'Summary');
  await page.getByRole('button', { name: 'Done' }).click();

  await check(page, 'Home (with a workout)');
  await tab(page, 'History').click();
  await check(page, 'History');
  await tab(page, 'Exercises').click();
  await check(page, 'Exercises');
  await page.getByRole('button', { name: 'Bench Press', exact: true }).click();
  await check(page, 'Exercise page');
  await tab(page, 'Body').click();
  await check(page, 'Body');
  await page.goto('./#/settings');
  await check(page, 'Settings');
});
