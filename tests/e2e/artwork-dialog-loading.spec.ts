import { expect, test } from '@playwright/test';
import { installBackend, movie, apiOrigin } from './helpers/responsiveBackend';

for (const width of [390, 1440]) test(`source loading stays in its status row at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await installBackend(page);
  await page.route(`${apiOrigin}/api/streams/responsive-sources**`, async route => {
    await route.fulfill({ json: { events: [], done: false }, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Alex' }).click();
  await page.locator('.media-card').filter({ hasText: movie.name }).click();
  await page.getByRole('button', { name: 'Choose source', exact: true }).click();
  const spinner = page.locator('.source-discovery-spinner');
  await expect(spinner).toBeVisible();
  expect(await page.locator('.source-empty').evaluate(el => getComputedStyle(el, '::before').content)).toBe('none');
  for (let phase = 0; phase < 3; phase++) {
    const geometry = await spinner.evaluate(el => {
      const icon = el.getBoundingClientRect();
      const row = el.parentElement!.getBoundingClientRect();
      return { x: icon.x, y: icon.y, bottom: icon.bottom, left: row.left, top: row.top, rowBottom: row.bottom };
    });
    expect(geometry.x).toBeGreaterThanOrEqual(geometry.left - 6);
    expect(geometry.y).toBeGreaterThanOrEqual(geometry.top - 6);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.rowBottom + 6);
    await page.waitForTimeout(170);
  }
});

for (const width of [390, 1440]) test(`failed queue still uses shared landscape and dialogs dismiss at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await installBackend(page, { activity: true });
  await page.route('https://art.example/episode.svg*', route => route.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Alex' }).click();
  const card = page.locator('[data-focus-id="queue-0"]');
  await expect(card.locator('img')).toHaveAttribute('src', 'https://art.example/backdrop.svg');
  await expect(card.locator('img')).toBeVisible();
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  const dialog = page.locator('[data-focus-scope="modal"]');
  await expect(dialog).toBeVisible();
  await dialog.locator('h2').click();
  await expect(dialog).toBeVisible();
  await page.locator('.dialog-backdrop').click({ position: { x: 2, y: 2 } });
  await expect(dialog).toHaveCount(0);
});
