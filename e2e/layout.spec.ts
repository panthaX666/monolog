import { expect, test, type Locator, type Page } from '@playwright/test';

// The bottom action buttons must always be fully on screen without scrolling the page,
// on small and large phones (regression: "Add exercise" was pushed under the nav bar).

const SIZES = [
  { width: 320, height: 568 }, // very small
  { width: 360, height: 640 },
  { width: 393, height: 760 }, // tall phone minus system bars
  { width: 412, height: 915 },
];

async function fullyVisible(page: Page, target: Locator) {
  const box = await target.boundingBox();
  const vh = page.viewportSize()!.height;
  expect(box, 'element should be rendered').not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(vh);
  // The page itself never scrolls; only the inner content area does.
  const scroll = await page.evaluate(() => ({
    sh: document.scrollingElement!.scrollHeight,
    ch: document.scrollingElement!.clientHeight,
  }));
  expect(scroll.sh).toBeLessThanOrEqual(scroll.ch);
}

for (const size of SIZES) {
  test(`bottom buttons fit at ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('./');
    await fullyVisible(page, page.getByRole('button', { name: '▶ Start workout' }));
    await fullyVisible(page, page.getByRole('navigation', { name: 'Main' }));

    await page.getByRole('button', { name: '▶ Start workout' }).click();
    const add = page.getByRole('button', { name: '＋ Add exercise' });
    const finish = page.getByRole('button', { name: 'Finish workout' });
    const discard = page.getByRole('button', { name: 'Discard workout' });
    await fullyVisible(page, add); // empty workout
    await fullyVisible(page, finish);
    await fullyVisible(page, discard);
    // Discard sits just above Finish, with breathing room, and below Add exercise.
    const [a, d, f] = [(await add.boundingBox())!, (await discard.boundingBox())!, (await finish.boundingBox())!];
    expect(d.y).toBeGreaterThan(a.y + a.height + 16);
    expect(f.y - (d.y + d.height)).toBeGreaterThanOrEqual(16);
    expect(f.y - (d.y + d.height)).toBeLessThanOrEqual(80);

    for (const [q, name] of [
      ['bench press', 'Bench Press'],
      ['squat', 'Squat'],
      ['lat pulldown', 'Lat Pulldown'],
    ]) {
      await add.click();
      await page.getByRole('searchbox', { name: 'Search exercises' }).fill(q!);
      await page.getByRole('dialog', { name: 'Add exercise' }).getByRole('button', { name, exact: true }).click();
    }
    await fullyVisible(page, finish); // long workout: list scrolls, Finish stays put
    await add.scrollIntoViewIfNeeded();
    await fullyVisible(page, add);
    await fullyVisible(page, page.getByRole('button', { name: 'Back to Home' }));
  });
}

// Nothing sticks out of its card sideways (regression: the selected check-in day overflowed).
for (const size of [SIZES[0]!, SIZES[3]!]) {
  test(`settings controls fit inside their cards at ${size.width}px`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('./#/settings');
    await expect(page.getByRole('group', { name: 'Weekly check-in day' })).toBeVisible();
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll('.card')].flatMap((card) => {
        const c = card.getBoundingClientRect();
        return [...card.querySelectorAll('button, input, .seg')]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && (r.right > c.right + 0.5 || r.left < c.left - 0.5);
          })
          .map((el) => el.textContent?.trim() || el.getAttribute('aria-label') || el.className);
      }),
    );
    expect(overflow).toEqual([]);
  });
}
