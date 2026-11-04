import { test, expect } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';

for (const target of ['discover', 'detail', 'live']) {
  test(`Back abandons delayed ${target} and rejects its late response`, async ({ page, baseURL }) => {
    await installRemoteBackend(page, baseURL!);
    await page.goto('/tv/?platform=vizio&focusdebug=1');
    await expect(page.locator('#solid-startup')).toHaveCount(0);
    let release!: () => void;
    let requested = false;
    const held = new Promise<void>(resolve => release = resolve);
    const path = target === 'discover' ? '**/api/discover?**' : target === 'detail' ? '**/api/meta/**' : '**/live/channels?**';
    await page.route(path, async route => {
      requested = true;
      await held;
      await route.fallback().catch(() => {});
    });
    if (target === 'detail') {
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
    } else {
      await page.keyboard.press('ArrowUp');
      for (let i = 0; i < (target === 'live' ? 3 : 1); i++) await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');
    }
    await expect.poll(() => requested).toBe(true);
    await expect(page.locator('html')).toHaveAttribute('data-tv-ready', 'false');
    await expect(page.locator('#solid-startup')).toHaveCount(0);
    await page.keyboard.press('Escape');
    if (target !== 'detail') {
      await expect(page.locator('html')).toHaveAttribute('data-tv-focus', /^nav:/);
      for (let i = 0; i < (target === 'live' ? 3 : 1); i++) await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('Enter');
    }
    await expect(page.locator('html')).toHaveAttribute('data-tv-screen', 'home');
    release();
    await page.waitForTimeout(200);
    await expect(page.locator('html')).toHaveAttribute('data-tv-screen', 'home');
    await expect(page.locator('html')).toHaveAttribute('data-tv-ready', 'true');
    await expect(page.locator('canvas').first()).toBeVisible();
  });
}

for (const failure of ['stalled', 'rejected']) {
  test(`initial playback ${failure} remains actionable and recovers with real media`, async ({ page, baseURL }) => {
    const fixture = await installRemoteBackend(page, baseURL!, { media: true });
    let release!: () => void;
    let attempts = 0;
    const held = new Promise<void>(resolve => release = resolve);
    await page.route('**/api/playback', async route => {
      if (route.request().method() !== 'POST') return route.fallback();
      attempts++;
      if (attempts !== 1) return route.fallback();
      if (failure === 'stalled') {
        await held;
        await route.fallback().catch(() => {});
      } else await route.fulfill({ status: 503, json: { error: 'Fixture capacity unavailable.', error_code: 'gateway_capacity' } });
    });
    await page.goto('/tv/?platform=vizio&focusdebug=1');
    await expect(page.locator('#solid-startup')).toHaveCount(0);
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-tv-sources', '8');
    await expect(page.locator('html')).toHaveAttribute('data-tv-ready', 'true');
    await page.keyboard.press('Enter');
    await expect.poll(() => attempts).toBe(1);
    await expect(page.locator('#solid-startup')).toHaveCount(0);
    if (failure === 'stalled') {
      await expect(page.locator('html')).toHaveAttribute('data-tv-overlay', 'sources');
      await page.keyboard.press('Escape');
      await expect(page.locator('html')).toHaveAttribute('data-tv-screen', 'home');
      release();
      await page.waitForTimeout(100);
      await expect(page.locator('html')).toHaveAttribute('data-tv-screen', 'home');
      expect(await page.locator('video').evaluate(video => (video as HTMLVideoElement).paused)).toBe(true);
      expect(fixture.requests.some(request => request.path.endsWith('/first-frame'))).toBe(false);
    } else {
      await expect(page.locator('html')).toHaveAttribute('data-tv-ready', 'true');
      await expect.poll(() => page.evaluate(() => {
        const text: string[] = [];
        function visit(node: any) { if (node.isRenderable && node.viptvText) text.push(node.viptvText); node.children?.forEach(visit); }
        visit((window as any).__viptvRenderer.stage.root);
        return text;
      })).toContain('Couldn’t connect. Try again.');
    }
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-tv-overlay', 'sources');
    await expect(page.locator('html')).toHaveAttribute('data-tv-ready', 'true');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.locator('video').evaluate(video => (video as HTMLVideoElement).currentTime)).toBeGreaterThan(0.2);
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'MediaPause', bubbles: true })));
    await expect.poll(() => page.locator('video').evaluate(video => (video as HTMLVideoElement).paused)).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'MediaPlay', bubbles: true })));
    await expect.poll(() => page.locator('video').evaluate(video => (video as HTMLVideoElement).paused)).toBe(false);
    await expect(page.locator('#solid-startup')).toHaveCount(0);
  });
}
