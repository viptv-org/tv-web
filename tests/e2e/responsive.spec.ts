import { expect, test, type Page } from '@playwright/test';

const apiOrigin = 'https://viptv.syek.tech';
const sessionKey = `viptv-device:${apiOrigin}`;
const movie = {
  id: 'responsive-movie', type: 'movie', name: 'A Different Horizon', title: 'A Different Horizon',
  poster: 'https://art.example/poster.svg', background: 'https://art.example/backdrop.svg',
  description: 'A small crew follows a distant signal across an unfamiliar world. The journey brings them home.',
  year: 2026, genres: ['Adventure', 'Drama'],
};

async function installBackend(page: Page, options: { series?: boolean; invalidLogo?: boolean } = {}) {
  const title = options.series ? {
    ...movie, id: 'responsive-series', type: 'series', name: 'Beyond the Horizon', title: 'Beyond the Horizon',
    logo: `https://art.example/${options.invalidLogo ? 'invalid-logo' : 'title-logo'}.svg`,
    videos: Array.from({ length: 8 }, (_, index) => ({ id: `responsive-series:1:${index + 1}`, title: `Episode ${index + 1}`, season: 1, episode: index + 1, thumbnail: 'https://art.example/episode.svg', description: `Episode ${index + 1} brings the crew closer to the signal.` })),
  } : movie;
  let selectedProfileId: string | null = null;
  const requests: { method: string; path: string; body: Record<string, unknown> }[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ key }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({
      sessionId: 'responsive-session', accountId: '7', profileId: null,
      accessToken: 'fixture-access', refreshToken: 'fixture-refresh', expiresIn: 900,
    }));
  }, { key: sessionKey });
  await page.route('https://art.example/**', route => route.request().url().endsWith('/invalid-logo.svg') ? route.fulfill({ status: 404, body: '' }) : route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#304150"/></svg>',
  }));
  await page.route(`${apiOrigin}/api/**`, async route => {
    const request = route.request();
    const headers = {
      'access-control-allow-origin': 'http://127.0.0.1:4173',
      'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'access-control-allow-headers': 'authorization, content-type',
    };
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const path = new URL(request.url()).pathname;
    const body = JSON.parse(request.postData() || '{}') as Record<string, unknown>;
    requests.push({ method: request.method(), path, body });
    if (path === '/api/auth/me') return json({
      account: { id: '7', username: 'alex', name: 'Alex', role: 'member' },
      profiles: [{ id: '1', name: 'Alex', setup_complete: true }],
      profile_id: selectedProfileId, restricted: false, profile_setup_required: false,
    });
    if (path === '/api/auth/profile') {
      selectedProfileId = String(body.profile_id);
      return json({ profile_id: selectedProfileId });
    }
    if (path === '/api/profiles/1/continue/page') return json({ items: [], offset: 0, total: 0, next_offset: null });
    if (path === '/api/profiles/1/progress' || path === '/api/profiles/1/favorites') return json([]);
    if (path === '/api/profiles/1/preferences') return json({ audio_language: 'en', subtitle_language: 'en', subtitles_enabled: false, subtitle_size: 'normal', subtitle_style: 'system', quality: 'auto', autoplay: true });
    if (path === '/api/catalogs') return json([{ id: 'popular', name: 'Popular', type: title.type, addon_id: 2, supports_search: true, supports_skip: true }]);
    if (path === '/api/discover') return json({ metas: [title], has_more: false, next_skip: null });
    if (path === '/api/live') return json({ channels: [], total: 0 });
    if (path === `/api/meta/${title.type}/${title.id}`) return json({ meta: title });
    if (path === '/api/profiles/1/progress/series') return json([]);
    if (path === '/api/streams' && request.method() === 'POST') return json({ id: 'responsive-sources' });
    if (path === '/api/streams/responsive-sources') return json({ events: [{ seq: 1, source: 'addon:2', streams: [{ id: 'responsive-stream', name: 'Responsive source 1080p', title: 'A Different Horizon 1080p', source_addon_id: 'addon:2', source_name: 'Fixture addon' }] }], done: true });
    return json({ error: `Unhandled fixture route ${path}` }, 404);
  });
  return { requests, errors, title };
}

async function expectResponsiveViewport(page: Page, width: number) {
  const dimensions = await page.evaluate(() => {
    const screen = document.querySelector<HTMLElement>('.tv-screen')!;
    const box = screen.getBoundingClientRect();
    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      screenWidth: box.width,
      screenLeft: box.left,
      transform: getComputedStyle(screen).transform,
      background: getComputedStyle(screen).backgroundColor,
    };
  });
  expect(dimensions.clientWidth).toBeLessThanOrEqual(width);
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  expect(dimensions.screenWidth).toBeCloseTo(dimensions.clientWidth, 0);
  expect(dimensions.screenLeft).toBeCloseTo(0, 0);
  expect(dimensions.transform).toBe('none');
  expect(dimensions.background).toBe('rgb(16, 17, 18)');
  await expect(page.getByRole('alert')).toHaveCount(0);
}

for (const viewport of [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'ultrawide', width: 2560, height: 1080 },
]) {
  test(`responsive ${viewport.name}: real profile, Home, detail and source flow fits the viewport`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'vizio', 'The shared HTML application runs once per viewport, independently of TV decoder adapters.');
    await page.setViewportSize(viewport);
    const fixture = await installBackend(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: "Who's watching?" })).toBeVisible();
    await expectResponsiveViewport(page, viewport.width);
    await page.getByRole('button', { name: 'Alex' }).click();
    await expect(page.getByRole('button', { name: 'Home', exact: true })).toBeVisible();
    const card = page.locator('.media-card').filter({ hasText: movie.name });
    await expect(card).toHaveCount(1);
    await expect(card).toBeVisible();
    await expectResponsiveViewport(page, viewport.width);
    await page.keyboard.press('Tab');
    const focusedAction = page.locator('[data-focus-id="hero-play"]');
    await focusedAction.focus();
    await expect(focusedAction).toHaveCSS('background-color', 'rgb(245, 245, 245)');
    await expect(focusedAction).toHaveCSS('color', 'rgb(16, 17, 18)');
    const heroFontSize = await page.locator('.hero h1').evaluate(node => parseFloat(getComputedStyle(node).fontSize));
    expect(heroFontSize).toBeGreaterThanOrEqual(24);
    const cardBox = await card.boundingBox();
    expect(cardBox?.width).toBeGreaterThanOrEqual(140);
    expect(cardBox?.width).toBeLessThanOrEqual(viewport.width);
    if (viewport.width >= 1440) {
      const header = await page.evaluate(() => {
        const box = (selector: string) => {
          const rect = document.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        };
        return { brand: box('.brand'), nav: box('nav[aria-label="Main navigation"]'), cast: box('[data-focus-id="responsive-cast"]'), oled: box('[data-focus-id="responsive-oled"]'), profile: box('[data-focus-id="responsive-profile"]') };
      });
      expect(header.brand.right).toBeLessThanOrEqual(header.nav.left);
      expect(header.nav.right).toBeLessThanOrEqual(header.cast.left);
      expect(header.cast.right).toBeLessThanOrEqual(header.oled.left);
      expect(header.oled.right).toBeLessThanOrEqual(header.profile.left);
      expect(header.profile.right).toBeLessThanOrEqual(viewport.width);
    }
    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-home.png`), animations: 'disabled', fullPage: true });

    await page.getByRole('button', { name: 'OLED off', exact: true }).click();
    await expect(page.getByRole('button', { name: 'OLED on', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.tv-screen')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    await page.reload();
    await expect(page.locator('.home')).toBeVisible();
    await expect(page.getByRole('button', { name: 'OLED on', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => localStorage.getItem('viptv:appearance:oled'))).toBe('true');
    await expect(page.locator('.tv-screen')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    await page.getByRole('button', { name: 'OLED on', exact: true }).click();
    await expectResponsiveViewport(page, viewport.width);

    const more = page.getByRole('button', { name: 'More options', exact: true });
    await more.click();
    const moreDialog = page.locator('.modal[data-focus-scope="modal"]');
    await expect(moreDialog.getByRole('heading', { name: movie.name })).toBeVisible();
    await expect(moreDialog.getByRole('button', { name: 'Details', exact: true })).toBeVisible();
    await expect(moreDialog.getByRole('button', { name: 'More actions', exact: true })).toBeVisible();
    await moreDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(moreDialog).toHaveCount(0);
    await expect(more).toBeFocused();

    const cast = page.getByRole('button', { name: 'Watch on TV', exact: true });
    await cast.click();
    const castDialog = page.getByRole('dialog', { name: 'Watch on TV' });
    await expect(castDialog).toContainText('VIPTV desktop app with SmartCast support');
    await expect(castDialog).toContainText('This browser cannot pair with or control your TV');
    await expect(castDialog.getByLabel('TV IP address')).toHaveCount(0);
    await castDialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(castDialog).toHaveCount(0);
    await expect(cast).toBeFocused();
    await expectResponsiveViewport(page, viewport.width);
    if (viewport.name === 'phone') {
      await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Search', exact: true }).click();
      const discover = page.locator('[data-focus-id="browse-discover"]');
      await expect(discover).toBeVisible();
      await discover.click();
      await expect(discover).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.browse').getByRole('heading', { name: 'Discover', exact: true })).toBeVisible();
      await expectResponsiveViewport(page, viewport.width);
      await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Home', exact: true }).click();
      await expect(page.locator('.home')).toBeVisible();
    }

    await card.click();
    await expect(page.locator('.detail').getByRole('heading', { name: movie.name })).toBeVisible();
    await expectResponsiveViewport(page, viewport.width);
    await page.getByRole('button', { name: 'Choose source', exact: true }).click();
    await expect(page.locator('.source-context')).toContainText(movie.name);
    await expect(page.locator('[data-focus-id="source-0"]')).toBeVisible();
    await expectResponsiveViewport(page, viewport.width);
    expect(fixture.requests.some(request => request.path === '/api/meta/movie/responsive-movie')).toBe(true);
    expect(fixture.requests.find(request => request.path === '/api/streams' && request.method === 'POST')?.body).toMatchObject({ id: movie.id, type: 'movie' });
    expect(fixture.requests.some(request => request.path === '/api/playback')).toBe(false);

    await page.keyboard.press('Escape');
    await expect(page.locator('.detail')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.home')).toBeVisible();
    await page.reload();
    await expect(page.locator('.home')).toBeVisible();
    await expectResponsiveViewport(page, viewport.width);
    const session = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), sessionKey);
    expect(session).toMatchObject({ sessionId: 'responsive-session', accountId: '7', profileId: '1', accessToken: 'fixture-access', refreshToken: 'fixture-refresh' });
    expect(fixture.requests.filter(request => request.path === '/api/auth/profile')).toHaveLength(1);
    expect(fixture.errors).toEqual([]);
  });
}

for (const viewport of [
  { name: 'phone', width: 390, height: 844, invalidLogo: false },
  { name: 'desktop', width: 1440, height: 900, invalidLogo: true },
]) {
  test(`responsive ${viewport.name}: series episodes remain full size with ${viewport.invalidLogo ? 'failed logo text fallback' : 'loaded title logo'}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'vizio', 'Shared HTML series layout needs one browser run per viewport.');
    await page.setViewportSize(viewport);
    const fixture = await installBackend(page, { series: true, invalidLogo: viewport.invalidLogo });
    await page.goto('/');
    await page.getByRole('button', { name: 'Alex' }).click();
    await expect(page.locator('.home')).toBeVisible();
    const title = page.locator('.hero .responsive-title');
    if (viewport.invalidLogo) {
      await expect(title.locator('img')).toHaveJSProperty('complete', true);
      await expect(title.locator('img')).toHaveJSProperty('naturalWidth', 0);
      await expect(title).not.toHaveClass(/has-logo/);
      await expect(title.locator('span')).toHaveCSS('clip-path', 'none');
      await expect(title).toContainText(fixture.title.name);
    } else {
      await expect(title).toHaveClass(/has-logo/);
      await expect(title.locator('img')).toBeVisible();
      await expect(title.locator('img')).toHaveJSProperty('naturalWidth', 1280);
      await expect(title.locator('img')).toHaveCSS('object-fit', 'contain');
    }
    await page.locator('.media-card').filter({ hasText: fixture.title.name }).click();
    await expect(page.locator('.detail.series')).toBeVisible();
    await expect(page.locator('.responsive-app')).toHaveJSProperty('scrollTop', 0);
    if (viewport.width >= 1200) {
      const nav = await page.locator('nav[aria-label="Main navigation"]').boundingBox();
      const back = await page.locator('[data-focus-id="responsive-back"]').boundingBox();
      expect(nav!.x + nav!.width).toBeLessThanOrEqual(back!.x);
    }
    const episode = page.locator('[data-focus-id="episode-0"]');
    await expect(episode).toContainText('EPISODE 1');
    await expect(page.locator('.responsive-episode')).toHaveCount(8);
    const dimensions = await episode.boundingBox();
    expect(dimensions?.width).toBeGreaterThanOrEqual(240);
    const grid = page.locator('.episode-grid');
    if (viewport.name === 'phone') {
      await expect(grid).toHaveCSS('display', 'flex');
      expect(await grid.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
    } else {
      await expect(grid).toHaveCSS('display', 'grid');
      // Read both cards in one animation frame: the real shell can still be
      // smoothly revealing focused content between separate protocol calls.
      const positions = await grid.evaluate(node => Array.from(node.querySelectorAll('.episode')).slice(0, 2).map(card => {
        const box = card.getBoundingClientRect(); return { x: box.x, y: box.y };
      }));
      expect(positions[1].y).toBeCloseTo(positions[0].y, 0);
      expect(positions[1].x).toBeGreaterThan(positions[0].x);
    }
    await expectResponsiveViewport(page, viewport.width);
    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-series.png`), animations: 'disabled', fullPage: true });
    await episode.click();
    await expect(page.locator('.source-context')).toContainText('Episode 1');
    await expect(page.locator('[data-focus-id="source-0"]')).toBeVisible();
    expect(fixture.requests.find(request => request.path === '/api/streams')?.body).toMatchObject({ id: 'responsive-series:1:1', series_id: 'responsive-series', season: 1, episode: 1 });
    await expectResponsiveViewport(page, viewport.width);
    expect(fixture.errors).toEqual([]);
  });
}
