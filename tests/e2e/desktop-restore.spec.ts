import { expect, test, type Page } from '@playwright/test';
import { installBackend, installMediaStubs } from '../preview/backend';

async function recoveryDialog(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  const backend = await installBackend(page, { family: 'desk', sourcesDone: true, playbackUniqueIds: true });
  await installMediaStubs(page, { failAfter: 1 });
  // Fail the controlled HTML edge without an independent MSE decoder succeeding.
  await page.addInitScript(() => Object.defineProperty(window, 'MediaSource', { configurable: true, value: undefined }));
  await page.goto('/tv/title/series/tt-monster?desktop-shell');
  await page.locator('[data-focus-id="episode-0"]').click();
  await page.locator('[data-focus-id="source-0"]').click();
  await page.getByRole('button', { name: 'Next episode', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Playback could not be restored', exact: true });
  await expect(dialog).toBeVisible();
  await expect(page.locator('.vx-toast--error')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Retry', exact: true }).locator('svg')).toHaveCount(1);
  await expect(page.locator('.rp-controls, .player-controls')).toHaveCount(0);
  return { backend, dialog, starts: () => backend.requests.filter(r => r.path === '/api/v2/playback' && r.method === 'POST') };
}

for (const action of ['Retry', 'Choose source', 'Back'] as const) {
  test(`desktop failed restoration retains the outgoing intent for ${action}`, async ({ page }) => {
    test.skip(test.info().project.name !== 'vizio', 'responsive desktop flow is shared across projects');
    const { backend, dialog, starts } = await recoveryDialog(page);
    const original = starts()[0].body;
    if (!original || typeof original !== 'object' || !('stream_id' in original))
      throw new Error('The initial fixture playback must carry its selected source');
    expect(starts()).toHaveLength(2);
    await dialog.getByRole('button', { name: action, exact: true }).click();
    if (action === 'Retry') {
      await expect.poll(() => starts().length).toBe(3);
      expect(starts()[2].body).toMatchObject({ stream_id: original.stream_id, position: 768 });
      await expect(page.getByRole('button', { name: 'Choose another source', exact: true })).toBeVisible();
    } else {
      await expect(page.locator('[data-focus-id="source-0"]')).toBeVisible();
      await expect(page.locator('[data-focus-id="next"]')).toHaveCount(0);
      expect(starts()).toHaveLength(2);
    }
    expect(backend.errors).toEqual([]);
  });
}
