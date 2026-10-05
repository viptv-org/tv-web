import { expect, test } from '@playwright/test';
import { installBackend, installMediaStubs } from '../preview/backend';

test('same selector retains filters through player, titlebar and browser Back; another episode resets them', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const backend = await installBackend(page, { family: 'desk', sourcesDone: true, playbackUniqueIds: true });
  await installMediaStubs(page);
  await page.goto('/tv/title/series/tt-monster?desktop-shell');
  await page.locator('[data-focus-id="episode-0"]').click();
  await page.locator('.sources .vx-source-row').first().waitFor();
  await page.locator('[data-focus-id="source-provider"]').click();
  await page.getByRole('button', { name: 'LordStreams', exact: true }).click();
  await page.getByRole('group', { name: 'Quality', exact: true }).getByRole('button', { name: '1080p', exact: true }).click();
  for (const back of ['player', 'titlebar', 'browser']) {
    await page.locator('.sources .vx-source-row').first().click();
    await page.locator('.vx-player').waitFor();
    if (back === 'player') await page.locator('[data-focus-id="player-back"]').click();
    else if (back === 'titlebar') await page.locator('.desktop-titlebar').getByRole('button', { name: 'Back', exact: true }).click();
    else await page.goBack();
    await expect(page.locator('[data-focus-id="source-provider"]')).toContainText('LordStreams');
    await expect(page.getByRole('group', { name: 'Quality' }).getByRole('button', { name: '1080p', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.sources .vx-source-row')).toHaveCount(3);
  }
  await page.locator('.desktop-titlebar').getByRole('button', { name: 'Back', exact: true }).click();
  await page.locator('[data-focus-id="episode-1"]').click();
  await expect(page.locator('[data-focus-id="source-provider"]')).toContainText('All providers');
  await expect(page.getByRole('group', { name: 'Quality' }).getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(backend.errors).toEqual([]);
});

test('titlebar double-click uses player fullscreen and restores chrome on exit', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const backend = await installBackend(page, { family: 'desk', sourcesDone: true });
  await installMediaStubs(page);
  await page.goto('/tv/title/series/tt-monster?desktop-shell');
  await page.locator('[data-focus-id="episode-0"]').click();
  await page.locator('.sources .vx-source-row').first().click();
  await page.locator('.vx-player').waitFor();
  await page.locator('.desktop-titlebar .vx-titlebar-brand').dblclick();
  await expect(page.locator('.desktop-app-frame')).toHaveClass(/is-fullscreen/);
  await expect(page.locator('.desktop-titlebar')).toHaveCount(0);
  await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
  await expect(page.locator('.desktop-app-frame')).not.toHaveClass(/is-fullscreen/);
  await expect(page.locator('.desktop-titlebar')).toBeVisible();
  expect(backend.errors).toEqual([]);
});

test('a dismissed outage stays dismissed across repeated failures and resets after recovery', async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize({ width: 1440, height: 900 });
  await installBackend(page, { family: 'desk' });
  await page.goto('/tv/home?desktop-shell');
  await page.locator('.vx-home').waitFor();
  let reachable = false;
  await page.route('**/api/health', route => reachable ? route.fulfill({ contentType: 'application/json', body: '{"status":"ok"}' }) : route.abort('connectionrefused'));
  await page.route('**/api/profiles/1/favorites', route => route.abort('connectionrefused'));
  const nav = page.getByRole('navigation', { name: 'Main navigation', exact: true });
  await nav.getByRole('button', { name: 'My List', exact: true }).click();
  await expect(page.locator('.vx-banner')).toBeVisible();
  await page.locator('.vx-banner').getByRole('button', { name: 'Dismiss', exact: true }).click();
  await expect(page.locator('.vx-banner')).toHaveCount(0);
  await nav.getByRole('button', { name: 'Home', exact: true }).click();
  await nav.getByRole('button', { name: 'My List', exact: true }).click();
  await expect(page.locator('.vx-banner')).toHaveCount(0);
  // Advance only the retry timer; this scenario has no media clock.
  reachable = true;
  const recovered = page.waitForResponse(response => new URL(response.url()).pathname === '/api/health' && response.status() === 200);
  await page.clock.runFor(10001);
  await recovered;
  await page.waitForTimeout(100);
  reachable = false;
  await nav.getByRole('button', { name: 'Home', exact: true }).click();
  await nav.getByRole('button', { name: 'My List', exact: true }).click();
  await expect(page.locator('.vx-banner')).toBeVisible();
});
