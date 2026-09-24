import { expect, test, type Page } from '@playwright/test';
import { apiOrigin, installBackend, movie } from './helpers/responsiveBackend';

/*
 * Dialogs family (components.md §8 / §9, PhStates / DeskStates / TvStates):
 * toast placement and timing, the backend banner, and the generic modal's
 * shapes — phone bottom sheet, desktop dialog centred on the body row (the
 * rail stays bright), TV right panel with focus in and back out.
 */

const viewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;
const cors = { 'access-control-allow-origin': 'http://127.0.0.1:4173' };
const answer = (body: unknown, status = 200) => ({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });

async function openTitle(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.goto('/');
  await page.getByRole('button', { name: 'Alex' }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await page.goto(`/tv/title/${movie.type}/${movie.id}`);
  await expect(page.locator('[data-focus-id="detail-save"]')).toBeVisible();
}

for (const viewport of viewports) {
  test(`responsive ${viewport.name}: notices and error toasts sit where the design puts them`, async ({ page }) => {
    test.skip(test.info().project.name !== 'vizio', 'one browser project runs the responsive layouts');
    await installBackend(page);
    let failSave = false;
    await page.route(`${apiOrigin}/api/profiles/1/favorites/toggle`, route => route.fulfill(failSave
      ? answer({ error: 'Could not save your profile. Please try again.' }, 400)
      : answer({ saved: true })));
    await openTitle(page, viewport);

    await page.locator('[data-focus-id="detail-save"]').click();
    const notice = page.getByRole('status').filter({ hasText: 'Added to My List' });
    await expect(notice).toBeVisible();
    const box = (await notice.boundingBox())!;
    // Phone: above the floating nav (bottom 116); desktop: bottom-centre 24 from the window edge.
    expect(Math.round(box.y + box.height)).toBe(viewport.height - (viewport.width < 600 ? 116 : 24));
    expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
    await expect(page.getByRole('alert')).toHaveCount(0);

    // A failed save: an error toast with Dismiss that clears itself after 4 s.
    failSave = true;
    await page.locator('[data-focus-id="detail-save"]').click();
    const error = page.getByRole('alert');
    await expect(error).toBeVisible();
    await expect(error.getByRole('button', { name: 'Dismiss', exact: true })).toBeVisible();
    await expect(error).toHaveCount(0, { timeout: 6000 });
  });

  test(`responsive ${viewport.name}: the backend banner explains the outage and dismisses`, async ({ page }) => {
    test.skip(test.info().project.name !== 'vizio', 'one browser project runs the responsive layouts');
    await installBackend(page);
    await openTitle(page, viewport);
    await page.route(`${apiOrigin}/api/**`, route => route.abort('connectionrefused'));
    await page.locator('[data-focus-id="detail-save"]').click();
    const banner = page.getByRole('alert').filter({ hasText: 'Can’t reach the backend' });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Retrying every 10 seconds');
    await expect(banner).toContainText(/Backend unreachable since|requests failed since/);
    const box = (await banner.boundingBox())!;
    expect(Math.round(box.y + box.height)).toBe(viewport.height - (viewport.width < 600 ? 116 : 24));
    expect(box.width).toBeLessThanOrEqual(viewport.width < 600 ? 358 : 520);
    await banner.getByRole('button', { name: 'Dismiss', exact: true }).click();
    await expect(banner).toHaveCount(0);
  });

  test(`responsive ${viewport.name}: a dialog is a bottom sheet / a dialog centred on the body row`, async ({ page }) => {
    test.skip(test.info().project.name !== 'vizio', 'one browser project runs the responsive layouts');
    await installBackend(page, { activity: true });
    // Removing from Continue Watching answers; everything else keeps the fixture.
    await page.route(`${apiOrigin}/api/profiles/1/continue/**`, route => route.request().method() === 'GET'
      ? route.fallback()
      : route.fulfill(answer({ ok: true })));
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByRole('button', { name: 'Alex' }).click();
    const card = page.locator('[data-focus-id="queue-0"]');
    await card.click({ button: 'right' });
    await page.locator('[data-focus-scope="modal"]').getByRole('button', { name: 'Remove from Continue Watching', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Removed from Continue Watching' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
    const box = (await dialog.boundingBox())!;
    if (viewport.width < 600) {
      // Bottom sheet: full width, flush with the bottom edge, over the nav.
      expect(Math.round(box.x)).toBe(0);
      expect(Math.round(box.width)).toBe(viewport.width);
      expect(Math.round(box.y + box.height)).toBe(viewport.height);
    } else {
      // 460 dialog centred on the body row; the scrim leaves the 84 rail bright.
      const layer = (await page.locator('.dialog-backdrop').boundingBox())!;
      expect(Math.round(layer.x)).toBe(84);
      expect(Math.round(box.width)).toBe(460);
      expect(Math.abs(box.x + box.width / 2 - (84 + viewport.width) / 2)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(1);
      await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
}

/** TV (Tizen query) on the shared fixture backend: Who's watching → Home with Continue Watching. */
async function enterTvHome(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await installBackend(page, { activity: true });
  await page.goto('/?platform=tizen');
  await page.getByRole('button', { name: 'Alex' }).press('Enter');
  const card = page.locator('[data-focus-id="queue-0"]');
  await expect(card).toBeVisible();
  await card.focus();
  return { card, errors };
}

/** TV title menu → Mark watched (a progress correction the test can fail). */
async function markWatched(page: Page) {
  await page.keyboard.press('ContextMenu');
  const item = page.locator('[data-focus-scope="modal"]').getByRole('button', { name: /^Mark (un)?watched$/ });
  await item.focus();
  await page.keyboard.press('Enter');
}

test('TV: the error toast sits top-centre with Dismiss focused, and focus returns after', async ({ page }) => {
  test.skip(test.info().project.name !== 'tizen', 'the remote flow runs once');
  const { card, errors } = await enterTvHome(page);
  await page.route(`${apiOrigin}/api/profiles/1/progress**`, route => route.request().method() === 'GET'
    ? route.fallback()
    : route.fulfill(answer({ error: 'Could not save your profile. Please try again.' }, 400)));
  await markWatched(page);
  const toast = page.getByRole('alert');
  await expect(toast).toBeVisible();
  const box = (await toast.boundingBox())!;
  expect(Math.round(box.y)).toBe(54);
  expect(Math.abs(box.x + box.width / 2 - 960)).toBeLessThanOrEqual(1);
  const dismiss = toast.getByRole('button', { name: 'Dismiss', exact: true });
  await expect(dismiss).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(toast).toHaveCount(0);
  await expect(card).toBeFocused();
  expect(errors).toEqual([]);
});

test('TV: the backend panel takes focus while it shows and gives it back', async ({ page }) => {
  test.skip(test.info().project.name !== 'tizen', 'the remote flow runs once');
  const { card, errors } = await enterTvHome(page);
  await page.route(`${apiOrigin}/api/**`, route => route.abort('connectionrefused'));
  await markWatched(page);
  const panel = page.getByRole('alert').filter({ hasText: 'Can’t reach the backend' });
  await expect(panel).toBeVisible();
  const box = (await panel.boundingBox())!;
  expect(Math.round(box.width)).toBe(980);
  expect(Math.abs(box.x + box.width / 2 - 960)).toBeLessThanOrEqual(1);
  await expect(panel.getByRole('button', { name: 'Dismiss', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(panel).toHaveCount(0);
  await expect(card).toBeFocused();
  expect(errors).toEqual([]);
});

test('TV: the title menu is a right panel with its legend; BACK closes it and restores focus', async ({ page }) => {
  test.skip(test.info().project.name !== 'tizen', 'the remote flow runs once');
  const { card, errors } = await enterTvHome(page);
  await page.keyboard.press('ContextMenu');
  const panel = page.locator('[data-focus-scope="modal"]');
  await expect(panel).toBeVisible();
  const box = (await panel.boundingBox())!;
  expect(Math.round(box.x + box.width)).toBe(1920);
  expect(Math.round(box.width)).toBe(820);
  await expect(page.locator('[data-focus-id="modal-0"]')).toBeFocused();
  await expect(panel.locator('.vx-legend')).toContainText('Select');
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(card).toBeFocused();
  expect(errors).toEqual([]);
});
