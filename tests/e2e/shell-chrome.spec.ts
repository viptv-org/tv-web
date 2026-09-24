/*
 * App chrome (shell family) on every platform, against the design references:
 * phone bottom nav (Main, CmpPhone2), desktop / web rail (DeskHome, WebHome,
 * CmpDesk2) and the desktop app title bar (DeskHome, CmpDesk2 "Title bar").
 * The TV rail + menu (TvHome, TvMenu, CmpTv2) is covered in tv-shell-media.spec.ts.
 */
import { expect, test, type Page } from '@playwright/test';
import { installBackend } from './helpers/responsiveBackend';

const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!;

test('phone: floating nav with a separate Search button, tab screens only; Settings from the My List header', async ({ page }, info) => {
  test.skip(info.project.name !== 'vizio', 'one browser run covers the shared responsive chrome');
  await page.setViewportSize({ width: 390, height: 844 });
  await installBackend(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Alex' }).click();
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav).toBeVisible();
  const home = page.locator('[data-focus-id="nav-Home"]');
  await home.focus();
  await expect(home).toHaveAttribute('aria-current', 'page');
  await expect(home).toHaveCSS('background-color', 'rgb(244, 242, 238)');
  await expect(home).toHaveCSS('color', 'rgb(17, 17, 19)');
  await expect(home).toHaveCSS('box-shadow', 'none');
  await expect(page.locator('[data-focus-id="nav-Discover"]')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  const bar = await box(page, '.vx-phone-nav-bar');
  expect(bar).toMatchObject({ x: 16, height: 64 });
  expect(bar.y + bar.height).toBe(844 - 28);
  const search = await box(page, '[data-focus-id="nav-Search"]');
  expect(search).toMatchObject({ width: 64, height: 64 });
  expect(search.x + search.width).toBe(390 - 16);
  expect(search.x - (bar.x + bar.width)).toBe(10);
  await expect(page.locator('.vx-phone-nav-fade')).toHaveCSS('height', '150px');
  await expect(page.locator('[data-focus-id="nav-Settings"]')).toHaveCount(0);
  await page.locator('[data-focus-id="nav-My List"]').click();
  await page.locator('[data-focus-id="library-settings"]').click();
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  await expect(nav).toHaveCount(0);
  await page.goBack();
  await expect(nav).toBeVisible();
  await page.locator('[data-focus-id="nav-Search"]').click();
  await expect(page.locator('[data-focus-id="nav-Search"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.vx-phone-nav-tab[aria-current="page"]')).toHaveCount(0);
});

test('web: 84 rail with Search, On TV lit while Watch on TV is open, keyboard ring', async ({ page }, info) => {
  test.skip(info.project.name !== 'vizio', 'one browser run covers the shared responsive chrome');
  await page.setViewportSize({ width: 1440, height: 900 });
  await installBackend(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Alex' }).click();
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav).toBeVisible();
  const rail = await box(page, 'nav[aria-label="Main navigation"]');
  expect(rail).toMatchObject({ x: 0, y: 0, width: 84, height: 900 });
  const home = await box(page, '[data-focus-id="nav-Home"]');
  expect(home).toMatchObject({ x: 9.5, y: 16, width: 64, height: 58 }); // 84 rail incl. its 1px hairline, as in DeskHome.html
  for (const id of ['nav-Discover', 'nav-Live TV', 'nav-My List', 'nav-Search', 'responsive-cast', 'nav-Settings']) await expect(page.locator(`[data-focus-id="${id}"]`)).toBeVisible();
  await expect(page.locator('[data-focus-id="nav-Live TV"]')).toContainText('Live');
  const profile = await box(page, '[data-focus-id="responsive-profile"]');
  expect(profile).toMatchObject({ x: 21.5, width: 40, height: 40 });
  expect(profile.y + profile.height).toBe(900 - 18);
  await expect(page.locator('[data-focus-id="nav-Home"]')).toHaveCSS('background-color', 'rgb(33, 33, 36)');
  await expect(page.locator('.tv-screen')).toHaveCSS('background-color', 'rgb(11, 11, 12)');
  await page.keyboard.press('Tab');
  await page.locator('[data-focus-id="nav-Discover"]').focus();
  await expect(page.locator('[data-focus-id="nav-Discover"]')).toHaveCSS('box-shadow', 'rgb(11, 11, 12) 0px 0px 0px 2px, rgb(244, 242, 238) 0px 0px 0px 4px');
  await page.locator('[data-focus-id="responsive-cast"]').click();
  await expect(page.locator('[data-focus-id="responsive-cast"]')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-focus-id="responsive-cast"]')).toHaveCSS('background-color', 'rgb(33, 33, 36)');
  await page.getByRole('dialog', { name: 'Watch on TV' }).getByRole('button', { name: 'Close', exact: true }).last().click();
  await expect(page.locator('[data-focus-id="responsive-cast"]')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.vx-titlebar')).toHaveCount(0);
});

test('desktop app: 40 px title bar with Back / Forward, centred search and a pairing variant', async ({ page }, info) => {
  test.skip(info.project.name !== 'vizio', 'one browser run covers the shared responsive chrome');
  await page.setViewportSize({ width: 1440, height: 900 });
  await installBackend(page);
  await page.goto('/?desktop-shell');
  // Profiles: the pairing variant (wordmark + window controls only).
  await expect(page.getByRole('button', { name: 'Alex' })).toBeVisible();
  await expect(page.locator('.vx-titlebar')).toBeVisible();
  await expect(page.locator('.vx-titlebar [aria-label="Back"]')).toHaveCount(0);
  await expect(page.locator('.vx-titlebar-search')).toHaveCount(0);
  for (const name of ['Minimize', 'Maximize', 'Close']) await expect(page.locator(`.vx-titlebar [aria-label="${name}"]`)).toBeVisible();
  await page.getByRole('button', { name: 'Alex' }).click();
  const bar = await box(page, '.vx-titlebar');
  expect(bar.height).toBe(41);
  const field = await box(page, '.vx-titlebar-search');
  expect(field).toMatchObject({ width: 460, height: 30 });
  expect(Math.abs(field.x + field.width / 2 - 720)).toBeLessThanOrEqual(1);
  await expect(page.getByPlaceholder('Search movies and series')).toBeVisible();
  const rail = await box(page, 'nav[aria-label="Main navigation"]');
  expect(rail.y).toBe(bar.y + bar.height);
  await expect(page.locator('[data-focus-id="nav-Search"]')).toHaveCount(0);
  const forward = page.locator('.vx-titlebar [aria-label="Forward"]');
  const back = page.locator('.vx-titlebar [aria-label="Back"]');
  await expect(forward).toBeDisabled();
  await page.locator('[data-focus-id="nav-Discover"]').click();
  await expect(back).toBeEnabled();
  await back.click();
  await expect(page.locator('[data-focus-id="nav-Home"]')).toHaveAttribute('aria-current', 'page');
  await expect(forward).toBeEnabled();
  await forward.click();
  await expect(page.locator('[data-focus-id="nav-Discover"]')).toHaveAttribute('aria-current', 'page');
  await expect(forward).toBeDisabled();
  // Clear button appears with text.
  const input = page.getByPlaceholder('Search movies and series');
  await input.fill('dune');
  await expect(page.getByRole('button', { name: 'Clear search' })).toBeVisible();
  await expect(page.locator('.vx-titlebar-search')).toHaveCSS('background-color', 'rgb(33, 33, 36)');
});
