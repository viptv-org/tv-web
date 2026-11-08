import { test, expect } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';

for (const entry of ['/tv/?platform=vizio', '/tv/?platform=tizen', '/tv/?platform=webos', '/tv/?layout=tv', '/tv/solid.html', '/tv/lightning.html']) {
  test(`startup skeleton survives a delayed entry module: ${entry}`, async ({ page, baseURL }) => {
    await installRemoteBackend(page, baseURL!);
    let release!: () => void;
    const held = new Promise<void>(resolve => release = resolve);
    await page.route('**/assets/*.js', async route => {
      await held;
      await route.continue().catch(() => {});
    });
    await page.goto(entry + (entry.includes('?') ? '&' : '?') + 'focusdebug=1', { waitUntil: 'commit' });
    const startup = page.locator('#solid-startup');
    await expect(startup).toBeVisible();
    const shape = startup.locator('rect').first();
    await expect(shape).toBeVisible();
    expect(await shape.evaluate(element => getComputedStyle(element).fill)).toBe('rgb(23, 23, 26)');
    expect(await shape.boundingBox()).toEqual({ x: 96, y: 470, width: 384, height: 216 });
    if (entry === '/tv/?platform=vizio') await page.screenshot({ path: '/tmp/viptv-78-startup.png' });
    release();
    await expect(page.locator('html')).toHaveAttribute('data-tv-ready', 'true');
    await expect(startup).toHaveCount(0);
    await expect(page.locator('canvas').first()).toBeVisible();
    if (entry === '/tv/?platform=vizio') {
      await page.screenshot({ path: '/tmp/viptv-78-home.png' });
      await page.waitForFunction(() => {
        let loaded = false;
        function visit(node: any) {
          if (node.isRenderable && node.props.w === 1920 && node.shader?.shaderKey?.startsWith('tvBillboard') && node.texture?.state === 'loaded') loaded = true;
          node.children?.forEach(visit);
        }
        visit((window as any).__viptvRenderer.stage.root);
        return loaded;
      });
      await page.screenshot({ path: '/tmp/viptv-78-home-settled.png' });
    }
  });
}

for (const resource of ['**/assets/*.css', '**/*.ssdf*.json', '**/api/bootstrap']) {
  test(`startup stays visible through delayed ${resource}`, async ({ page, baseURL }) => {
    await installRemoteBackend(page, baseURL!);
    let release!: () => void;
    let requested = false;
    const held = new Promise<void>(resolve => release = resolve);
    await page.route(resource, async route => {
      requested = true;
      await held;
      await route.fallback().catch(() => {});
    });
    await page.goto('/tv/solid.html?focusdebug=1', { waitUntil: 'commit' });
    await expect.poll(() => requested).toBe(true);
    await expect(page.locator('#solid-startup rect').first()).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-tv-startup', 'loading');
    expect(await page.locator('#solid-startup').evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
    release();
    await expect(page.locator('#solid-startup')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-tv-ready', 'true');
    expect(await page.evaluate(() => (window as any).__viptvRenderer.stage.renderer.getQuadCount())).toBeGreaterThan(1);
  });
}

for (const resource of ['**/assets/*.js', '**/assets/*.css', '**/*.ssdf*.json']) {
  test(`startup resource failure offers remote recovery: ${resource}`, async ({ page, baseURL }) => {
    await installRemoteBackend(page, baseURL!);
    let failing = true;
    let release!: () => void;
    const held = new Promise<void>(resolve => release = resolve);
    await page.route(resource, async route => {
      if (failing) { await held; await route.abort().catch(() => {}); }
      else await route.fallback();
    });
    await page.goto('/tv/solid.html', { waitUntil: 'commit' });
    await expect(page.locator('#solid-startup rect').first()).toBeVisible();
    release();
    await expect(page.getByText('VIPTV could not start.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeFocused();
    await expect(page.locator('#solid-startup svg')).toBeHidden();
    if (resource === '**/assets/*.js') await page.screenshot({ path: '/tmp/viptv-78-recovery.png' });
    failing = false;
    await page.keyboard.press('Enter');
    await expect(page.locator('#solid-startup')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-tv-ready', 'true');
  });
}

test('a stuck entry reaches remote recovery without losing the visible shell', async ({ page }) => {
  await page.clock.install();
  await page.route('**/assets/*.js', () => new Promise(() => {}));
  await page.goto('/tv/?platform=vizio', { waitUntil: 'commit' });
  await expect(page.locator('#solid-startup rect').first()).toBeVisible();
  await page.clock.fastForward(30000);
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeFocused();
});

for (const entry of ['/tv/', '/tv/?platform=vizio', '/tv/solid.html', '/tv/lightning.html']) {
  test(`every entry serves the SolidTV TV app: ${entry}`, async ({ page }) => {
    await page.goto(entry, { waitUntil: 'commit' });
    await expect(page.locator('#app')).toHaveCount(1);
    await expect(page.locator('#root')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-renderer', 'solid');
  });
}

for (const entry of ['/tv/?platform=vizio', '/tv/solid.html', '/tv/lightning.html']) {
  test(`browser Back preserves the document during delayed startup: ${entry}`, async ({ page }) => {
    await page.route('**/assets/*.js', () => new Promise(() => {}));
    await page.goto(entry, { waitUntil: 'commit' });
    await expect(page.locator('#solid-startup rect').first()).toBeVisible();
    await page.evaluate(() => history.back());
    await page.waitForTimeout(100);
    await expect(page.locator('#solid-startup rect').first()).toBeVisible();
    await expect(page).toHaveURL(new RegExp(entry.replace(/[?]/g, '\\?') + '$'));
  });
}

for (const entry of ['/tv/solid.html?platform=vizio', '/tv/lightning.html?platform=vizio']) {
  test(`browser Back leaves real playback inside the TV document: ${entry}`, async ({ page, baseURL }) => {
    const fixture = await installRemoteBackend(page, baseURL!, { media: true });
    await page.goto(entry);
    await expect(page.locator('#solid-startup')).toHaveCount(0);
    const initialHistory = await page.evaluate(() => history.length);
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-tv-sources', '8');
    await expect(page.locator('html')).toHaveAttribute('data-tv-ready', 'true');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.locator('video').evaluate(video => (video as HTMLVideoElement).currentTime)).toBeGreaterThan(0.2);
    await page.evaluate(() => history.back()); // Hide controls.
    await page.evaluate(() => history.back()); // Leave playback.
    await expect(page.locator('html')).toHaveAttribute('data-tv-screen', 'home');
    await expect.poll(() => fixture.requests.some(request => request.path === '/api/playback/fixture-playback' && request.method === 'DELETE')).toBe(true);
    await expect(page.locator('canvas').first()).toBeVisible();
    await expect(page.locator('#solid-startup')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(entry.replace(/[?]/g, '\\?') + '$'));
    expect(await page.evaluate(() => history.length)).toBe(initialHistory);
    await page.evaluate(() => history.back());
    await expect(page.locator('html')).toHaveAttribute('data-tv-focus', /^nav:/);
    expect(await page.evaluate(() => history.length)).toBe(initialHistory);
  });
}
