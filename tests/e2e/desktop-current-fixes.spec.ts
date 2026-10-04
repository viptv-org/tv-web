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
