import { expect, test, type Page } from '@playwright/test';

import { apiOrigin, sessionKey, movie, installBackend } from './helpers/responsiveBackend';

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
    await expect(focusedAction).toHaveCSS('background-color', viewport.width < 600 ? 'rgb(32, 34, 36)' : 'rgb(245, 245, 245)');
    await expect(focusedAction).toHaveCSS('color', viewport.width < 600 ? 'rgb(245, 245, 245)' : 'rgb(16, 17, 18)');
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
        return { brand: box('.brand'), nav: box('nav[aria-label="Main navigation"]'), cast: box('[data-focus-id="responsive-cast"]'), profile: box('[data-focus-id="responsive-profile"]') };
      });
      expect(header.brand.right).toBeLessThanOrEqual(header.nav.left);
      expect(header.nav.right).toBeLessThanOrEqual(header.cast.left);
      expect(header.cast.right).toBeLessThanOrEqual(header.profile.left);
      expect(header.profile.right).toBeLessThanOrEqual(viewport.width);
    }
    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-home.png`), animations: 'disabled', fullPage: true });

    const navigation = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(page.locator('.responsive-toolbar').getByRole('button', { name: /OLED/ })).toHaveCount(0);
    await navigation.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'OLED mode: Off', exact: true }).click();
    await expect(page.getByRole('button', { name: 'OLED mode: On', exact: true })).toBeVisible();
    await expect(page.locator('.tv-screen')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    await navigation.getByRole('button', { name: 'Home', exact: true }).click();
    await page.reload();
    await expect(page.locator('.home')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('viptv:appearance:oled'))).toBe('true');
    await expect(page.locator('.tv-screen')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    await navigation.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'OLED mode: On', exact: true }).click();
    await navigation.getByRole('button', { name: 'Home', exact: true }).click();
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
      expect(back!.x + back!.width).toBeLessThanOrEqual(nav!.x);
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

for (const width of [390, 768, 1440]) {
  test(`responsive populated queue and real-shaped live logos remain separated at ${width}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'vizio');
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // live_catalog::channels supplies type=live and logo; continuation supplies
    // the exact episode, progress and series_id, not a generic movie fixture.
    const fixture = await installBackend(page, { populated: true, activity: true });
    await page.goto('/');
    await page.locator('[data-focus-id="profile-0"]').click();
    const queue = page.locator('.shelves section').filter({ has: page.getByRole('heading', { name: 'Continue Watching', exact: true }) });
    await expect(queue.locator('.media-card')).toHaveCount(24);
    await expect(page.locator('.shelves section').first()).toContainText('Continue Watching');
    await expect(queue.locator('[data-focus-id="queue-0"]')).toContainText('S1');
    await expect(queue.locator('[data-focus-id="queue-0"] > img')).toHaveAttribute('src', 'https://art.example/episode.svg?episode=1');
    await expect(queue.locator('[data-focus-id="queue-1"] > img')).toHaveAttribute('src', 'https://art.example/episode.svg?episode=2');
    expect(fixture.requests.some(request => request.path === '/api/meta/series/queue-series')).toBe(true);
    expect(await queue.locator('[data-focus-id="queue-0"] progress').evaluate(node => (node as HTMLProgressElement).value / (node as HTMLProgressElement).max)).toBeCloseTo(42 / 2400, 3);
    const live = page.locator('[data-focus-id="recent-live-0"]');
    await expect(live).toHaveClass(/logo-card/);
    await expect(live.locator('img')).toHaveJSProperty('naturalWidth', 7000);
    const assertLogo = async () => {
      const geometry = await live.evaluate(node => {
        const art = node.querySelector('.art-fallback')!.getBoundingClientRect();
        const logo = node.querySelector('img')!.getBoundingClientRect();
        const title = node.querySelector('strong')!.getBoundingClientRect();
        return { left: logo.left - art.left, top: logo.top - art.top, right: logo.right - art.right, bottom: logo.bottom - art.bottom, below: title.top - logo.bottom, fit: getComputedStyle(node.querySelector('img')!).objectFit };
      });
      expect(geometry.left).toBeGreaterThanOrEqual(-1);
      expect(geometry.top).toBeGreaterThanOrEqual(-1);
      expect(geometry.right).toBeLessThanOrEqual(1);
      expect(geometry.bottom).toBeLessThanOrEqual(1);
      expect(geometry.below).toBeGreaterThanOrEqual(0);
      expect(geometry.fit).toBe('contain');
    };
    await assertLogo();
    // This is the state missed by sparse screenshots: lower-shelf focus sets
    // compact-home. On stacked layouts it must not win over grid-row:2.
    await live.focus();
    await expect(page.locator('.home')).toHaveClass(/compact-home/);
    if (width < 900) {
      const geometry = await page.evaluate(() => {
        const art = document.querySelector('.responsive-hero-art')!.getBoundingClientRect();
        const copy = document.querySelector('.hero')!.getBoundingClientRect();
        return { artBottom: art.bottom, copyTop: copy.top, artWidth: art.width };
      });
      expect(geometry.copyTop).toBeGreaterThanOrEqual(geometry.artBottom + 15);
      expect(geometry.artWidth).toBeLessThanOrEqual(width);
    }
    await assertLogo();
    await expectResponsiveViewport(page, width);
    await page.screenshot({ path: testInfo.outputPath(`queue-live-${width}.png`) });
    await queue.locator('[data-focus-id="queue-0"]').click();
    await expect(page.locator('[data-focus-id="source-0"]')).toBeVisible();
    expect(fixture.requests.find(request => request.path === '/api/streams')?.body).toMatchObject({ id: 'queue-series:1:1', series_id: 'queue-series', season: 1, episode: 1 });
    expect(fixture.errors).toEqual([]);
  });
}

test('mobile uses selected tabs without focus skin and desktop retains keyboard focus', async ({ page }, info) => {
  test.skip(info.project.name !== 'vizio');
  await page.setViewportSize({ width: 390, height: 844 });
  await installBackend(page);
  await page.goto('/');
  const profile = page.locator('[data-focus-id="profile-0"]');
  await profile.focus();
  expect(await profile.evaluate(node => getComputedStyle(node, '::after').borderTopColor)).toBe('rgba(0, 0, 0, 0)');
  await profile.click();
  const home = page.locator('[data-focus-id="nav-Home"]');
  await home.focus();
  await expect(home).toHaveAttribute('aria-current', 'page');
  await expect(home).toHaveCSS('outline-style', 'none');
  await expect(home).toHaveCSS('background-color', 'rgb(48, 50, 52)');
  await expect(home.locator('img')).toHaveCSS('filter', 'none');
  const card = page.locator('[data-focus-id="home-0"]');
  await card.focus();
  expect(await card.evaluate(node => getComputedStyle(node, '::after').opacity)).toBe('0.35');
  const action = page.locator('[data-focus-id="hero-play"]');
  await action.focus();
  await expect(action).toHaveCSS('outline-style', 'none');
  await expect(action).toHaveCSS('background-color', 'rgb(32, 34, 36)');
  await page.locator('[data-focus-id="nav-Settings"]').click();
  const settings = page.locator('[data-focus-id="nav-Settings"]');
  await expect(settings).toHaveAttribute('aria-current', 'page');
  await expect(settings).toHaveCSS('background-color', 'rgb(48, 50, 52)');
  await expect(settings).toHaveCSS('outline-style', 'none');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.keyboard.press('Tab');
  await home.focus();
  await expect(home).toHaveCSS('outline-style', 'solid');
  await expect(home).toHaveCSS('background-color', 'rgb(245, 245, 245)');
});
