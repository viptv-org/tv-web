import { expect, test, type Page } from '@playwright/test';

const apiOrigin = 'https://viptv.syek.tech';
const sessionKey = `viptv-device:${apiOrigin}`;
const movie = {
  id: 'responsive-movie', type: 'movie', name: 'A Different Horizon', title: 'A Different Horizon',
  poster: 'https://art.example/poster.svg', background: 'https://art.example/backdrop.svg',
  description: 'A small crew follows a distant signal across an unfamiliar world. The journey brings them home.',
  year: 2026, genres: ['Adventure', 'Drama'],
};

async function installBackend(page: Page, options: { series?: boolean; invalidLogo?: boolean; populated?: boolean } = {}) {
  const title = options.series ? {
    ...movie, id: 'responsive-series', type: 'series', name: 'Beyond the Horizon', title: 'Beyond the Horizon',
    logo: `https://art.example/${options.invalidLogo ? 'invalid-logo' : 'title-logo'}.svg`,
    videos: Array.from({ length: 8 }, (_, index) => ({ id: `responsive-series:1:${index + 1}`, title: `Episode ${index + 1}`, season: 1, episode: index + 1, thumbnail: 'https://art.example/episode.svg', description: `Episode ${index + 1} brings the crew closer to the signal.` })),
  } : options.populated ? { ...movie, logo: 'https://art.example/title-logo.svg', description: `${movie.description} ${movie.description} This extended description exercises real catalog copy wrapping across phones, tablets and wide desktop displays.` } : movie;
  const profileName = options.populated ? 'Alexandria Montgomery-Jones' : 'Alex';
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
  await page.route('https://art.example/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/invalid-logo.svg') return route.fulfill({ status: 404, body: '' });
    const portrait = path === '/poster.svg';
    const logo = path === '/title-logo.svg';
    const width = logo ? 1280 : portrait ? 2000 : path === '/episode.svg' ? 1920 : 3840;
    const height = logo ? 320 : portrait ? 3000 : path === '/episode.svg' ? 1080 : 2160;
    const content = logo
      ? '<path d="M20 40L120 160 20 280H100L200 160 100 40Z" fill="#f5f5f5"/><text x="245" y="195" font-family="sans-serif" font-size="110" fill="#f5f5f5">THE HORIZON</text>'
      : `<rect width="${width}" height="${height}" fill="#15263a"/><circle cx="${width * .74}" cy="${height * .28}" r="${width * .12}" fill="#dab979"/><path d="M0 ${height}L${width * .32} ${height * .43}L${width * .62} ${height * .76}L${width} ${height * .38}V${height}Z" fill="#42566a"/><path d="M0 ${height}L${width * .47} ${height * .72}L${width} ${height * .88}V${height}Z" fill="#20313b"/>`;
    return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>` });
  });
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
      profiles: [{ id: '1', name: profileName, setup_complete: true }],
      profile_id: selectedProfileId, restricted: false, profile_setup_required: false,
    });
    if (path === '/api/auth/profile') {
      selectedProfileId = String(body.profile_id);
      return json({ profile_id: selectedProfileId });
    }
    if (path === '/api/profiles/1/continue/page') return json({ items: [], offset: 0, total: 0, next_offset: null });
    if (path === '/api/profiles/1/progress' || path === '/api/profiles/1/favorites') return json([]);
    if (path === '/api/profiles/1/preferences') return json({ audio_language: 'en', subtitle_language: 'en', subtitles_enabled: false, subtitle_size: 'normal', subtitle_style: 'system', quality: 'auto', autoplay: true });
    if (path === '/api/catalogs') return json(Array.from({ length: options.populated ? 4 : 1 }, (_, i) => ({ id: i ? `catalog-${i}` : 'popular', name: options.populated ? `Global Cinema Collection — ${['Popular', 'Recently Added', 'Drama', 'Adventure'][i]} Features and Award-Winning International Television` : 'Popular', type: title.type, addon_id: 2, supports_search: true, supports_skip: true })));
    if (path === '/api/discover') return json({ metas: options.populated ? Array.from({ length: 24 }, (_, i) => ({ ...title, id: i ? `title-${i}` : title.id, name: i ? `The Long Journey Through the Mountains: Chapter ${i}` : title.name })) : [title], has_more: false, next_skip: null });
    if (path === '/api/live') return json({ channels: [], total: 0 });
    if (path === `/api/meta/${title.type}/${title.id}`) return json({ meta: title });
    if (options.populated && /^\/api\/meta\/movie\/title-\d+$/.test(path)) return json({ meta: { ...title, id: path.split("/").at(-1), name: "The Long Journey Through the Mountains" } });
    if (path === '/api/profiles/1/progress/series') return json([]);
    if (path === '/api/streams' && request.method() === 'POST') return json({ id: 'responsive-sources' });
    if (path === '/api/streams/responsive-sources') return json({ events: [{ seq: 1, source: 'addon:2', streams: [{ id: 'responsive-stream', name: options.populated ? 'International Cinema Archive • High Definition • Original Language and Commentary • Extended Edition' : 'Responsive source 1080p', title: 'A Different Horizon 1080p', source_addon_id: 'addon:2', source_name: options.populated ? 'International Cinema and Television Collection — Premium Archive Provider' : 'Fixture addon' }] }], done: true });
    return json({ error: `Unhandled fixture route ${path}` }, 404);
  });
  return { requests, errors, title, profileName };
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
      internalWidth: screen.clientWidth,
      internalScrollWidth: screen.scrollWidth,
      screenLeft: box.left,
      transform: getComputedStyle(screen).transform,
      background: getComputedStyle(screen).backgroundColor,
    };
  });
  expect(dimensions.clientWidth).toBeLessThanOrEqual(width);
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  expect(dimensions.internalScrollWidth).toBeLessThanOrEqual(dimensions.internalWidth + 1);
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

for (const width of [360, 390, 768, 1024, 1280, 1440, 2560]) {
  test(`populated responsive ${width}: shelves never enlarge the hero or application`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'vizio');
    const height = width < 600 ? 844 : 1000;
    await page.setViewportSize({ width, height });
    const fixture = await installBackend(page, { populated: true });
    await page.goto('/');
    await expect(page.locator('[data-focus-id="profile-0"]')).toContainText(fixture.profileName);
    await expectResponsiveViewport(page, width);
    await page.locator('[data-focus-id="profile-0"]').click();
    await expect(page.locator('.shelves section')).toHaveCount(3);
    await expect(page.locator('.shelves .media-card')).toHaveCount(72);
    await expect(page.locator('.responsive-hero-art > img')).toHaveJSProperty('naturalWidth', 3840);
    await expect(page.locator('.hero .responsive-title')).toHaveClass(/has-logo/);
    const geometry = await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>('.responsive-app')!;
      const art = document.querySelector<HTMLElement>('.responsive-hero-art')!;
      const image = art.querySelector('img')!;
      const shelf = document.querySelector<HTMLElement>('.cards')!;
      const hero = art.getBoundingClientRect();
      const bitmap = image.getBoundingClientRect();
      return { rootWidth: root.clientWidth, rootScrollWidth: root.scrollWidth, heroWidth: hero.width, heroHeight: hero.height, heroLeft: hero.left, heroRight: hero.right, imageWidth: bitmap.width, imageHeight: bitmap.height, shelfWidth: shelf.clientWidth, shelfScrollWidth: shelf.scrollWidth };
    });
    expect(geometry.rootScrollWidth).toBeLessThanOrEqual(geometry.rootWidth + 1);
    expect(geometry.heroWidth).toBeLessThanOrEqual(geometry.rootWidth);
    expect(geometry.heroLeft).toBeGreaterThanOrEqual(0);
    expect(geometry.heroRight).toBeLessThanOrEqual(width);
    expect(geometry.heroHeight).toBeLessThanOrEqual(width < 600 ? 240 : 480);
    expect(geometry.heroWidth / geometry.heroHeight).toBeCloseTo(16 / 9, 1);
    expect(geometry.imageWidth).toBeLessThanOrEqual(geometry.heroWidth + 1);
    expect(geometry.imageHeight).toBeLessThanOrEqual(geometry.heroHeight + 1);
    expect(geometry.shelfWidth).toBeLessThanOrEqual(geometry.rootWidth);
    expect(geometry.shelfScrollWidth).toBeGreaterThan(geometry.shelfWidth);
    await expectResponsiveViewport(page, width);
    await page.screenshot({ path: testInfo.outputPath(`populated-${width}.png`) });

    if (width === 390 || width === 1440) {
      const navigation = page.getByRole('navigation', { name: 'Main navigation' });
      await navigation.getByRole('button', { name: 'Search', exact: true }).click();
      await expect(page.locator('[data-focus-id="browse-discover"]')).toBeVisible();
      await expectResponsiveViewport(page, width);
      await page.locator('[data-focus-id="browse-discover"]').click();
      await expect(page.locator('.browse .media-card')).toHaveCount(24);
      await expectResponsiveViewport(page, width);
      const browse = await page.locator('.browse').boundingBox();
      const results = await page.locator('.browse .result-grid').boundingBox();
      expect(browse!.height).toBeGreaterThan(results!.height);
      expect(results!.width).toBeLessThanOrEqual(width);
      await page.screenshot({ path: testInfo.outputPath(`populated-${width}-discover.png`) });
      await navigation.getByRole('button', { name: 'Home', exact: true }).click();
      await page.locator('.shelves .media-card').filter({ hasText: fixture.title.name }).first().click();
      await expect(page.locator('.detail')).toBeVisible();
      await expectResponsiveViewport(page, width);
      const synopsis = await page.locator('.detail-synopsis').boundingBox();
      const actions = await page.locator('.detail-copy .actions').boundingBox();
      expect(actions!.y).toBeGreaterThanOrEqual(synopsis!.y + synopsis!.height);
      await page.screenshot({ path: testInfo.outputPath(`populated-${width}-detail.png`) });
      await page.locator('[data-focus-id="detail-info"]').click();
      const modal = page.locator('[data-focus-scope="modal"]');
      await expect(modal).toBeVisible();
      const modalBox = await modal.boundingBox();
      expect(modalBox!.width).toBeLessThanOrEqual(width - 20);
      expect(modalBox!.height).toBeLessThanOrEqual(height - 20);
      expect(modalBox!.height).toBeGreaterThan(100);
      await expectResponsiveViewport(page, width);
      await page.keyboard.press('Escape');
      await expect(modal).toHaveCount(0);
      await page.getByRole('button', { name: 'Choose source', exact: true }).click();
      const source = page.locator('[data-focus-id="source-0"]');
      await expect(source).toContainText('International Cinema Archive');
      await expect(source.locator('p')).toHaveCSS('color', 'rgb(197, 198, 199)');
      await expectResponsiveViewport(page, width);
      const sourceSize = await source.evaluate(node => ({ height: node.clientHeight, scrollHeight: node.scrollHeight, width: node.clientWidth, scrollWidth: node.scrollWidth }));
      expect(sourceSize.scrollHeight).toBeLessThanOrEqual(sourceSize.height + 1);
      expect(sourceSize.scrollWidth).toBeLessThanOrEqual(sourceSize.width + 1);
      await page.screenshot({ path: testInfo.outputPath(`populated-${width}-sources.png`) });
    }
    expect(fixture.errors).toEqual([]);
  });
}

for (const width of [390, 1440]) {
  test(`responsive Back restores populated shelf offsets at ${width}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'vizio');
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installBackend(page, { populated: true });
    await page.goto('/');
    await page.locator('[data-focus-id="profile-0"]').click();
    const card = page.locator('.shelves section').last().locator('.media-card').nth(12);
    await card.scrollIntoViewIfNeeded();
    await card.focus();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const offsets = () => page.evaluate(() => ({
      top: document.querySelector('.responsive-app')!.scrollTop,
      left: document.querySelector('.shelves section:last-child .cards')!.scrollLeft,
    }));
    const before = await offsets();
    expect(before.top).toBeGreaterThan(0);
    expect(before.left).toBeGreaterThan(0);
    await card.click();
    await expect(page.locator('.detail')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(card).toBeFocused();
    await expect.poll(async () => (await offsets()).left).toBe(before.left);
    // Browser scroll clamping can round the final content edge by a few pixels.
    await expect.poll(async () => Math.abs((await offsets()).top - before.top)).toBeLessThanOrEqual(3);
  });
}
